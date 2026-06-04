#!/usr/bin/env bash
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="${APPIUM_MCP_LOG_FILE:-artifacts/logs/appium-mcp.log}"
LOG_DIR="$(dirname "$LOG_FILE")"
RUN_ID="${APPIUM_MCP_RUN_ID:-$(date -u '+%Y%m%dT%H%M%SZ')-$$}"

if [[ -d "$HOME/.nvm/versions/node" ]]; then
  for NODE_BIN_DIR in "$HOME"/.nvm/versions/node/*/bin; do
    [[ -d "$NODE_BIN_DIR" ]] && PATH="$NODE_BIN_DIR:$PATH"
  done
fi

if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME/platform-tools" ]]; then
  PATH="$ANDROID_HOME/platform-tools:$PATH"
fi

export PATH
export CAPABILITIES_CONFIG="${CAPABILITIES_CONFIG:-$ROOT_DIR/appium/capabilities.android.json}"
export SCREENSHOTS_DIR="${SCREENSHOTS_DIR:-$ROOT_DIR/artifacts/screenshots}"
export NO_UI="${NO_UI:-true}"

if [[ -n "${APPIUM_MCP_BIN:-}" ]]; then
  COMMAND=("$APPIUM_MCP_BIN")
else
  COMMAND=("npx" "--yes" "appium-mcp@latest")
fi

mkdir -p "$LOG_DIR"

{
  printf '\n[%s] [%s] Starting appium-mcp\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RUN_ID"
  printf '[%s] [%s] Command:' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RUN_ID"
  printf ' %q' "${COMMAND[@]}"
  printf '\n'
} >> "$LOG_FILE"

STDERR_PIPE="${TMPDIR:-/tmp}/appium-mcp-stderr-$RUN_ID.pipe"
mkfifo "$STDERR_PIPE"
trap 'rm -f "$STDERR_PIPE"' EXIT

while IFS= read -r line; do
  printf '[%s] [%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RUN_ID" "$line" >> "$LOG_FILE"
done < "$STDERR_PIPE" &
LOGGER_PID=$!

set +e
"${COMMAND[@]}" 2> "$STDERR_PIPE"
status=$?
wait "$LOGGER_PID"
set -e

printf '[%s] [%s] appium-mcp exited with status %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RUN_ID" "$status" >> "$LOG_FILE"
exit "$status"
