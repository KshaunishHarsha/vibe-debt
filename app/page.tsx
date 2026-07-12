"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (
        data.status === "cached" ||
        data.status === "queued" ||
        data.status === "already_queued"
      ) {
        const path = data.repoUrl.replace("https://github.com/", "");
        router.push(`/r/${path}`);
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
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          How Cooked Is Your Repo?
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Paste a public GitHub repo, get a deterministic Cooked Score and a roast.
        </p>
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="github.com/owner/repo"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            {submitting ? "Checking..." : "Cook check"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </main>
    </div>
  );
}
