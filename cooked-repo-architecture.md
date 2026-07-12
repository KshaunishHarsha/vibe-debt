# How Cooked Is Your Repo? — Pipeline Architecture & System Design

**Event:** Hermes Buildathon — Virality Track
**Build window:** 8 hours, on-site
**One-liner:** Paste a public GitHub repo → get a deterministic "Cooked Score" (0–100) measuring unsupervised-AI-code symptoms → free roast + gated full diagnosis → hall-of-shame leaderboard.

> **Note on rules:** This document is a planning artifact (explicitly allowed pre-event). No code from this doc should be written before the sprint starts. All code is written on-site, with Claude Code as builder and Hermes as the runtime engine.

---

## 1. Product Thesis

**It's not about who wrote your code. It's about whether anyone read it.**

The score does NOT detect AI authorship (impossible and wrong — disciplined AI-built code is good code). It detects the **symptoms of unreviewed code**: missing tests, hallucinated dependencies, leftover debug logs, dead code, inconsistent patterns, README overpromising. A well-supervised, 100%-Claude-Code-built repo scores LOW — including this project's own repo, which is the live demo moment.

---

## 2. High-Level Architecture

```
                        ┌─────────────────────────────┐
                        │   Distribution Layer         │
                        │  IG Reel / X / LinkedIn /    │
                        │  bio link / comment auto     │
                        └──────────────┬──────────────┘
                                       │ clicks
                                       ▼
┌───────────────────────────────────────────────────────────────┐
│  FRONTEND — Landing page (Cloudflare Pages)          [+25 pts] │
│  • Repo URL input  • Doneness meter result  • Share card       │
│  • Email gate for full diagnosis  • Leaderboard view           │
│  • Datafast analytics snippet (read-only dashboard for judges) │
└──────────────┬────────────────────────────────────────────────┘
               │ POST /analyze { repoUrl }
               ▼
┌───────────────────────────────────────────────────────────────┐
│  BACKEND — Convex (DB + server functions)            [+25 pts] │
│  • Cache check (repoUrl → existing result?)                    │
│  • Rate limiting / repo size gate                              │
│  • Calls Hermes, persists results, serves leaderboard          │
│  • Stores signups (email → unlock + leaderboard claim)         │
└──────────────┬────────────────────────────────────────────────┘
               │ analysis request
               ▼
┌───────────────────────────────────────────────────────────────┐
│  ENGINE — Hermes agent (the product's actual brain)            │
│  Runs the "cooked-check" SKILL:                                │
│   Stage 1: AGENT-CHOSEN file exploration + fixed deterministic │
│            checks/weights via GitHub API (no clone)            │
│   Stage 2: LLM roast prose over structured findings            │
│  CONVERSATIONAL SURFACE (Telegram, headline feature):          │
│   • Interrogate your roast: "why did I lose 15 pts?",          │
│     "show me the worst file", "how do I fix #3 first?"         │
│   • Hermes holds analysis context across the conversation      │
│   • Memory across sessions: "you were 74% last week, 41 now"   │
└──────────────┬────────────────────────────────────────────────┘
               │ GitHub REST API (authed PAT, 5000 req/hr)
               ▼
        ┌─────────────────┐
        │   GitHub API     │
        │  tree / contents │
        │  / languages     │
        └─────────────────┘
```

**Critical design decision — Hermes placement:** Hermes is not a passthrough or a compliance wrapper. The framing: **the web app is the funnel; the agent is the product.** Hermes contributes three genuine agent capabilities the web app alone cannot deliver:

1. **Agentic repo exploration** — the skill doesn't hardcode which files to read; Hermes explores the tree adaptively (follows imports, samples deeper where it finds smoke), while the *checks and weights stay fixed* so the score remains deterministic. Chosen file list is recorded in output for auditability.
2. **Conversational analysis** — via Telegram, users interrogate their roast in natural language with Hermes holding full analysis context. The web app shows a score; the agent argues about it with you.
3. **Session memory** — returning users get score-over-time continuity ("you un-cooked 33 points since last week").

