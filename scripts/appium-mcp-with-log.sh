#!/bin/sh
set -eu

LOG_FILE="${APPIUM_MCP_LOG_FILE:-artifacts/logs/appium-mcp.log}"
LOG_DIR="$(dirname "$LOG_FILE")"

mkdir -p "$LOG_DIR"

{
  printf '\n[%s] Starting appium-mcp\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '[%s] Command: npx --yes appium-mcp@latest\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
} >> "$LOG_FILE"

# Keep stdout reserved for MCP protocol messages. Only stderr is captured.
exec npx --yes appium-mcp@latest 2>> "$LOG_FILE"
