# CLAUDE.md — Project Context for Claude Code

## What this project is

**"How Cooked Is Your Repo?"** — paste a public GitHub repo link, get a deterministic
"Cooked Score" (0–100) measuring symptoms of unreviewed/unsupervised AI-assisted code,
a savage roast, and a spot on a public leaderboard of the most cooked repos on the internet.

**One-liner thesis:** *"It's not about who wrote your code. It's about whether anyone read it."*

**Positioning:** This is NOT primarily "a roast tool." The leaderboard is the landing page.
It's a public ranking with roasts as the scoring ceremony. (Competitor check found several
"paste a repo, get roasted" tools already exist — none of them have a public competitive
leaderboard. That's our differentiation. Lead with rank, not just score.)

---

## ⚠️ CRITICAL: This is being built live at the Hermes Buildathon

This is an 8-hour, on-site hackathon event. **Read `docs/HACKATHON_RULES.md` before writing
any code.** The single most important constraint:

> **Hermes (by Nous Research) must be genuinely load-bearing in this build — either as the
> coding partner, or as the live product harness that real end users interact with.**
> We are using the **harness path**: Hermes must be the thing actually doing the repo
> analysis and talking to users, not a decorative wrapper around logic that lives
> elsewhere. Read `docs/HERMES_USAGE.md` for exactly how this must be architected —
> get this wrong and the whole build is ineligible for judging, regardless of quality.

You (Claude Code) are the **builder** — you write all the application code, the Hermes
skill files, the Convex functions, the frontend. **Hermes is the runtime** — it's a
separate agent process that executes the skill you write, in production, when a real
stranger submits a repo. Do not conflate "I (Claude Code) can analyze a repo just fine
myself" with the product requirement — the product must genuinely route through and be
executed by Hermes at runtime, or the entry is disqualified.

---

## Doc index — read in this order before building

1. **`docs/HACKATHON_RULES.md`** — event rules, eligibility, submission requirements, scoring track
2. **`docs/HERMES_USAGE.md`** — exactly how Hermes must be integrated, skill architecture, what NOT to do
3. **`docs/PRODUCT_SPEC.md`** — the product itself: scoring checklist, tiers, data model, funnel
4. **`docs/BUILD_PHASES.md`** — the hour-by-hour build order and cut-lines; follow this sequence, don't freelance the order

---

## Non-negotiable build-order reminder

The single biggest scoring lever in this hackathon is **posting a working version publicly
by hour 3 of the event**, even if ugly. Every planning decision defers to that deadline.
If you (Claude Code) are asked to keep polishing past hour 3 without a live public URL
posted, flag it — don't let politeness override the deadline.

---

## Non-negotiables (don't compromise on these even under time pressure)

- Cooked score must be **deterministic**: same checks, same weights, versioned (`v1.0`).
  The LLM only writes roast prose — never let the LLM generate or adjust the numeric score.
- Analytics (Datafast) must be wired **before** anything is posted publicly — there's a
  hard scoring cap without a judge-accessible read-only dashboard.
- The repo-analysis capability must live as a **Hermes skill**, executed by Hermes at
  runtime — see `docs/HERMES_USAGE.md`.
- Never clone full repos — use the GitHub REST API with a personal access token, sampled
  files only. Full clones are slow, expensive, and unnecessary.
- Email is required before the full diagnosis is shown, and before a leaderboard spot
  can be claimed. This is the core monetization-of-attention mechanic — don't let it get
  scoped out under time pressure.
