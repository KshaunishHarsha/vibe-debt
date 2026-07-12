"use client";

import { use, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { pickTierGif, LOADING_GIFS, FAILED_GIF } from "@/app/lib/gifs";
import { trackGoal } from "@/app/lib/track";

const TIER_BG: Record<string, string> = {
  Raw: "bg-emerald-400",
  Rare: "bg-lime-300",
  Medium: "bg-amber-300",
  "Well-Done": "bg-orange-400",
  Burnt: "bg-red-500 text-white",
};

const CHECK_LABELS: Record<string, string> = {
  no_tests: "Test coverage",
  unused_deps: "Dependency hygiene",
  debug_artifacts: "Debug artifacts",
  no_error_handling: "IO/network error handling",
};

type Finding = {
  check: string;
  triggered: boolean;
  severity?: number;
  evidence: string;
  roast?: string;
  fix?: string;
};

const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL;

export default function ResultPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = use(params);
  const repoUrl = `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const result = useQuery(api.analyses.getResult, { repoUrl });
  const capture = useMutation(api.signups.capture);

  const [email, setEmail] = useState("");
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [loadingGifIdx, setLoadingGifIdx] = useState(0);

  const analyzing =
    result?.jobStatus === "pending" || result?.jobStatus === "claimed";
  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(
      () => setLoadingGifIdx((i) => (i + 1) % LOADING_GIFS.length),
      3000
    );
    return () => clearInterval(t);
  }, [analyzing]);

  useEffect(() => {
    const t = setTimeout(
      () => setUnlocked(!!localStorage.getItem("cooked-email")),
      0
    );
    return () => clearTimeout(t);
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setGateError(null);
    const res = await capture({ email, repoUrl, source: "gate" });
    if (!res.ok) {
      setGateError("That email doesn't parse. Try a real one.");
      return;
    }
    trackGoal("email_signup", { source: "gate" });
    localStorage.setItem("cooked-email", email);
    setUnlocked(true);
  }

  const shortName = `${owner}/${repo}`;
  const a = result?.analysis;
  const findings: Finding[] = a ? JSON.parse(a.findingsJson) : [];
  const triggered = findings.filter((f) => f.triggered);

  return (
    <div className="flex flex-1 flex-col items-center bg-[#FFF3D6] font-sans text-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 px-5 py-14">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="rotate-[-1.5deg] border-[3px] border-black bg-black px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-[#FFE14D]">
            cooked report
          </p>
          <h1 className="font-mono text-2xl font-black">{shortName}</h1>
        </div>

        {result === undefined ? (
          <p className="font-bold">Loading…</p>
        ) : a ? (
          <>
            {/* ── Free tier ── */}
            <div className="flex w-full flex-col items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="rotate-[-2deg] border-4 border-black bg-white px-6 py-3 shadow-[8px_8px_0_0_#FF5D1F]">
                  <span className="font-mono text-7xl font-black tabular-nums">
                    {a.cookedScore}%
                  </span>
                </div>
                <div
                  className={`rotate-[2deg] border-4 border-black px-4 py-2 text-2xl font-black uppercase shadow-[6px_6px_0_0_#000] ${TIER_BG[a.tier] ?? "bg-white"}`}
                >
                  {a.tier}
                  {a.tier === "Burnt" ? " 💀" : ""}
                </div>
              </div>

              <div className="h-6 w-full max-w-md border-4 border-black bg-white shadow-[5px_5px_0_0_#000]">
                <div
                  className="h-full border-r-4 border-black bg-gradient-to-r from-emerald-400 via-amber-300 to-red-500"
                  style={{ width: `${Math.max(a.cookedScore, 4)}%` }}
                />
              </div>

              <div className="flex w-full max-w-lg flex-col items-center gap-4 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pickTierGif(a.tier, repoUrl)}
                  alt={`${a.tier} tier reaction`}
                  className="w-40 rotate-[-1.5deg] border-4 border-black object-cover shadow-[6px_6px_0_0_#000]"
                />
                <blockquote className="flex-1 rotate-[0.5deg] border-4 border-black bg-[#FFE14D] p-4 text-center text-lg font-bold shadow-[7px_7px_0_0_#000]">
                  “{a.headlineRoast}”
                </blockquote>
              </div>

              {result.slangRoast && (
                <div className="w-full max-w-lg rotate-[-0.5deg] border-4 border-black bg-black p-4 shadow-[7px_7px_0_0_#FF5D1F]">
                  <p className="font-mono text-xs font-black uppercase tracking-widest text-[#FF5D1F]">
                    🗣️ unhinged mode
                  </p>
                  <p className="mt-2 font-bold text-white">{result.slangRoast}</p>
                  {result.roastAudioUrl && (
                    <audio
                      controls
                      src={result.roastAudioUrl}
                      className="mt-3 w-full"
                    />
                  )}
                </div>
              )}
              {!a.leaderboardEligible && (
                <p className="border-[3px] border-black bg-white px-3 py-1 font-bold shadow-[3px_3px_0_0_#000]">
                  too smol to rank 🍼
                </p>
              )}
              <p className="font-mono text-xs font-semibold">
                score {a.scoreVersion} · {a.stats.files} files ·{" "}
                {a.stats.loc.toLocaleString()} LOC · {a.stats.languages.join(", ")}{" "}
                · agent examined {a.filesExamined.length} files
              </p>
            </div>

            {/* ── Gate / full report ── */}
            {!unlocked ? (
              <div className="flex w-full flex-col items-center gap-4 border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]">
                <h2 className="text-center text-xl font-black uppercase">
                  🔒 Full diagnostic:{" "}
                  <span className="bg-red-400 px-1">
                    {triggered.length} failing check
                    {triggered.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <p className="text-center text-sm font-semibold">
                  Per-check evidence (files, counts, ratios), severity, and the
                  exact fixes — plus a direct line to the agent that read your
                  code.
                </p>
                <form
                  onSubmit={unlock}
                  className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dev@yourcompany.com"
                    className="flex-1 border-[3px] border-black bg-[#FFFDF5] px-4 py-2.5 font-mono font-semibold shadow-[4px_4px_0_0_#000] outline-none placeholder:text-zinc-400"
                  />
                  <button
                    type="submit"
                    className="border-[3px] border-black bg-[#FF5D1F] px-5 py-2.5 font-black uppercase text-white shadow-[4px_4px_0_0_#000] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    Unlock
                  </button>
                </form>
                {gateError && (
                  <p className="border-[3px] border-black bg-red-400 px-3 py-1.5 font-bold shadow-[3px_3px_0_0_#000]">
                    {gateError}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex w-full flex-col gap-4">
                <h2 className="w-fit rotate-[-1deg] border-4 border-black bg-black px-4 py-1.5 text-xl font-black uppercase text-white shadow-[5px_5px_0_0_#FFE14D]">
                  Full diagnostic
                </h2>
                {findings.map((f) => (
                  <div
                    key={f.check}
                    className={`border-4 border-black p-4 shadow-[6px_6px_0_0_#000] ${
                      f.triggered ? "bg-[#FFD6C9]" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black uppercase">
                        {f.triggered ? "❌" : "✅"}{" "}
                        {CHECK_LABELS[f.check] ?? f.check}
                      </h3>
                      {f.triggered && f.severity !== undefined && (
                        <span className="border-2 border-black bg-black px-2 py-0.5 font-mono text-xs font-bold text-red-400">
                          sev {f.severity}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 border-l-4 border-black pl-2 font-mono text-sm font-semibold">
                      {f.evidence}
                    </p>
                    {f.roast && (
                      <p className="mt-2 text-sm font-bold italic">{f.roast}</p>
                    )}
                    {f.triggered && f.fix && (
                      <p className="mt-2 border-2 border-black bg-emerald-300 p-2 text-sm font-semibold">
                        🔧 <span className="font-black uppercase">Fix:</span>{" "}
                        {f.fix}
                      </p>
                    )}
                  </div>
                ))}
                <div className="border-4 border-black bg-[#B8E8FF] p-5 text-center shadow-[8px_8px_0_0_#000]">
                  <h3 className="text-lg font-black uppercase">
                    Argue with the agent that read your code
                  </h3>
                  <p className="mt-1 font-mono text-sm font-semibold">
                    “why did I lose 15 points?” · “show me the worst file” ·
                    “what do I fix first?”
                  </p>
                  {TELEGRAM_URL ? (
                    <a
                      href={TELEGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block border-[3px] border-black bg-black px-6 py-2.5 font-black uppercase text-[#B8E8FF] shadow-[5px_5px_0_0_#fff] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                      Open Telegram →
                    </a>
                  ) : (
                    <p className="mt-3 font-mono text-sm font-bold">
                      Telegram link coming online…
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : result.jobStatus === "pending" || result.jobStatus === "claimed" ? (
          <div className="flex flex-col items-center gap-4 border-4 border-dashed border-black bg-white p-6 shadow-[6px_6px_0_0_#000]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOADING_GIFS[loadingGifIdx]}
              alt="the agent is investigating"
              className="w-72 border-4 border-black object-cover shadow-[5px_5px_0_0_#FF5D1F]"
            />
            <p className="text-center font-bold">
              {result.jobStatus === "pending"
                ? "In the queue — the agent picks it up in seconds…"
                : "The agent is reading your code right now. Pray. 🙏"}
            </p>
          </div>
        ) : result.jobStatus === "failed" ? (
          <div className="flex flex-col items-center gap-3 border-4 border-black bg-red-400 p-5 font-bold shadow-[6px_6px_0_0_#000]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FAILED_GIF}
              alt="404"
              className="w-56 border-4 border-black object-cover"
            />
            <p>The analysis failed. The repo may have out-cooked the agent. Try again.</p>
          </div>
        ) : (
          <p className="border-4 border-black bg-white p-4 font-bold shadow-[6px_6px_0_0_#000]">
            No analysis for this repo yet.{" "}
            <Link href="/" className="underline">
              Submit it?
            </Link>
          </p>
        )}

        <Link
          href="/"
          className="border-[3px] border-black bg-white px-4 py-2 font-bold shadow-[4px_4px_0_0_#000] transition-transform hover:bg-[#FFE14D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          ← back to the leaderboard
        </Link>
      </main>
    </div>
  );
}
