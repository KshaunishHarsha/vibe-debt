"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

const TIER_STYLES: Record<string, string> = {
  Raw: "text-emerald-600 dark:text-emerald-400",
  Rare: "text-lime-600 dark:text-lime-400",
  Medium: "text-amber-600 dark:text-amber-400",
  "Well-Done": "text-orange-600 dark:text-orange-400",
  Burnt: "text-red-600 dark:text-red-400",
};

export default function ResultPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = use(params);
  const repoUrl = `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const result = useQuery(api.analyses.getResult, { repoUrl });

  const shortName = `${owner}/${repo}`;

  let body;
  if (result === undefined) {
    body = <p className="text-zinc-500">Loading…</p>;
  } else if (result.analysis) {
    const a = result.analysis;
    body = (
      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-7xl font-bold tabular-nums text-black dark:text-zinc-50">
            {a.cookedScore}%
          </span>
          <span
            className={`text-2xl font-semibold ${TIER_STYLES[a.tier] ?? "text-zinc-600"}`}
          >
            {a.tier}
            {a.tier === "Burnt" ? " 💀" : ""}
          </span>
        </div>
        {/* Doneness meter */}
        <div className="h-3 w-full max-w-md overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-600"
            style={{ width: `${Math.max(a.cookedScore, 3)}%` }}
          />
        </div>
        <blockquote className="max-w-md text-lg italic text-zinc-700 dark:text-zinc-300">
          “{a.headlineRoast}”
        </blockquote>
        {!a.leaderboardEligible && (
          <p className="text-sm text-zinc-400">too smol to rank 🍼</p>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          score {a.scoreVersion} · {a.stats.files} files · {a.stats.loc.toLocaleString()} LOC ·{" "}
          {a.stats.languages.join(", ")}
        </p>
      </div>
    );
  } else if (result.jobStatus === "pending" || result.jobStatus === "claimed") {
    body = (
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800 dark:border-zinc-700 dark:border-t-zinc-200" />
        <p className="text-zinc-600 dark:text-zinc-400">
          {result.jobStatus === "pending"
            ? "In the queue — the agent will pick it up shortly…"
            : "The agent is reading your code right now. Pray."}
        </p>
      </div>
    );
  } else if (result.jobStatus === "failed") {
    body = (
      <p className="text-red-600 dark:text-red-400">
        The analysis failed. The repo may have out-cooked the agent. Try again.
      </p>
    );
  } else {
    body = (
      <p className="text-zinc-600 dark:text-zinc-400">
        No analysis found for this repo yet.{" "}
        <Link href="/" className="underline">
          Submit it?
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-8 px-6 py-16 text-center">
        <div>
          <p className="text-sm uppercase tracking-widest text-zinc-400">cooked report</p>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{shortName}</h1>
        </div>
        {body}
        <Link href="/" className="text-sm text-zinc-400 underline hover:text-zinc-600">
          roast another repo
        </Link>
      </main>
    </div>
  );
}
