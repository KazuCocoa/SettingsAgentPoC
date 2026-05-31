#!/usr/bin/env bash
set -eu

LOG_FILE="${APPIUM_MCP_LOG_FILE:-artifacts/logs/appium-mcp.log}"
LOG_DIR="$(dirname "$LOG_FILE")"
RUN_ID="${APPIUM_MCP_RUN_ID:-$(date -u '+%Y%m%dT%H%M%SZ')-$$}"

mkdir -p "$LOG_DIR"

{
  printf '\n[%s] [%s] Starting appium-mcp\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RUN_ID"
  printf '[%s] [%s] Command: npx --yes appium-mcp@latest\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RUN_ID"
} >> "$LOG_FILE"

# Keep stdout reserved for MCP protocol messages. Only stderr is captured.
npx --yes appium-mcp@latest 2> >(
  while IFS= read -r line; do
    printf '[%s] [%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RUN_ID" "$line"
  done >> "$LOG_FILE"
)

status=$?
printf '[%s] [%s] appium-mcp exited with status %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RUN_ID" "$status" >> "$LOG_FILE"
exit "$status"
