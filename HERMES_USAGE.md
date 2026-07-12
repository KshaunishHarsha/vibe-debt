# Hermes Usage Guide — How This Product Must Integrate Hermes

Read this before writing the analysis pipeline. This is the highest-risk part of the
build from an eligibility standpoint — get the architecture right and it also happens
to make the product genuinely better, not just compliant.

## The framing to build toward

**"The web app is the funnel; the agent is the product."**

Don't build Hermes as a thin passthrough (web app receives a repo URL → calls an LLM API
directly → Hermes never actually touches it). That fails the base-harness rule outright.
Instead, Hermes should be doing three things a plain API call can't:

1. **Agentic file exploration** (Stage 1 of analysis)
2. **Conversational interrogation of results** (Telegram — a headline feature, not an add-on)
3. **Cross-session memory** (stretch goal, lower priority)

## Architecture: what lives where

**Hosting update:** Hermes runs on a **DigitalOcean VPS** (droplet), not the builder's
laptop. This removes the laptop-uptime tradeoff entirely — the droplet is always-on
regardless of whether the laptop is asleep, closed, or off the venue wifi. The
"terminal backend" setting inside Hermes itself should still be **Local**, because from
the droplet's own point of view, Hermes is running directly on the machine it's on
(the VPS) — Local just means "don't shell out to Docker/Modal/SSH for tool execution,"
which is still correct when Hermes's whole process lives on the droplet.

Because the droplet has a public IP, it CAN accept inbound connections — meaning Convex
could call Hermes directly instead of polling. We still recommend the **queue/polling
pattern** below anyway: it's resilient to droplet reboots, deploys, or brief network
blips, and it means the web app's request path never blocks on Hermes being reachable
at that exact instant. Treat direct inbound calls as an optional later optimization,
not the day-one design.

```
Frontend (Cloudflare Pages) — fully cloud-hosted, always live
   → Convex (DB + server functions) — fully cloud-hosted, always live
      → leaderboard, share cards, email gate all read/write Convex directly
      → analysis requests get queued as pending rows in Convex (see below)

Hermes (running on a DigitalOcean droplet, always-on)
   → polls Convex for pending analysis jobs (OUTBOUND call from the droplet)
   → OR: a user messages the Telegram bot directly with a repo URL
   → either way: Hermes runs the cooked-check skill
      - AGENT-CHOSEN file exploration via GitHub API (no clone)
      - FIXED deterministic checks/weights → score
      - LLM roast prose on top
   → Hermes writes the result back to Convex via its public HTTP endpoint (OUTBOUND)
   → web app picks up the new row on its next read
```

**Why a queue instead of a synchronous call (still true even with an always-on VPS):**
having the web app write a "pending" row to Convex and having Hermes poll for and claim
pending jobs (rather than the web app calling Hermes directly) means a droplet restart,
deploy, or traffic spike just delays processing instead of breaking the request. It also
means the two user surfaces (web app and Telegram) share exactly one execution path —
Hermes is the only thing that ever produces an `analyses` row.

**Droplet operational notes:**

- Run `hermes gateway` inside a process manager that survives SSH disconnects and
  reboots — `tmux`/`screen` at minimum for the day, `systemd` or `pm2` if you want it to
  auto-restart on crash or droplet reboot without you SSHing back in.
- SSH key access to the droplet should be set up in Phase 0 (pre-event), not discovered
  mid-build.
- Since the droplet is reachable independent of the venue wifi/laptop, this is also what
  keeps the Telegram bot (and hence the whole product) alive through the demo and
  afterward — worth mentioning in the demo's proof segment as a legitimacy signal
  ("this keeps running after today").

**Critical constraint on the score:** the _checks and weights_ are fixed and versioned.
The _files examined_ can be agent-chosen (real agency). This gets you genuine Hermes
agency without breaking score reproducibility — if someone re-runs the same repo and
gets a slightly different score because different files were sampled, that's defensible
("two reviewers read different files") as long as the score formula itself never changes
and results are cached for 24h so repeat requests are stable.

## The skill itself

Build this as an actual Hermes skill (not a hardcoded function Convex calls that happens
to route through Hermes as a formality). Structure:

- Skill definition includes: the 9 check definitions with weights (see PRODUCT_SPEC.md),
  the GitHub API tool access it needs, the sampling budget, the scoring formula, and the
  roast-writing prompt/voice guide.
- Hermes should have tool access to hit the GitHub REST API directly (repo tree, file
  contents, languages) — this is what makes the exploration "agentic" rather than
  Claude Code pre-deciding a fixed file list.
- Output must be structured JSON matching the schema in PRODUCT_SPEC.md, including the
  list of files it actually examined (for auditability — a mentor or skeptical user
  should be able to see exactly what the agent looked at).

## The Telegram surface — build this as a headline feature, not a checkbox

After a repo is analyzed, the same Hermes session (with the analysis held in context)
should be reachable via the Telegram bot so a user can ask follow-up questions:

- "why did I lose 15 points?"
- "show me the worst file"
- "roast it harder"
- "what do I fix first?"

This is the single strongest eligibility signal AND the most differentiated product
feature (no competitor "roast my repo" tool has this). Don't deprioritize it under time
pressure — it's on the "never cut" list in BUILD_PHASES.md.

Practically: when a repo is analyzed via the web app, store the Hermes session/context
reference alongside the result so the Telegram bot can resume that exact analysis
context if the user (or a mentor, for verification) messages the bot about it.

## Verification / proof

- Keep raw Hermes session logs from real analysis runs. During the demo, be ready to
  pull up: (a) a session trace showing the agent's file-exploration path, (b) a live
  Telegram exchange where the bot answers a follow-up question about a real analysis.
- If a mentor asks "why does this need Hermes and not just a script," the answer is:
  adaptive exploration + conversational interrogation with held context are genuine
  agent capabilities, not decoration.

## What NOT to do

- Don't have Claude Code (this tool) write the actual repo-scanning/scoring logic as a
  plain Node/Python function that Convex calls directly, with Hermes bolted on
  afterward just to say it was "used." That is the exact failure mode that gets builds
  disqualified.
- Don't let the LLM (inside the Hermes skill) generate or influence the numeric score —
  only the fixed deterministic weights do that. LLM = roast prose only.
- Don't full-clone repos. GitHub REST API + sampled file contents only — full clones are
  slow and unnecessary for this depth of analysis.
- Don't skip the hour-1 mentor flag on this architecture. Ambiguity about eligibility is
  much cheaper to resolve at hour 1 than discovered at hour 8.
