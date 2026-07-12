import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    const analysisId = await ctx.db.insert("analyses", {
      ...args.result,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.jobId, { status: "done" });
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

export const createTestJob = mutation({
  args: { repoUrl: v.string() },
  returns: v.id("analysisJobs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("analysisJobs", {
      repoUrl: args.repoUrl,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const listJobs = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("analysisJobs"),
      repoUrl: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("claimed"),
        v.literal("done"),
        v.literal("failed")
      ),
    })
  ),
  handler: async (ctx) => {
    const jobs = await ctx.db.query("analysisJobs").collect();
    return jobs.map((j) => ({
      _id: j._id,
      repoUrl: j.repoUrl,
      status: j.status,
    }));
  },
});
