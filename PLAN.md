# Cooked Score — Phase 1 + Phase 2 Build Plan

## Context

This is "How Cooked Is Your Repo?" — a hackathon entry for the Hermes Buildathon
(Virality track). Paste a public GitHub repo → get a deterministic 0–100 "Cooked Score"
(symptoms of unreviewed AI code), a roast, and a leaderboard spot. Full spec lives in
`PRODUCT_SPEC.md`, `HERMES_USAGE.md`, `HACKATHON_RULES.md`, `BUILD_PHASES.md` (all read).

The repo currently contains only planning docs (Phase 0 — pre-event prep, explicitly
allowed). No product code exists yet, which is correct per the fresh-build rule. This
plan covers **Phase 1 (infra live) + Phase 2 (core loop)** from `BUILD_PHASES.md`, so
the two phases can be executed back-to-back on event day without re-planning mid-flight.

**Deviation from docs, confirmed with user:** hosting is **Vercel**, not Cloudflare
Pages. This forfeits the Cloudflare +25 power-up — that's an accepted tradeoff, not an
oversight. Convex +25 still applies. Everything else (Datafast, GitHub PAT, Hermes
droplet) is unaffected by this swap.

**Confirmed already done (Phase 0):** DigitalOcean droplet with Hermes running and
`hermes gateway` up, Convex project created, GitHub PAT generated, Datafast account
ready. Domain/Vercel project not yet confirmed live — treat as the first infra step.

**The one architectural rule everything below must satisfy:** Convex never calls Hermes
directly. Convex only writes/reads rows. Hermes polls Convex for pending jobs and writes
results back. This is what makes Hermes the actual runtime engine (base-harness
eligibility) rather than a decorative wrapper — see `HERMES_USAGE.md`.

---

## Phase 1 — Infrastructure Live

Goal: retire all integration risk before any scoring logic is written.

### 1. Web app scaffold
- Next.js app (App Router) — pairs naturally with both Vercel and Convex's official
  Next.js client (`convex/react`, `ConvexProvider`).
- Deploy an empty landing page to Vercel on the real domain immediately (`vercel --prod`
  or connect the GitHub repo to a Vercel project for auto-deploy on push).

### 2. Datafast analytics
- Add the Datafast snippet to the root layout.
- Verify a hit registers in the Datafast dashboard from the deployed page.
- Generate the judge-facing read-only dashboard link (mandatory — hard-caps the
  Visitors score parameter without it per `HACKATHON_RULES.md`).

### 3. Convex wiring
- `npx convex dev` / `convex init` to connect the existing empty Convex project to this
  repo.
- Define the initial schema in `convex/schema.ts` per `PRODUCT_SPEC.md` §Data model:
  - `analysisJobs`: `{ repoUrl (indexed), status: "pending"|"claimed"|"done"|"failed", claimedAt?, createdAt }`
  - `analyses`: `{ repoUrl (indexed), scoreVersion, cookedScore, tier, headlineRoast, findingsJson, filesExamined, stats, leaderboardEligible, createdAt }`
  - `signups`: `{ email (indexed), repoUrl?, source, createdAt }`
  - `claims`: `{ analysisId, email, displayHandle, createdAt }`
  - `rateLimits`: `{ ipHash, windowStart, count }`
- One test round-trip: a mutation that writes a row, a query that reads it back,
  exercised from the Next.js page to confirm the client is wired correctly.

### 4. GitHub PAT test
- A Convex action (`convex/github.ts`) that calls the GitHub REST API (repo tree
  endpoint) using the PAT from Convex env vars, to confirm auth + rate limit headers
  look right (5000/hr). This action's tree-fetching logic will later be reused/exposed
  as the tool Hermes calls — but for Phase 1 it's just a connectivity test.

