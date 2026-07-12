# Hermes runtime — droplet setup

This directory ships to the DigitalOcean droplet. Hermes executes the
`cooked-check` skill per job; `poller.sh` moves jobs between Convex and Hermes.

## Install (once)

```bash
# from your laptop
scp -r hermes/ root@<droplet-ip>:~/cooked/

# on the droplet
cd ~/cooked
chmod +x poller.sh
cp poller.env.example poller.env   # then fill in the values
```

`poller.env`:
```bash
CONVEX_SITE_URL=https://brazen-oyster-161.convex.site
HERMES_SHARED_SECRET=<same value as .env.local on the laptop / Convex env>
GITHUB_PAT=<the fine-grained PAT>
HERMES_CMD="hermes run"   # ⚠️ verify: run `hermes --help` and set the exact
                          # non-interactive invocation (one-shot prompt, auto-
                          # approve tools). May be e.g. `hermes run --yolo` or
                          # `hermes exec` depending on version.
```

## Run

```bash
tmux new -s poller
./poller.sh
# Ctrl-B D to detach
```

For auto-restart on reboot, a systemd unit is nicer (optional):
```ini
# /etc/systemd/system/cooked-poller.service
[Unit]
Description=cooked-check poller
After=network.target
[Service]
WorkingDirectory=/root/cooked
ExecStart=/root/cooked/poller.sh
Restart=always
[Install]
WantedBy=multi-user.target
```

## Verify one round trip

1. Submit a repo at https://cooked-repo.vercel.app (or `curl -X POST .../api/submit`).
2. Watch the poller log claim it.
3. `cat /tmp/cooked-*/hermes-session.log` — the Hermes session trace (KEEP these;
   they're the eligibility proof; copies land in ./session-logs/).
4. The result page updates automatically when the result posts.

## Eligibility proof checklist (for the demo)
- `session-logs/` — Hermes traces showing agent-chosen file exploration
- Telegram: message the bot about an analyzed repo (Phase 4 wiring)
- The answer to "why Hermes?": adaptive exploration + conversational
  interrogation with held context — a plain API call can't do either.
