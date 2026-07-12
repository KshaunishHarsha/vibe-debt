# Build Phases — Follow This Order

Full rationale lives in the builder's planning doc; this is the condensed version for
in-editor reference. Phase 0 is already done pre-event. **Start from Phase 1 on event day.**

## Phase 1 — Infrastructure live (hour 0–1)
- [ ] **Laptop uptime lockdown (do this first, ~2 min):** plug in charger, disable
  sleep/lid-close suspend, disable auto-updates/restarts for the day, silence
  distracting notifications. Hermes runs locally on this machine all day — if it
  sleeps, the Telegram bot goes dark for everyone in the world, mid-demo or not.
- [ ] `hermes gateway` running in a dedicated terminal tab you will not accidentally close
Deploy an empty page to the real domain on Cloudflare, Datafast snippet confirmed firing,
Convex connected with one test round-trip, GitHub PAT tested, Hermes reachable from
Convex. Flag the Hermes architecture to a mentor now. **Exit: a deployed page, on the
real domain, with analytics counting, talking to Convex, which talks to Hermes.**

## Phase 2 — Core loop (hour 1–3)
`cooked-check` Hermes skill v1 with checks 1–4 only. Agent-chosen sampling with a hard
file budget. Convex intake gates (cache, size gate, eligibility floor). Score formula +
tiers wired. Headline roast generation. Plain/unstyled result page is fine.
**Exit: a stranger with the URL gets a real score in <30s.**

## Phase 3 — Launch (hour 3, ~30 min, do this even if Phase 2 is rough)
Post publicly on IG/X/LinkedIn, link in bio + pinned comment + story sticker, activate
comment→DM automation, roast 1-2 famous repos as opening content.
**This is a hard deadline, not a suggestion — traffic must start compounding by hour 3.**

## Phase 4 — Funnel & moat (hour 3–5)
Email gate for full diagnosis. Leaderboard as the actual landing page (floor enforced,
claim flow). Remaining checks 5–9. Share card (rank + score + roast + URL). Famous-repo
one-click buttons. **Telegram conversational surface — core feature, build this.**
**Exit: full funnel works end to end; Telegram bot answers real follow-up questions.**

## Phase 5 — Distribution sprint (hour 5–6.5)
Second post (leaderboard screenshot). Reply to comments. Seed 20-30 floor builders.
Watch anti-spoof ratios (should hold naturally). Stretch only if ahead: Hermes memory,
LinkUp enrichment.

## Phase 6 — Proof & submission (hour 6.5–8)
Assemble proof pack (Datafast link, Convex counts, Hermes traces, Telegram history).
**Submit early, before deadline crunch.** Rehearse demo twice, ending on running the tool
on this project's own repo live.

## Cut-lines if any phase overruns (in this exact order)
1. Hermes memory / score-over-time
2. LinkUp enrichment
3. Share card image (roast text alone is still screenshot-able)
4. Checks 7–9 (six checks still credible)
5. Leaderboard claim flow (keep board read-only, keep the email gate)
6. Agent-chosen sampling → degrade to heuristic file selection (last resort)

**Never cut:** Datafast + judge read-only link, email capture, the Hermes skill
architecture, the Telegram conversational surface, the hour-3 launch.
