# Product Spec — Cooked Score, Checks, Data Model, Funnel

## Thesis
The score does NOT try to detect "was this written by AI" — that's both undetectable
reliably and the wrong question (well-supervised AI-written code is just good code).
It detects **symptoms of unreviewed code**. A disciplined, 100%-AI-built repo should
score LOW. This project's own repo should score low if run on itself — that's the demo
finale.

## The 9 deterministic checks (fixed weights — version this as `v1.0`)

| # | Check | Signal | Weight |
|---|---|---|---|
| 1 | No tests | No test dir/files, no test script in manifest | 20 |
| 2 | Unused/hallucinated dependencies | Declared in manifest, never imported in sampled files | 15 |
| 3 | Leftover debug artifacts | `console.log`/`print(` debugging, `debugger`, commented-out blocks | 12 |
| 4 | No error handling on IO/network | fetch/axios/requests/db calls with no try/catch or `.catch` | 12 |
| 5 | Dead code | Exported but never imported across sampled files | 10 |
| 6 | Inconsistent patterns | Mixed naming conventions, ≥2 error-handling styles, mixed style across files | 10 |
| 7 | Filler comments | Density of generic comments ("// handles the logic") | 6 |
| 8 | README overpromise | README claims vs. actual files/routes present | 8 |
| 9 | Over-abstraction for size | Interface/abstraction count vs. total LOC | 7 |

`cookedScore = clamp(Σ(triggered weights × severity multiplier), 0, 100)`

**Doneness tiers:** 0–20 Raw · 21–40 Rare · 41–60 Medium · 61–80 Well-Done · 81–100 Burnt 💀

Build checks 1–4 first (Phase 2 — core loop), add 5–9 in Phase 4. If time-constrained,
6 checks still produce a credible score; cut 7–9 first.

## Sampling
- Never full-clone. GitHub REST API only: tree listing + targeted file contents.
- Always read: manifest file(s) (package.json/requirements.txt/etc.), README.
- Agent-chosen beyond that: up to ~10–15 source files, hard budget capped (API calls
  and tokens). See HERMES_USAGE.md for why this is agent-chosen rather than hardcoded.
- Record the chosen file list in the output for auditability.

## Output contract (Hermes skill → Convex)
```json
{
  "repoUrl": "...",
  "scoreVersion": "v1.0",
  "cookedScore": 67,
  "tier": "Well-Done",
  "headlineRoast": "one savage line, free tier",
  "findings": [
    {
      "check": "no_tests",
      "triggered": true,
      "evidence": "path/to/file or general note",
      "roast": "per-finding roast paragraph, GATED tier",
      "fix": "concrete suggestion, GATED tier"
    }
  ],
  "filesExamined": ["list", "of", "paths", "the agent chose to read"],
  "leaderboardEligible": true,
  "stats": { "files": 84, "loc": 12400, "languages": ["TypeScript"] }
}
```

## Eligibility floor (anti-gaming for the leaderboard)
Trivial repos (single file, <~300 LOC, <~5 source files) still get scored and roasted,
but are flagged `leaderboardEligible: false` with a "too smol to rank" badge — itself a
shareable line. This prevents someone submitting a 2-line `add.py` and topping the
"most cooked" board by accident or in bad faith.

## Data model (Convex)
```
analysisJobs: { repoUrl (indexed), status: "pending"|"claimed"|"done"|"failed",
                claimedAt?, createdAt }
analyses:   { repoUrl (indexed), scoreVersion, cookedScore, tier, headlineRoast,
              findingsJson, filesExamined, stats, leaderboardEligible, createdAt }
signups:    { email (indexed), repoUrl?, source: "gate"|"leaderboard"|"waitlist", createdAt }
claims:     { analysisId, email, displayHandle, createdAt }
rateLimits: { ipHash, windowStart, count }
```
- **Job flow:** web app writes an `analysisJobs` row with status `pending` when a repo
  URL is submitted. Hermes (running locally) polls for `pending` jobs, claims one,
  processes it, writes the result to `analyses`, and marks the job `done`. This means
  the web app never calls into Hermes directly — see HERMES_USAGE.md for why.
- Cache: same `repoUrl` within 24h → return cached `analyses` row instantly (speed +
  score stability) without creating a new job.
- Leaderboard query: `analyses` where `leaderboardEligible`, order by `cookedScore` desc,
  left-joined with `claims` for display handle (unclaimed → repo name only).

## Funnel (this is what the product IS, not just a feature list)
**Positioning: the leaderboard is the landing page.** This is a public ranking product;
roasting is the scoring ceremony, not the headline.

1. Land on leaderboard (or one-click a preloaded famous repo for instant example)
2. Paste your own repo URL → progress state (~15–25s target)
3. FREE result: cooked % + tier/doneness meter + headline roast + downloadable share
   card showing **rank** (once eligible) + score + roast line + the site URL
4. GATE (email required): full diagnosis — per-finding breakdown, worst files, fix list
5. Claim your leaderboard spot (email required, sets displayHandle)
6. Telegram link on the result page: "argue with the agent about your score →"

## Guardrails to respect while building
- Email gate must exist before full diagnosis is visible — this is the 25x-weighted
  signup mechanic, don't let it get simplified away.
- Size gate + rate limiting must exist before this goes live publicly (hour 3 launch) —
  a large repo or traffic spike must not hang the demo.
- Roast voice: specific > generic (cite the actual file/evidence), punch at the code not
  the person, self-deprecation-friendly, mild profanity at most, meme-literate.
