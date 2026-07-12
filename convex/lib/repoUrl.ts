// Normalize any pasted GitHub URL/shorthand to the canonical
// "https://github.com/owner/repo" form used as the cache/leaderboard key.
// Returns null if it doesn't look like a GitHub repo reference.
export function normalizeRepoUrl(input: string): { url: string; owner: string; repo: string } | null {
  let s = input.trim();
  if (!s) return null;

  // Accept "owner/repo" shorthand
  if (/^[\w.-]+\/[\w.-]+$/.test(s)) s = `https://github.com/${s}`;

  s = s.replace(/^git@github\.com:/i, "https://github.com/");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    return null;
  }
  if (!/(^|\.)github\.com$/i.test(parsed.hostname)) return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!owner || !repo) return null;

  return {
    url: `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`,
    owner,
    repo,
  };
}
