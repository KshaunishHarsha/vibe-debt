"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Drives one analysis job through the Hermes agent running on the VPS.
// Hermes is the runtime engine: it explores the repo agentically and runs the
// deterministic scorer (scripts/score.py, on the VPS) — this action is only
// the conveyor belt between the job queue and the agent.
//
// Requires on the Convex deployment:
//   HERMES_API_URL, HERMES_API_KEY
// Requires on the VPS:
//   ~/cooked/skills/cooked-check/ (SKILL.md + scripts/score.py), GITHUB_PAT
//   available in the Hermes process environment, python3.
const SKILL_DIR = "/root/cooked/skills/cooked-check";
const HERMES_TIMEOUT_MS = 280_000;

function buildPrompt(repoUrl: string): string {
  return [
    `You are running the cooked-check skill. Read the skill instructions at`,
    `${SKILL_DIR}/SKILL.md and execute them for REPO_URL=${repoUrl}.`,
    ``,
    `Setup: create a fresh working directory (mktemp -d), copy`,
    `${SKILL_DIR}/scripts into it, and do all work there. First run:`,
    `export GITHUB_PAT=$(cat /root/cooked/.github_pat)`,
    ``,
    `IMPORTANT — output contract: your FINAL message must be ONLY the result`,
    `JSON (the exact shape from SKILL.md step 6), with no markdown fences and`,
    `no commentary. If the analysis cannot complete, reply with ONLY:`,
    `{"error": "<one-line reason>"}`,
  ].join("\n");
}

function extractJson(text: string): Record<string, unknown> | null {
  // Tolerate models that wrap output in fences or add stray prose.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [text.trim(), fenced?.[1]?.trim() ?? ""];
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  candidates.push(braced);
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c);
    } catch {
      continue;
    }
  }
  return null;
}

// Connectivity check, callable via `npx convex run hermes:ping` — tests the
// VPS from Convex's cloud (the path production traffic actually takes).
export const ping = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), detail: v.string() }),
  handler: async () => {
    const url = process.env.HERMES_API_URL;
    const key = process.env.HERMES_API_KEY;
    if (!url || !key) return { ok: false, detail: "env vars not set" };
    try {
      const res = await fetch(url.replace("/chat/completions", "/models"), {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      });
      return { ok: res.ok, detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    } catch (err) {
      return { ok: false, detail: String(err).slice(0, 300) };
    }
  },
});

// One-shot prompt test through the real chat-completions path.
// `npx convex run hermes:chatTest '{"prompt": "..."}'`
export const chatTest = internalAction({
  args: { prompt: v.string() },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const res = await fetch(process.env.HERMES_API_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HERMES_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "hermes-agent",
        messages: [{ role: "user", content: args.prompt }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? JSON.stringify(data).slice(0, 300);
  },
});

export const runAnalysis = internalAction({
  args: { jobId: v.id("analysisJobs"), repoUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.analysisJobs.markClaimed, {
      jobId: args.jobId,
    });

    const url = process.env.HERMES_API_URL;
    const key = process.env.HERMES_API_KEY;
    if (!url || !key) {
      console.error("HERMES_API_URL / HERMES_API_KEY not configured");
      await ctx.runMutation(internal.analysisJobs.failJob, { jobId: args.jobId });
      return null;
    }

    let content: string;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "hermes-agent",
          messages: [{ role: "user", content: buildPrompt(args.repoUrl) }],
        }),
        signal: AbortSignal.timeout(HERMES_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`Hermes API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const data = await res.json();
      content = data.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      console.error(`Hermes call failed for ${args.repoUrl}:`, err);
      await ctx.runMutation(internal.analysisJobs.failJob, { jobId: args.jobId });
      return null;
    }

    const parsed = extractJson(content);
    if (!parsed || parsed.error || typeof parsed.cookedScore !== "number") {
      console.error(
        `Hermes returned unusable result for ${args.repoUrl}:`,
        parsed?.error ?? content.slice(0, 300)
      );
      await ctx.runMutation(internal.analysisJobs.failJob, { jobId: args.jobId });
      return null;
    }

    await ctx.runMutation(internal.analysisJobs.completeJob, {
      jobId: args.jobId,
      result: {
        repoUrl: String(parsed.repoUrl ?? args.repoUrl),
        scoreVersion: String(parsed.scoreVersion ?? "v1.0"),
        cookedScore: Math.max(0, Math.min(100, Math.round(parsed.cookedScore))),
        tier: String(parsed.tier ?? ""),
        headlineRoast: String(parsed.headlineRoast ?? ""),
        findingsJson: JSON.stringify(parsed.findings ?? []),
        filesExamined: Array.isArray(parsed.filesExamined)
          ? parsed.filesExamined.map(String)
          : [],
        stats: {
          files: Number((parsed.stats as Record<string, unknown>)?.files ?? 0),
          loc: Number((parsed.stats as Record<string, unknown>)?.loc ?? 0),
          languages: Array.isArray((parsed.stats as Record<string, unknown>)?.languages)
            ? ((parsed.stats as Record<string, unknown>).languages as unknown[]).map(String)
            : [],
        },
        leaderboardEligible: Boolean(parsed.leaderboardEligible),
      },
    });
    return null;
  },
});
