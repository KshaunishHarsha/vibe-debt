#!/usr/bin/env bash
# cooked-check job poller — runs on the DigitalOcean droplet alongside Hermes.
#
# Loop: claim a pending job from Convex -> have Hermes execute the cooked-check
# skill for that repo -> POST the result back. Hermes is the thing doing the
# analysis; this script is just the conveyor belt.
#
# Required env (put these in poller.env next to this script):
#   CONVEX_SITE_URL       e.g. https://brazen-oyster-161.convex.site
#   HERMES_SHARED_SECRET  same value as on the Convex deployment
#   GITHUB_PAT            passed through to the Hermes run
#   HERMES_CMD            how to invoke hermes non-interactively, e.g. "hermes run"
#                         (check `hermes --help` on the droplet; see README)
#
# Run under tmux/systemd:  ./poller.sh
set -u
cd "$(dirname "$0")"
[ -f poller.env ] && . ./poller.env

SKILL_DIR="$(pwd)/skills/cooked-check"
POLL_INTERVAL="${POLL_INTERVAL:-5}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

while true; do
  RESP=$(curl -s -w '\n%{http_code}' -H "x-hermes-secret: $HERMES_SHARED_SECRET" \
    "$CONVEX_SITE_URL/api/jobs/next")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')

  if [ "$CODE" != "200" ]; then
    [ "$CODE" != "204" ] && log "poll error HTTP $CODE: $BODY"
    sleep "$POLL_INTERVAL"
    continue
  fi

  JOB_ID=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin)["jobId"])')
  REPO_URL=$(echo "$BODY" | python3 -c 'import json,sys;print(json.load(sys.stdin)["repoUrl"])')
  log "claimed job $JOB_ID for $REPO_URL"

  JOB_DIR=$(mktemp -d "/tmp/cooked-XXXXXX")
  cp -r "$SKILL_DIR/scripts" "$JOB_DIR/scripts"
  mkdir -p "$JOB_DIR/work"

  # Hermes executes the skill. The prompt hands it the skill file and the repo;
  # everything else (exploration, scoring via score.py, roast) happens inside
  # the Hermes session. Timeout guards the demo against runaway runs.
  (
    cd "$JOB_DIR"
    REPO_URL="$REPO_URL" GITHUB_PAT="$GITHUB_PAT" timeout 300 \
      $HERMES_CMD "Read the skill instructions at $SKILL_DIR/SKILL.md and execute \
them for REPO_URL=$REPO_URL. Work inside $JOB_DIR (scripts/ and work/ are set up). \
When finished, work/result.json must exist." \
      > hermes-session.log 2>&1
  )

  RESULT_FILE="$JOB_DIR/work/result.json"
  if [ -s "$RESULT_FILE" ]; then
    # Reshape skill output -> Convex contract ({findings:[...] -> findingsJson})
    PAYLOAD=$(python3 - "$JOB_ID" "$RESULT_FILE" <<'PY'
import json, sys
job_id, path = sys.argv[1], sys.argv[2]
data = json.load(open(path))
if "error" in data:
    print(json.dumps({"jobId": job_id, "error": data["error"]}))
else:
    data["findingsJson"] = json.dumps(data.pop("findings", []))
    print(json.dumps({"jobId": job_id, "result": data}))
PY
)
  else
    log "no result.json produced — failing job (see $JOB_DIR/hermes-session.log)"
    PAYLOAD=$(printf '{"jobId":"%s","error":"hermes run produced no result"}' "$JOB_ID")
  fi

  POST=$(curl -s -H "x-hermes-secret: $HERMES_SHARED_SECRET" \
    -H "Content-Type: application/json" \
    -X POST "$CONVEX_SITE_URL/api/jobs/result" -d "$PAYLOAD")
  log "posted result: $POST"

  # Keep session logs as eligibility proof; clean the rest.
  mkdir -p ./session-logs
  cp "$JOB_DIR/hermes-session.log" "./session-logs/$(date +%s)-$JOB_ID.log" 2>/dev/null
done
