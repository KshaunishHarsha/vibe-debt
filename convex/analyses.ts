import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const analysisResult = v.object({
  _id: v.id("analyses"),
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
  createdAt: v.number(),
});

function stripSystemFields(doc: {
  _id: unknown;
  _creationTime: number;
  [key: string]: unknown;
}) {
  const { _creationTime, ...rest } = doc;
  void _creationTime;
  return rest;
}

// Latest analysis for a repo, if newer than the 24h cache window.
export const latestFresh = internalQuery({
  args: { repoUrl: v.string() },
  returns: v.union(analysisResult, v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("analyses")
      .withIndex("by_repoUrl", (q) => q.eq("repoUrl", args.repoUrl))
      .order("desc")
      .first();
    if (!doc || Date.now() - doc.createdAt > CACHE_TTL_MS) return null;
    return stripSystemFields(doc) as typeof doc;
  },
});

// What the result page subscribes to: the analysis if it exists,
// otherwise the state of the most recent job for this repo.
export const getResult = query({
  args: { repoUrl: v.string() },
  returns: v.object({
    analysis: v.union(analysisResult, v.null()),
    jobStatus: v.union(
      v.literal("pending"),
      v.literal("claimed"),
      v.literal("done"),
      v.literal("failed"),
      v.null()
    ),
  }),
  handler: async (ctx, args) => {
    const analysis = await ctx.db
      .query("analyses")
      .withIndex("by_repoUrl", (q) => q.eq("repoUrl", args.repoUrl))
      .order("desc")
      .first();
    const job = await ctx.db
      .query("analysisJobs")
      .withIndex("by_repoUrl", (q) => q.eq("repoUrl", args.repoUrl))
      .order("desc")
      .first();
    return {
      analysis: analysis ? (stripSystemFields(analysis) as typeof analysis) : null,
      jobStatus: job?.status ?? null,
    };
  },
});

// Hall of shame: most cooked eligible repos first.
export const leaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(analysisResult),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("analyses")
      .withIndex("by_cookedScore", (q) => q.eq("leaderboardEligible", true))
      .order("desc")
      .take(args.limit ?? 50);
    // One entry per repo: keep only the newest analysis per repoUrl.
    const seen = new Set<string>();
    const out = [];
    for (const doc of docs.sort((a, b) => b.createdAt - a.createdAt)) {
      if (seen.has(doc.repoUrl)) continue;
      seen.add(doc.repoUrl);
      out.push(doc);
    }
    out.sort((a, b) => b.cookedScore - a.cookedScore);
    return out.map((d) => stripSystemFields(d) as typeof d);
  },
});
