import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Dev-only helper (internal — not callable from clients): wipe analysis
// data. Used to clear round-trip test fixtures; delete before the event ends.
export const clearAnalysisData = internalMutation({
  args: {},
  returns: v.object({ jobs: v.number(), analyses: v.number() }),
  handler: async (ctx) => {
    const jobs = await ctx.db.query("analysisJobs").collect();
    for (const j of jobs) await ctx.db.delete(j._id);
    const analyses = await ctx.db.query("analyses").collect();
    for (const a of analyses) await ctx.db.delete(a._id);
    return { jobs: jobs.length, analyses: analyses.length };
  },
});