Convex sends the repo URL to Hermes; Hermes explores, scores, roasts, and returns structured JSON. Session traces are retained as eligibility proof ("Hermes as base harness"), and the Telegram bot lets a mentor verify live from their phone — but eligibility is now a side effect of the design, not its purpose.

---

## 3. The Analysis Pipeline (Two-Stage)

### Stage 0 — Intake & Gate (Convex, <1s)
1. Normalize repo URL (`github.com/owner/repo`, strip `.git`, branches).
2. **Cache check:** if this repo was analyzed in the last 24h → return cached result instantly. Guarantees score consistency + free speed.
3. **Size gate** via GitHub API repo metadata: reject if > ~50MB or > ~2,000 files, with a joke error ("this repo is too enterprise to vibe-check"). Prevents credit burn and demo hangs.
4. **Eligibility floor** flag: repos below the substance bar (< ~5 source files or < ~300 LOC or single-file) still get scored but are marked `leaderboardEligible: false` ("too smol to rank").

### Stage 1 — Deterministic Symptom Checks (Hermes skill, ~5–15s, no cloning)
All via GitHub REST API calls (tree listing + targeted file contents). Each check emits a finding with evidence (file path + line hint where possible).

| # | Symptom | Signal source | Weight (raw pts toward "cooked") |
|---|---------|---------------|------|
| 1 | **No tests** | No test dir/files (`test/`, `__tests__/`, `*.test.*`, `*_test.*`, `spec/`); no test script in package.json | 20 |
| 2 | **Hallucinated / unused dependencies** | Deps declared in package.json / requirements.txt but never imported in sampled source | 15 |
| 3 | **Leftover debug artifacts** | `console.log`, `print(` debugging patterns, `debugger`, `// TODO remove`, commented-out code blocks in sampled files | 12 |
| 4 | **No error handling on IO/network** | fetch/axios/requests/db calls in sampled files with no try/catch or .catch | 12 |
| 5 | **Dead code** | Exported-but-never-imported modules (cross-reference import graph on sampled files) | 10 |
| 6 | **Inconsistent patterns** | Mixed naming conventions, ≥2 different error-handling styles, mixed quote/semicolon styles across files (signature of uncoordinated generation sessions) | 10 |
| 7 | **Filler comments** | Density of generic comments ("// handles the logic", "// helper function") | 6 |
| 8 | **README overpromise** | README feature claims vs. actual file/route existence (Stage 2 assists) | 8 |
| 9 | **Over-abstraction for size** | Interface/abstraction count vs. total LOC ratio | 7 |

- **Sampling strategy — agent-chosen, budget-capped:** never read the whole repo. Manifests + README are always read; beyond that, Hermes *decides* which ~10–15 source files look load-bearing (entry points, followed imports, files where earlier findings suggest deeper smoke) within a hard API-call/token budget. This is a real agent loop — Hermes's tool-use doing adaptive exploration — not a hardcoded fetch list.
- **Auditability guard:** the chosen file list ships in the output JSON. Any run is fully explainable: "here's what the agent looked at and what it found there."
- **Score formula:** `cookedScore = clamp(Σ(triggered weights × severity multiplier), 0, 100)`. The *checks and weights* are fixed and versioned (`v1.0`); combined with the 24h cache, the published score for a given repo is stable. Small variance from exploration paths is acceptable and honest — like two human reviewers reading different files — and the audit trail defends it.
- **Doneness tiers:** 0–20 Raw (suspiciously clean) · 21–40 Rare · 41–60 Medium · 61–80 Well-Done · 81–100 Burnt 💀

### Stage 2 — Roast Generation (Hermes → LLM, ~5–10s)
- Input: the structured findings JSON + 2–3 worst-offending code snippets (short).
- Output: one savage headline roast line (free tier) + per-finding roast paragraphs (gated tier).
- The LLM never touches the number. Prose may vary between runs; the score cannot.
- Roast voice spec: specific > generic (always cite the actual file/line evidence), punch at the code not the coder, self-deprecation-friendly, no profanity beyond mild, meme-literate dev humor.

