import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { normalizeRepoUrl } from "./lib/repoUrl";

// GitHub's `size` includes full git history, so this is generous on purpose —
// analysis cost is capped by the 15-file sampling budget, not repo size.
const MAX_REPO_SIZE_KB = 500 * 1024; // ~500MB of git history
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10; // submissions per IP per hour

const submitResult = v.union(
  v.object({ status: v.literal("invalid"), message: v.string() }),
  v.object({ status: v.literal("rate_limited"), message: v.string() }),
  v.object({ status: v.literal("too_big"), message: v.string() }),
  v.object({ status: v.literal("not_found"), message: v.string() }),
  v.object({ status: v.literal("cached"), repoUrl: v.string() }),
  v.object({ status: v.literal("queued"), repoUrl: v.string() }),
  v.object({ status: v.literal("already_queued"), repoUrl: v.string() })
);

// The single entry point for the web app. Called from the Next.js /api/submit
// route (which supplies the caller's hashed IP).
export const submit = action({
  args: { repoUrl: v.string(), ipHash: v.string() },
  returns: submitResult,
  handler: async (ctx, args) => {
    const normalized = normalizeRepoUrl(args.repoUrl);
    if (!normalized) {
      return {
        status: "invalid" as const,
        message: "That doesn't look like a GitHub repo. Try github.com/owner/repo.",
      };
    }
    const { url, owner, repo } = normalized;

    // 24h cache: repeat requests are instant and score-stable.
    const cached = await ctx.runQuery(internal.analyses.latestFresh, {
      repoUrl: url,
    });
    if (cached) return { status: "cached" as const, repoUrl: url };

    // Dedupe: an in-flight job for this repo means just watch that one.
    const active = await ctx.runQuery(internal.analysisJobs.activeJobForRepo, {
      repoUrl: url,
    });
    if (active) return { status: "already_queued" as const, repoUrl: url };

    const allowed = await ctx.runMutation(internal.analysisJobs.checkRateLimit, {
      ipHash: args.ipHash,
    });
    if (!allowed) {
      return {
        status: "rate_limited" as const,
        message: "Slow down, chef. Try again in a bit.",
      };
    }

    // Size gate via repo metadata — cheap, one API call.
    const token = process.env.GITHUB_PAT;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cooked-repo",
      },
    });
    if (res.status === 404) {
      return {
        status: "not_found" as const,
        message: "Repo not found — private repos can't be roasted (yet).",
      };
    }
    if (!res.ok) {
      return {
        status: "invalid" as const,
        message: `GitHub said no (${res.status}). Try again.`,
      };
    }
    const meta = await res.json();
    if (meta.size > MAX_REPO_SIZE_KB) {
      return {
        status: "too_big" as const,
        message: "This repo is too enterprise to vibe-check. Try something under 500MB.",
      };
    }

    await ctx.runMutation(internal.analysisJobs.enqueue, { repoUrl: url });
    return { status: "queued" as const, repoUrl: url };
  },
});

export const activeJobForRepo = internalQuery({
  args: { repoUrl: v.string() },
  returns: v.union(v.object({ jobId: v.id("analysisJobs") }), v.null()),
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("analysisJobs")
      .withIndex("by_repoUrl", (q) => q.eq("repoUrl", args.repoUrl))
      .collect();
    const active = jobs.find(
      (j) => j.status === "pending" || j.status === "claimed"
    );
    return active ? { jobId: active._id } : null;
  },
});

export const checkRateLimit = internalMutation({
  args: { ipHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const row = await ctx.db
      .query("rateLimits")
      .withIndex("by_ipHash", (q) => q.eq("ipHash", args.ipHash))
      .first();
    if (!row || now - row.windowStart > RATE_LIMIT_WINDOW_MS) {
      if (row) {
        await ctx.db.patch(row._id, { windowStart: now, count: 1 });
      } else {
        await ctx.db.insert("rateLimits", {
          ipHash: args.ipHash,
          windowStart: now,
          count: 1,
        });
      }
      return true;
    }
    if (row.count >= RATE_LIMIT_MAX) return false;
    await ctx.db.patch(row._id, { count: row.count + 1 });
    return true;
  },
});

export const enqueue = internalMutation({
  args: { repoUrl: v.string() },
  returns: v.id("analysisJobs"),
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("analysisJobs", {
      repoUrl: args.repoUrl,
      status: "pending",
      createdAt: Date.now(),
    });
    // Primary execution path: schedule the Hermes-driven analysis immediately.
    // (The HTTP claim/result endpoints remain as a droplet-side poller fallback.)
    await ctx.scheduler.runAfter(0, internal.hermes.runAnalysis, {
      jobId,
      repoUrl: args.repoUrl,
    });
    return jobId;
  },
});

export const markClaimed = internalMutation({
  args: { jobId: v.id("analysisJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { status: "claimed", claimedAt: Date.now() });
    return null;
  },
});

// Called by the Hermes-facing HTTP endpoint: atomically claim the oldest
// pending job. Convex mutations are transactional, so two pollers can't
// claim the same row.
export const claimNext = internalMutation({
  args: {},
  returns: v.union(
    v.object({
      jobId: v.id("analysisJobs"),
      repoUrl: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const job = await ctx.db
      .query("analysisJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .first();
    if (!job) return null;
    await ctx.db.patch(job._id, { status: "claimed", claimedAt: Date.now() });
    return { jobId: job._id, repoUrl: job.repoUrl };
  },
});

// Called by the Hermes-facing HTTP endpoint when a run finishes: persist the
// analysis (the output contract from PRODUCT_SPEC.md) and close the job.
export const completeJob = internalMutation({
  args: {
    jobId: v.id("analysisJobs"),
    result: v.object({
      repoUrl: v.string(),
      scoreVersion: v.string(),
      cookedScore: v.number(),
      tier: v.string(),
      headlineRoast: v.string(),
      findingsJson: v.string(),
      filesExamined: v.array(v.string()),
      stats: v.object({
        files: v.number(),
        loc: v.number(),
        languages: v.array(v.string()),
      }),
      leaderboardEligible: v.boolean(),
    }),
  },
  returns: v.id("analyses"),
  handler: async (ctx, args) => {
    // The job's URL is the cache/leaderboard key the frontend subscribes to.
    // GitHub redirects (renamed/transferred repos) can make the analyzer
    // report a different canonical URL — keep the job's key so the result
    // is always visible to whoever submitted it.
    const job = await ctx.db.get(args.jobId);
    const analysisId = await ctx.db.insert("analyses", {
      ...args.result,
      repoUrl: job?.repoUrl ?? args.result.repoUrl,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.jobId, { status: "done" });
    // Fire-and-forget: unhinged slang roast (+ voice, when the ElevenLabs key
    // is on the VPS) for every fresh analysis.
    await ctx.scheduler.runAfter(0, internal.roasts.generateSlang, {
      analysisId,
    });
    return analysisId;
  },
});

export const failJob = internalMutation({
  args: { jobId: v.id("analysisJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { status: "failed" });
    return null;
  },
});
