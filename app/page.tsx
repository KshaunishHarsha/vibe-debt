export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          How Cooked Is Your Repo?
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Paste a public GitHub repo, get a deterministic Cooked Score and a roast.
        </p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Scoring pipeline coming online — Phase 1 infra check.
        </p>
      </main>
    </div>
  );
}