### Output contract (Hermes → Convex)
```json
{
  "repoUrl": "...",
  "scoreVersion": "v1.0",
  "cookedScore": 67,
  "tier": "Well-Done",
  "headlineRoast": "…",
  "findings": [ { "check": "no_tests", "triggered": true, "evidence": "...", "roast": "…", "fix": "…" } ],
  "leaderboardEligible": true,
  "stats": { "files": 84, "loc": 12400, "languages": ["TypeScript"] }
}
```

---

## 4. Funnel Design (mapped to Virality rubric)

| Rubric parameter | Weight | Mechanism |
|---|---|---|
| **Signups / meaningful actions** | 25x | Email required to: (a) unlock full diagnosis + fix list, (b) claim a leaderboard spot. Both competitive instinct and utility route into the same capture. |
| **Visitors** | 10x | Short memorable domain, bio link, IG story link sticker, pinned comments, clickable posts on X/LinkedIn, comment-keyword DM automation. Datafast read-only dashboard for judges (hard L2 cap without it). |
| **Amplification** | 3x | Share card ("87% cooked 💀") + preloaded famous repos for zero-input roasts + seeding hackathon floor builders. |
| **Reactions/comments** | 2x | "Comment SCORE for the link" automation; publish the checklist openly so devs argue about weights in comments. |
| **Impressions** | 1x | Existing IG reel muscle; same clip natively on X/LinkedIn. Lowest weight — don't over-invest. |

**Anti-spoof guardrails (from rubric):** visitors ≤ 10% of weighted impressions; signups ≤ 50% of visitors. Natural funnel expected to land safely inside both. Never inflate.

**User flow:**
```
Land → paste repo (or 1-click famous repo) → progress state (~15–25s)
  → FREE: cooked % + doneness meter + headline roast + share card download
  → GATE: "See the full diagnosis + how to un-cook it" → email
  → POST-GATE: per-finding breakdown, worst files, fix list,
               "claim your leaderboard spot" (if eligible)
Leaderboard page: Most Cooked Hall of Shame (entry floor enforced,
  claimed entries show handle; unclaimed show repo only)
```

---

## 5. Data Model (Convex)

```
analyses:   { repoUrl (indexed), scoreVersion, cookedScore, tier,
              headlineRoast, findingsJson, stats, leaderboardEligible,
              createdAt }
signups:    { email (indexed), repoUrl?, source ("gate"|"leaderboard"|"waitlist"),
              createdAt }
claims:     { analysisId, email, displayHandle, createdAt }
rateLimits: { ipHash, windowStart, count }
```

Leaderboard = query on `analyses` where `leaderboardEligible`, ordered by `cookedScore` desc, joined with claims. One entry per repoUrl (cache enforces this).

---

## 6. Hermes as the Product (and eligibility as a side effect)

**The answer to "why Hermes?":** *"The web app is the funnel; the agent is the product — it explores your repo like a reviewer would, then argues with you about the results."*

- Analysis logic ships as a **Hermes skill** (`cooked-check`): check definitions, GitHub API tool usage, exploration budget, scoring, and roast prompt. Claude Code *writes* the skill on-site; Hermes *executes* it in production.
- **Three genuine agent capabilities in use:**
  1. **Adaptive exploration** (Stage 1) — Hermes's tool-use decides where to look, within fixed checks/weights.
  2. **Conversational roast interrogation** (Telegram, headline feature) — after analysis, the user asks follow-ups: "why did I lose 15 points?", "show me the worst file", "roast it harder", "what do I fix first?" Hermes answers from held analysis context. No competitor readiness-tool has this; the web app can't do this.
  3. **Cross-session memory** — returning users get "you were 74% last week, 41 now — respect." (Stretch goal, hour 6+.)
- **Two user surfaces:**
  1. Web app → Convex → Hermes (primary funnel; every result page links "argue with the agent → Telegram")
  2. Telegram bot → full conversational experience (also a second signup/retention surface; mentors verify live from their phone)
- Keep Hermes session logs/traces from real user runs for verification.
- **Belt-and-suspenders:** also run 20–30 genuine Hermes chat prompts during the build (scaffolding help, debugging) so coding-partner receipts exist as a secondary eligibility path.
- Flag the architecture to a mentor at **hour 1**, not hour 7.

---

## 7. Infrastructure & Power-Ups

