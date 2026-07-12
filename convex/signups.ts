import { mutation } from "./_generated/server";
import { v } from "convex/values";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const capture = mutation({
  args: {
    email: v.string(),
    repoUrl: v.optional(v.string()),
    source: v.union(
      v.literal("gate"),
      v.literal("leaderboard"),
      v.literal("waitlist")
    ),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false };
    await ctx.db.insert("signups", {
      email,
      repoUrl: args.repoUrl,
      source: args.source,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