### 5. Hermes ↔ Convex round trip (the critical-path item)
Hermes runs on the droplet and must reach Convex over HTTP (outbound from Hermes, per
`HERMES_USAGE.md`'s queue/polling pattern — never Convex calling Hermes).
- Expose two Convex **HTTP actions** (`convex/http.ts`), guarded by a shared-secret
  header (env var on both the droplet and Convex) since these are public endpoints:
  - `GET /api/jobs/next` — atomically claims the oldest `pending` `analysisJobs` row
    (sets status → `claimed`, `claimedAt`), returns it or `204` if none.
  - `POST /api/jobs/result` — accepts the output-contract JSON from `PRODUCT_SPEC.md`
    §Output contract, writes an `analyses` row, marks the job `done`.
- On the droplet: confirm Hermes (or a simple test script first) can `curl` both
  endpoints successfully — write a test job manually via the Convex dashboard, confirm
  the `next` endpoint returns it, confirm posting a fake result marks it `done`.
- **Flag this architecture to a mentor now** (manual step for the user, not code) —
  per the hour-1 checklist in `HACKATHON_RULES.md` and `BUILD_PHASES.md`.

**Phase 1 exit criteria:** deployed page on the real domain, Datafast counting, Convex
read/write confirmed, GitHub PAT confirmed, and one real Hermes-claims-a-job round trip
proven end to end.

---

## Phase 2 — Core Loop

Goal: repo URL in → cooked score + headline roast out, end to end, in <30s.

### 1. `cooked-check` Hermes skill v1 (checks 1–4 only)
Written as an actual Hermes skill file (format per whatever `hermes skills browse`
showed in Phase 0 — verify the exact on-disk convention on the droplet before writing
this, since it wasn't captured in the docs read so far). Skill must define:
- Tool access: GitHub REST API (tree listing + file contents) using the same PAT
  tested in Phase 1.
- Sampling policy: always read manifest (package.json/requirements.txt/etc.) + README;
  agent-chosen beyond that, up to ~10–15 files, hard budget cap.
- The four checks, weights, and evidence format from `PRODUCT_SPEC.md`:
  1. No tests (20) · 2. Unused/hallucinated deps (15) · 3. Debug artifacts (12) ·
     4. No error handling on IO/network (12)
- Fixed scoring formula: `cookedScore = clamp(Σ(triggered weights × severity), 0, 100)`
  — the skill must never let the LLM adjust this number, only write roast prose.
- Output must match the JSON contract in `PRODUCT_SPEC.md` exactly, including
  `filesExamined` for auditability.
- Polling loop: skill (or a wrapper script Hermes runs) hits `GET /api/jobs/next` on an
  interval, and on a claimed job, runs the skill, then `POST /api/jobs/result`.

### 2. Convex intake gates (before a job is even queued)
In the mutation that creates an `analysisJobs` row:
- Normalize the repo URL (strip `.git`, trailing slash, branch refs → `owner/repo`).
- 24h cache check: if an `analyses` row for this `repoUrl` exists and is <24h old,
  return it directly — no new job.
- Size gate: use the GitHub PAT action from Phase 1 to check repo metadata, reject
  >~50MB or >~2000 files with a joke error message.
- Eligibility floor: compute from repo stats and set `leaderboardEligible: false` for
  <~5 source files or <~300 LOC — still scored, just flagged.

### 3. Frontend result flow
- Input page: repo URL field → calls the Convex mutation → gets back either a job id
  (pending) or an immediate cached result.
- Result page: polls (Convex's reactive `useQuery` handles this for free once the
  `analyses` row appears) and renders — doneness meter, `cookedScore`, `tier`,
  `headlineRoast`. Plain/unstyled is explicitly fine per the docs at this stage.

### 4. Sanity test
Run the full pipeline on 3 repos (including one famous public repo) and confirm scores
feel directionally right before moving to Phase 3 (launch).

**Phase 2 exit criteria:** a stranger with the URL gets a real score in under 30 seconds,
with Hermes as the thing that actually produced it (not Claude Code, not a plain Convex
function).

---

## Key files to create
- `convex/schema.ts` — data model above
- `convex/http.ts` — the two Hermes-facing HTTP actions (shared-secret guarded)
- `convex/analysisJobs.ts` — createJob mutation (intake gates), claim/result internal logic
- `convex/analyses.ts` — cache lookup query, leaderboard query (used later in Phase 4)
- `convex/github.ts` — GitHub REST API action (tree/contents/metadata), PAT from env
- `app/page.tsx` — landing/input page
- `app/result/[id]/page.tsx` (or similar) — result view wired to `useQuery`
- Hermes skill file for `cooked-check` — location/format TBD, confirm via
  `hermes skills browse` on the droplet before writing

## Verification
- Phase 1: manually create a test `analysisJobs` row via the Convex dashboard, curl
  `GET /api/jobs/next` from the droplet, confirm it returns the row and flips it to
  `claimed`; curl `POST /api/jobs/result` with a fake payload, confirm the `analyses`
  row appears and the job flips to `done`.
- Phase 2: submit a real public repo URL through the deployed Next.js page, watch
  Hermes claim and process the job via its session log/trace, confirm the result
  renders on the page within ~30s with a plausible score and roast. Repeat for 2 more
  repos including one famous one.