| Component | Choice | Why | Points |
|---|---|---|---|
| Hosting/CDN | **Cloudflare Pages** | Required surface anyway | +25 |
| DB + server functions | **Convex** | Needed anyway for cache/signups/leaderboard | +25 |
| Live search (optional) | **LinkUp** | e.g., enrich roast with "what the internet says about this framework" step — only if it does real work | +25 |
| Dictation | **Wispr Flow** | 500+ words dictated during build (specs, posts, docs) | +25 |
| Analytics | **Datafast** | Handbook-recommended; read-only judge access mandatory to break L2 cap | — |
| GitHub | Personal Access Token | 5,000 req/hr vs 60 unauth | — |
| LLM | OpenAI (event credits) via Hermes `openai-api` provider, or OpenRouter fallback | — | — |

Skipped: ElevenLabs, Dodo (no natural fit; a $1 "premium roast" Dodo paywall is an optional stretch for cross-track Revenue bonus, capped +50 — only if ahead of schedule).

---

## 8. Failure Modes & Mitigations

| Risk | Mitigation |
|---|---|
| Analysis latency kills conversions | No cloning; API-only sampling; live progress UI; cache; target <30s p95 |
| Traffic spike burns credits / hangs | Size gate, per-IP rate limit, queue + "we'll email your roast" fallback (which itself captures email) |
| Score called out as inconsistent | Deterministic score + cache + version stamp; LLM only writes prose |
| Trivial repos game leaderboard | Eligibility floor + shame-board direction (gaming it = submitting cursed repos = content) |
| "It just calls an API, where's Hermes?" | Agent-chosen exploration + conversational interrogation are capabilities a plain API call can't replicate; skill architecture, session traces, live Telegram demo, hour-1 mentor flag |
| Adaptive sampling reintroduces score variance | Checks/weights fixed + versioned; 24h cache stabilizes published scores; audited file list explains any run ("two reviewers read different files") |
| GitHub rate limits | Authed PAT (5k/hr), cache, sampling keeps calls/analysis ~20–40 |
| Private-repo demand lost | Famous-repo one-click examples; paste-a-file mini-roast fallback; "private repos waitlist" checkbox at signup |
| Hour-7 panic | Build order below; cut-lines pre-decided |

---

## 9. Build Order (event day)

| Hours | Deliverable |
|---|---|
| 0–1 | Infra live: Hermes verified, Datafast wired on a deployed empty Cloudflare page, Convex project connected, PAT tested. All integration risk retired first. |
| 1–3 | Core loop end-to-end ugly: input → Convex → Hermes skill (checks 1–4 only) → score + headline roast rendered. |
| **3** | **First post goes out** (reel + X/LinkedIn). Traffic compounds from here. |
| 3–5 | Email gate, full diagnosis view, remaining checks 5–9, share card (single HTML template → image), leaderboard + floor + claims, **Telegram conversational surface (analysis context held for follow-up questions — core feature, not add-on)**. |
| 5–6.5 | Distribution sprint: comment automation, seed floor builders, second post, reply to comments. |
| 6.5–8 | Proof pack: dashboard screenshots, Hermes traces, submission EARLY, demo run-through (finale: score this project's own repo live). |

**Cut-lines if behind (in order):** memory/score-over-time → share card image → checks 7–9 → leaderboard claims (keep the board read-only). If desperate, agent-chosen sampling can degrade to heuristic sampling (score survives; agency claim weakens — cut last). **Never cut:** analytics, email capture, Hermes skill architecture, the Telegram conversational surface, the hour-3 post.

---

## 10. Demo Script Skeleton (4 min)

1. **(2 min demo)** Paste a famous repo live → roast lands → laugh. Then the agent moment: open Telegram, ask the bot *"why did it lose points?"* and *"roast it harder"* — live contextual replies. Show leaderboard.
2. **(1 min proof)** Datafast dashboard (visitors), Convex signups count, a Hermes session trace showing the agent's chosen exploration path, Telegram bot responding live.
3. **(1 min Q&A ammo)** The thesis one-liner; the deterministic-score defense; the finale flex: *"This entire product was built with AI in 8 hours — here's its own score."* → run it on your own repo → low score → mic drop.
