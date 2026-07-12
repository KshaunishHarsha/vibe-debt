# Hermes runtime — VPS setup

Hermes runs on the VPS (167.71.230.193) exposed as an OpenAI-compatible API.
Convex drives it directly: job queued → Convex action calls the Hermes API →
Hermes executes the `cooked-check` skill (agentic exploration + deterministic
scorer) → Convex stores the result. No poller needed in this mode.

## VPS prerequisites (one-time)

1. **Open the API port** (currently unreachable from outside):
   - bind the API server to `0.0.0.0`, not `127.0.0.1`
   - `sudo ufw allow 8642/tcp` — AND check the DigitalOcean cloud firewall
     in the DO dashboard if one is attached
   - verify from any laptop: `curl -m 5 http://167.71.230.193:8642/v1/models -H "Authorization: Bearer <HERMES_API_KEY>"`

2. **Install the skill files** at exactly `/root/cooked/skills/cooked-check/`
   (the Convex action's prompt points there):
   ```bash
   scp -r hermes/skills root@167.71.230.193:/root/cooked/skills
   ```

3. **GITHUB_PAT in the Hermes process environment** (the skill's curl calls use
   it): add `GITHUB_PAT=...` to `~/.hermes/.env` (or the systemd unit / shell
   profile that launches the API server), then restart the Hermes API server.

4. **python3 available** on the VPS (`python3 --version`) — the deterministic
   scorer runs there.

## What's already configured on the Convex side
- `HERMES_API_URL`, `HERMES_API_KEY` set on the deployment
- `convex/hermes.ts` schedules a Hermes run for every queued job, parses the
  result JSON, clamps/validates it, and stores it

## Fallback: droplet-side poller
`poller.sh` + `poller.env.example` implement the original outbound-polling
pattern (droplet polls `/api/jobs/next`, posts to `/api/jobs/result`). Keep as
a fallback if the inbound API path has problems on demo day.

## Verify one round trip
1. Submit a repo at https://cooked-repo.vercel.app
2. Watch the Convex logs (`npx convex logs`) for the runAnalysis call
3. Result page updates automatically when the analysis lands
4. Keep Hermes session traces on the VPS — they're the eligibility proof
   (agent-chosen file exploration must be visible in them)

## Eligibility proof checklist (for the demo)
- Hermes session traces showing agent-chosen file exploration
- Telegram: message the bot about an analyzed repo (Phase 4 wiring)
- The answer to "why Hermes?": adaptive exploration + conversational
  interrogation with held context — a plain API call can't do either.
