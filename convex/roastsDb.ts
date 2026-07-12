import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getAnalysisById = internalQuery({
  args: { analysisId: v.id("analyses") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => ctx.db.get(args.analysisId),
});

export const setSlangRoast = internalMutation({
  args: { analysisId: v.id("analyses"), slangRoast: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analysisId, { slangRoast: args.slangRoast });
    return null;
  },
});

export const attachAudio = internalMutation({
  args: { analysisId: v.id("analyses"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analysisId, { roastAudioId: args.storageId });
    return null;
  },
});

export const listMissingSlang = internalQuery({
  args: {},
  returns: v.array(v.id("analyses")),
  handler: async (ctx) => {
    const docs = await ctx.db.query("analyses").collect();
    return docs.filter((d) => !d.slangRoast).map((d) => d._id);
  },
});
