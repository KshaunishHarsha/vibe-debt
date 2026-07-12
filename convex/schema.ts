import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  analysisJobs: defineTable({
    repoUrl: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("claimed"),
      v.literal("done"),
      v.literal("failed")
    ),
    claimedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_repoUrl", ["repoUrl"])
    .index("by_status", ["status"]),

  analyses: defineTable({
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
    slangRoast: v.optional(v.string()),
    roastAudioId: v.optional(v.id("_storage")),
  }).index("by_repoUrl", ["repoUrl"])
    .index("by_cookedScore", ["leaderboardEligible", "cookedScore"]),

  signups: defineTable({
    email: v.string(),
    repoUrl: v.optional(v.string()),
    source: v.union(
      v.literal("gate"),
      v.literal("leaderboard"),
      v.literal("waitlist")
    ),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  claims: defineTable({
    analysisId: v.id("analyses"),
    email: v.string(),
    displayHandle: v.string(),
    createdAt: v.number(),
  }).index("by_analysisId", ["analysisId"]),

  rateLimits: defineTable({
    ipHash: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_ipHash", ["ipHash"]),
});
