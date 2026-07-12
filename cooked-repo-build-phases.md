# How Cooked Is Your Repo? — Phased Build Plan

**Positioning (post-competitor-check):** Not "a roast tool with a leaderboard" — **the global Cooked Leaderboard, with roasts as the scoring ceremony.** The leaderboard IS the landing page. The share card shows rank, not just score. RoastMyCode.ai owns "paste a link, get roasted"; nobody owns "the most cooked repos on the internet, ranked."

**Rules line:** Phase 0 is entirely pre-event-legal (infra wiring, accounts, planning, Hermes setup — all explicitly sanctioned). Phases 1–6 happen on-site during the 8-hour sprint. No product code before the horn.

---

## PHASE 0 — Pre-Event Setup (do now, before event day)

### 0.1 Hermes environment
- [ ] Install: `curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash`
- [ ] LLM provider:
  - If OpenAI org ID was submitted at registration → `OPENAI_API_KEY` in `~/.hermes/.env`; in `~/.hermes/config.yaml`: provider `openai-api`, model `gpt-5.6-sol`
  - Else → OpenRouter with $10 loaded
- [ ] `hermes status` → confirm green
- [ ] Telegram gateway: @BotFather → `/newbot` → save token; @userinfobot → numeric ID; `hermes gateway setup` → `hermes gateway`
- [ ] DM the bot: "Hello Hermes, reply in one sentence and tell me what tools are active" → confirm reply
- [ ] Checkpoint test: "Give me a one-paragraph setup report: model, tool route, channel, memory, and one thing still missing"
- [ ] Spend 15 min in `hermes skills browse` — understand skill file structure (your product ships as one)
- [ ] Optional: `hermes memory setup` (enables the score-over-time stretch feature)

### 0.2 Accounts & infra (wiring ≠ pre-building, explicitly allowed)
- [ ] **Convex** account + empty project created
- [ ] **Cloudflare** account ready (Pages)
- [ ] **Datafast** account + learn how to generate a read-only dashboard share link (mandatory to break the L2 visitors cap)
- [ ] **GitHub PAT** created + tested (5,000 req/hr vs 60 unauthenticated)
- [ ] **Domain** purchased — short, typeable, "cooked"-themed (part of the IG strategy: people must be able to type it from a reel)
- [ ] **Telegram bot** username claimed (done in 0.1)

### 0.3 Perks & power-up prep
- [ ] LinkUp: create account, claim $50 credits with code `HERMES`
- [ ] Wispr Flow: redeem 3 months via promo link, **install and practice now** (the +25 needs 500+ words dictated during the event — fluency beforehand matters)
- [ ] ElevenLabs: redeem via Discord flow (even if unused in build)
- [ ] Dodo Payments: redeem code from email (optional stretch only)

### 0.4 Planning artifacts (ideas/specs explicitly qualify as legal prep)
- [ ] Finalize the cooked-score checklist: 9 checks, weights, severity multipliers, tier bands (Raw → Burnt)
- [ ] Leaderboard rules doc: eligibility floor thresholds, email-to-claim, one-entry-per-repo
- [ ] Roast voice spec with 5–6 written example roasts (style reference for hour-zero prompting)
- [ ] Landing page wireframe sketch: leaderboard-first layout, input bar on top, doneness meter result state
- [ ] Share card sketch: rank + score + doneness meter + one roast line + URL
- [ ] Hour-zero scaffold prompts pre-written (the exact prompts for Claude Code and Hermes)
- [ ] Launch content drafted: reel script (say the URL out loud), X/LinkedIn post copy, "comment SCORE" automation copy
- [ ] ManyChat (or equivalent) account if using comment→DM automation
- [ ] List of 5 famous repos for one-click roast examples (recognizable, public, safe to roast)
- [ ] Demo script draft using the handbook's template
- [ ] Dry-run the Phase 1 sequence mentally (or on a throwaway project, deleted after)

**Phase 0 exit criteria:** Hermes answers on Telegram; all accounts log in; domain resolves to a parking page; every planning doc exists; you know your first 3 prompts by heart.

---

## PHASE 1 — Infrastructure Live (event hours 0–1)

Goal: retire ALL integration risk before writing product logic.

- [ ] Repo initialized; project-level `CLAUDE.md` created with the full spec pasted in
- [ ] Scaffold web app (standard starter), deploy **empty page to Cloudflare** on the real domain
- [ ] Datafast snippet live on that page → verify a hit appears in dashboard → generate judge read-only link
- [ ] Convex connected to the app; one test write/read round-trip
- [ ] GitHub PAT tested from server function (fetch a repo tree)
- [ ] Hermes reachable from Convex (one round-trip: send text, get reply)
- [ ] Start Wispr word count (dictate specs/notes all day)
- [ ] **Flag architecture to a mentor now** — "Hermes-as-harness via skill + Telegram, does this satisfy the rule?"

**Exit criteria:** a deployed page on the real domain with analytics counting, talking to Convex, which talks to Hermes. Ugly is irrelevant.

