# Hackathon Rules — Hermes Buildathon

Source of truth: https://growthx.club/docs/hermes-buildathon-builder-handbook
(If anything here seems ambiguous or you're about to make an architectural call that
touches eligibility, the builder should ask a mentor — don't guess silently.)

## Event shape
- 8-hour on-site build sprint. Kickoff → build → live demos (4 min each: 2 min demo,
  1 min proof, 1 min Q&A).
- Track chosen: **Virality** (impressions, engagement, signups — not Revenue or
  AI-as-Agency).
- Submission must be a **live, usable URL** — no slides, no zip files.

## Core eligibility rule (the one that can zero the whole build)
Every build must use Hermes in one of two ways:
1. **As coding partner** — Hermes writes the code, with session logs as proof. (NOT our path.)
2. **As base harness** — the product runs on Hermes, and real end users interact with it.
   At least one Hermes capability must be shown doing real work. **This is our path.**

Because we're on the harness path, Claude Code (this tool) is fine to use as the dev
tool for scaffolding, the frontend, Convex functions, etc. — but the actual repo-analysis
logic that a real stranger's request triggers must be executed by Hermes at runtime,
not just written by Claude Code and run as a plain function. See `HERMES_USAGE.md`.

## Fresh-build rule
- Builds must be started fresh on-site. Pre-event work is limited to: infra/account
  wiring (Convex, Cloudflare, Datafast, GitHub PAT, domain purchase), Hermes environment
  setup, and planning artifacts (specs, wireframes, roast examples, pre-written prompts).
- No product code, no skill files, no scoring logic should exist in a repo before the
  event starts. If Claude Code is asked to "continue" work from before the event that
  looks like actual app logic (not infra/config), flag it.

## Verification
- Mentors and judges independently verify metrics: live DB checks, traffic
  cross-checks, and they may ask to see a specific Hermes session/run as proof.
- Keep Hermes session traces available and easy to pull up during the demo.

## Virality track scoring (weights — this is what the architecture optimizes for)

| Parameter | Weight | Notes |
|---|---|---|
| Signups / meaningful actions | 25x | By far the biggest lever. Everything should funnel here. |
| Visitors to product | 10x | Hard-capped at a low tier without a judge-readable analytics dashboard. |
| Amplification quality | 3x | Notable reshares / peer builders engaging. |
| Reactions/comments | 2x | |
| Impressions/views | 1x | Lowest weight — don't over-invest build time here. |

**Anti-spoof guardrails:** visitors must stay ≤10% of weighted impressions, and signups
≤50% of visitors, or those parameters zero out. Don't inflate traffic artificially —
a naturally converting funnel lands inside these ratios anyway.

**Power-ups (flat +25 each) for genuinely using partner tools:**
- Convex (our DB — natural fit, use it for real)
- Cloudflare (our hosting — natural fit)
- LinkUp (only if it does real work, e.g. a live-search enrichment step — don't bolt it
  on decoratively just for points)
- Wispr Flow (500+ words dictated during the build day — unrelated to the product itself)
- ElevenLabs / Dodo Payments — skip unless a natural fit emerges (e.g. a paid "premium
  roast" tier via Dodo, which is a stretch goal only)

**Cross-track bonus:** capped at 50 pts for incidental wins outside Virality (e.g. if
a Dodo paywall generates a little real revenue). Not a priority — don't build for it.

## What "counts" as pre-building vs. legitimate prep (know this line)
- ✅ OK: buying a domain, creating empty Convex/Cloudflare projects, installing Hermes,
  wiring the Telegram gateway, writing specs/wireframes/example roasts, drafting social
  posts, pre-writing prompts you'll paste in at hour 0.
- ❌ Not OK: writing the actual scoring skill, the frontend components, the Convex
  schema/functions, or any file that is part of the shipped product, before the event
  clock starts.
