"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

const TIER_CHIP: Record<string, string> = {
  Raw: "bg-emerald-400",
  Rare: "bg-lime-300",
  Medium: "bg-amber-300",
  "Well-Done": "bg-orange-400",
  Burnt: "bg-red-500 text-white",
};

const FAMOUS = [
  { label: "express", repo: "expressjs/express" },
  { label: "is-odd", repo: "jonschlinkert/is-odd" },
];

export default function Home() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const board = useQuery(api.analyses.leaderboard, { limit: 25 });

  async function submit(url: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url }),
      });
      const data = await res.json();
      if (["cached", "queued", "already_queued"].includes(data.status)) {
        router.push(`/r/${data.repoUrl.replace("https://github.com/", "")}`);
        return;
      }
      setError(data.message ?? "Something went wrong.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-[#FFF3D6] font-sans text-black">
      <main className="flex w-full max-w-2xl flex-col gap-10 px-5 py-14">
        <header className="relative flex flex-col items-center gap-4 text-center">
          <div className="rotate-[-2deg] border-4 border-black bg-[#FF5D1F] px-6 py-4 shadow-[8px_8px_0_0_#000]">
            <h1 className="text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
              How Cooked
              <br />
              Is Your Repo?
            </h1>
          </div>
          <div className="rotate-[1.5deg] border-[3px] border-black bg-[#FFE14D] px-4 py-2 font-bold shadow-[5px_5px_0_0_#000]">
            It&apos;s not about who wrote your code.
            <br />
            It&apos;s about whether anyone read it. 🔥
          </div>
        </header>

        <section className="flex flex-col gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (repoUrl.trim()) submit(repoUrl);
            }}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="github.com/owner/repo"
              className="flex-1 border-4 border-black bg-white px-4 py-3.5 font-mono font-semibold shadow-[6px_6px_0_0_#000] outline-none placeholder:text-zinc-400 focus:bg-[#FFFDF5]"
            />
            <button
              type="submit"
              disabled={submitting}
              className="border-4 border-black bg-black px-7 py-3.5 text-lg font-black uppercase text-[#FFE14D] shadow-[6px_6px_0_0_#FF5D1F] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60"
            >
              {submitting ? "Cooking…" : "Cook Check"}
            </button>
          </form>
          {error && (
            <p className="border-[3px] border-black bg-red-400 px-3 py-2 font-bold shadow-[4px_4px_0_0_#000]">
              ⚠️ {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <span>no repo? roast a famous one →</span>
            {FAMOUS.map((f) => (
              <button
                key={f.repo}
                onClick={() => submit(f.repo)}
                className="border-[3px] border-black bg-white px-3 py-1 font-mono font-bold shadow-[3px_3px_0_0_#000] transition-transform hover:bg-[#FFE14D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="w-fit rotate-[-1deg] border-4 border-black bg-black px-4 py-2 text-2xl font-black uppercase text-white shadow-[6px_6px_0_0_#FFE14D]">
            💀 Wall of Shame
          </h2>
          {board === undefined ? (
            <p className="font-bold">Loading the shame…</p>
          ) : board.length === 0 ? (
            <p className="border-4 border-dashed border-black bg-white p-6 text-center font-bold">
              Nobody&apos;s been cooked yet. Volunteer your repo above. 🫡
            </p>
          ) : (
            <>
              {/* Top 5 — the actual wall */}
              <ol className="flex flex-col gap-4">
                {board.slice(0, 5).map((a, i) => {
                  const short = a.repoUrl.replace("https://github.com/", "");
                  const medal = ["👑", "🥈", "🥉", "🔥", "🔥"][i];
                  return (
                    <li key={a._id}>
                      <Link
                        href={`/r/${short}`}
                        className={`flex flex-col gap-2 border-4 border-black p-4 shadow-[7px_7px_0_0_#000] transition-transform hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none ${
                          i === 0
                            ? "rotate-[-0.7deg] bg-[#FF5D1F] text-white"
                            : "bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-2xl font-black">
                            {medal} #{i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-lg font-bold">
                            {short}
                          </span>
                          <span
                            className={`hidden border-[3px] border-black px-2 py-0.5 text-sm font-black uppercase text-black sm:inline ${TIER_CHIP[a.tier] ?? "bg-white"}`}
                          >
                            {a.tier}
                          </span>
                          <span className="border-[3px] border-black bg-black px-2.5 py-1 font-mono text-2xl font-black text-[#FFE14D]">
                            {a.cookedScore}%
                          </span>
                        </div>
                        <p
                          className={`truncate text-sm font-semibold italic ${
                            i === 0 ? "text-orange-100" : "text-zinc-600"
                          }`}
                        >
                          “{a.headlineRoast}”
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ol>

              {/* The rest */}
              {board.length > 5 && (
                <div className="flex flex-col gap-2">
                  <h3 className="font-mono text-sm font-black uppercase">
                    the rest of the kitchen
                  </h3>
                  <ol className="flex flex-col gap-2" start={6}>
                    {board.slice(5).map((a, i) => {
                      const short = a.repoUrl.replace("https://github.com/", "");
                      return (
                        <li key={a._id}>
                          <Link
                            href={`/r/${short}`}
                            className="flex items-center gap-3 border-[3px] border-black bg-white px-3 py-2 shadow-[4px_4px_0_0_#000] transition-transform hover:bg-[#FFFBEF] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                          >
                            <span className="font-mono font-black">#{i + 6}</span>
                            <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold">
                              {short}
                            </span>
                            <span className="border-2 border-black bg-black px-1.5 py-0.5 font-mono font-black text-[#FFE14D]">
                              {a.cookedScore}%
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </>
          )}
        </section>

        <footer className="text-center font-mono text-xs font-semibold">
          score v1.0 · deterministic checks · agent-chosen sampling · the LLM
          writes the roast, never the number
        </footer>
      </main>
    </div>
  );
}