---

## PHASE 2 — Core Loop (hours 1–3)

Goal: repo URL in → cooked score + headline roast out, end to end.

- [ ] `cooked-check` Hermes skill v1: checks 1–4 only (no tests, unused deps, debug artifacts, no error handling)
- [ ] Agent-chosen sampling with hard budget (~15 files max); chosen file list recorded in output
- [ ] Intake gates in Convex: URL normalization, 24h cache, size gate (joke error), eligibility floor flag
- [ ] Deterministic score formula + tier bands wired
- [ ] Stage 2 roast prompt: headline roast line from findings
- [ ] Frontend result state: doneness meter + score + tier + headline roast (plain, unstyled OK)
- [ ] Run it on 3 test repos including one famous repo → sanity-check scores feel right

**Exit criteria:** a stranger with the URL can get a real score in <30s.
**→ Hard checkpoint: PHASE 3 STARTS AT HOUR 3 EVEN IF PHASE 2 ISN'T POLISHED.**

---## PHASE 3 — Launch (hour 3, ~30 min, non-negotiable timing)

Goal: traffic starts compounding NOW; you build the rest while it flows.

- [ ] Post the reel on IG (say the URL out loud; link in bio + pinned comment + story link sticker)
- [ ] Same clip natively on X and LinkedIn with clickable links
- [ ] Activate comment→DM automation ("comment SCORE")
- [ ] Roast 1–2 famous repos yourself and post the results as the opening content
- [ ] Tell builders on the floor; get the first 5 submissions

**Exit criteria:** posts live on 3 platforms; first stranger traffic visible in Datafast.

---

## PHASE 4 — Funnel & Moat (hours 3–5)

Goal: convert the traffic (25x parameter) and ship the differentiators.

- [ ] Email gate: full diagnosis (per-finding breakdown + fix list) unlocks on email → Convex `signups`
- [ ] **Leaderboard as landing page**: Most Cooked Hall of Shame, floor enforced, one entry per repo
- [ ] Claim flow: email required to claim a spot with display handle
- [ ] Checks 5–9 added to the skill (dead code, inconsistency, filler comments, README overpromise, over-abstraction)
- [ ] Share card: single HTML template → image; shows **rank + score + roast line + URL**
- [ ] One-click famous-repo buttons on landing (zero-input gratification)
- [ ] **Telegram conversational surface (core, not add-on):** after analysis, Hermes holds context; users ask "why did I lose 15 points?" / "worst file?" / "what do I fix first?" — web result page links "argue with the agent →"

**Exit criteria:** full funnel works: land → analyze → tease → email → full diagnosis → claim rank → share card; Telegram bot answers follow-ups about a real analysis.

---

## PHASE 5 — Distribution Sprint (hours 5–6.5)

Goal: pour fuel on whatever is working; collect the social numbers.

- [ ] Second post: leaderboard screenshot ("current most cooked repo on the internet is…")
- [ ] Reply to every comment; publish the checklist openly to bait weight-debates in comments
- [ ] Seed 20–30 floor builders: run their repos, get them posting their cards (peer-builder amplification tier)
- [ ] Watch anti-spoof ratios in Datafast (visitors ≤10% of impressions; signups ≤50% of visitors) — should hold naturally; never inflate
- [ ] Stretch (only if ahead): Hermes memory for score-over-time; LinkUp enrichment step (+25 only if doing real work)

**Exit criteria:** engagement loop visibly running; leaderboard has 15+ real entries.

---

## PHASE 6 — Proof & Submission (hours 6.5–8)

Goal: convert everything into verifiable score. Submit EARLY.

- [ ] Proof pack: Datafast read-only link ready, Convex signup count queryable live, 2–3 Hermes session traces (showing agent's chosen exploration path), Telegram chat history
- [ ] Screenshot everything with timestamps
- [ ] Submit to the official link **before** the deadline crunch (live URL, not slides)
- [ ] Demo rehearsal ×2: famous repo roast → Telegram "argue with the agent" moment → leaderboard → proof dashboard → finale: **run it on this project's own repo live** ("built entirely with AI in 8 hours — here's its own score")
- [ ] Prepare Q&A answers: the thesis one-liner ("not who wrote it — whether anyone read it"), the deterministic-score defense, the "why Hermes" answer ("the web app is the funnel; the agent is the product")

**Exit criteria:** submitted, rehearsed, proof one click away.

---

## Cut-lines (pre-decided, in order, if any phase overruns)

1. Hermes memory / score-over-time (Phase 5 stretch)
2. LinkUp enrichment
3. Share card image → roast text is screenshot-able anyway
4. Checks 7–9 → six checks still make a credible score
5. Leaderboard claim flow → keep board read-only (keep the email gate!)
6. Agent-chosen sampling → degrade to heuristic sampling (last resort; weakens the agency story)

**Never cut:** Datafast + read-only link, email capture, Hermes skill architecture, Telegram conversational surface, the hour-3 launch.
