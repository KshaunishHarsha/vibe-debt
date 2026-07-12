import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
