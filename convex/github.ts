"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const GITHUB_API = "https://api.github.com";

function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_PAT;
  if (!token) throw new Error("GITHUB_PAT env var not set on the Convex deployment");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cooked-repo",
  };
}

// Phase 1 connectivity test: fetch repo metadata and confirm the PAT is
// authenticated (rate limit should report ~5000/hr, not 60).
export const testRepoFetch = action({
  args: { owner: v.string(), repo: v.string() },
  returns: v.object({
    fullName: v.string(),
    sizeKb: v.number(),
    defaultBranch: v.string(),
    rateLimitRemaining: v.string(),
    rateLimitTotal: v.string(),
  }),
  handler: async (_ctx, args) => {
    const res = await fetch(`${GITHUB_API}/repos/${args.owner}/${args.repo}`, {
      headers: githubHeaders(),
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return {
      fullName: data.full_name,
      sizeKb: data.size,
      defaultBranch: data.default_branch,
      rateLimitRemaining: res.headers.get("x-ratelimit-remaining") ?? "?",
      rateLimitTotal: res.headers.get("x-ratelimit-limit") ?? "?",
    };
  },
});
