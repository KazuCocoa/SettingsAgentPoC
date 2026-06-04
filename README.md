# Settings Agent PoC

PoC for using a coding agent with Appium MCP to explore the default Android Settings app.

## Goal

Validate whether a coding agent can use Appium MCP to:

- start an Android Appium session
- launch the default Settings app
- inspect the current UI state
- navigate to a few safe target pages
- save screenshots and page source as evidence
- turn successful runs into reusable flows later

This PoC intentionally focuses on **traceability** and **safe exploration** rather than full end-to-end test generation.

## Suggested stack

- Direct Appium MCP runner, or Codex / VS Code with GitHub Copilot Agent Mode
- MCP configuration pointing to `appium-mcp`
- Local Appium server
- Android SDK + emulator
- Appium Inspector for debugging when needed

## Repository layout

```text
settings-agent-poc/
  README.md
  .github/
    copilot-instructions.md
  .vscode/
    mcp.json
  docs/
    poc-goals.md
    guardrails.md
    observations.md
  appium/
    capabilities.android.json
  prompts/
    settings-explore.md
    settings-reachability.md
  artifacts/
    screenshots/
    page-source/
    logs/
```

## Prerequisites

1. Install Node.js.
2. Install Android SDK and create or start an Android emulator.
3. Confirm the emulator is visible through `adb devices`.
4. Ensure `npx appium-mcp@latest` can run in your shell.
5. Configure Codex or GitHub Copilot in VS Code (with MCP support for appium-mcp).

## Quick Start (LLM-Driven Execution)

The PoC can run directly against Appium MCP for bounded Settings routes. Codex and Copilot remain available as alternate providers.

```bash
# 1. Install dependencies
npm install

# 2. Create .env file from template (configure ANDROID_HOME)
cp .env.example .env

# 3. Validate environment (checks Android SDK, adb, emulator)
npm run validate-env

# 4. Run the PoC (auto mode)
npm run poc
```

The Node scripts load `.env` automatically; shell environment variables still override `.env` values.

To use the direct local runner, set:

```bash
AGENT_PROVIDER=direct
```

To use Codex or Copilot instead:

```bash
AGENT_PROVIDER=codex npm run poc
AGENT_PROVIDER=copilot npm run poc
```

This will:
- Validate your Android setup
- Prepare exploration and reachability prompts
- Feed prompts to the selected execution path automatically (`direct`, `codex exec ...`, or `copilot -p ...`)
- Start `appium-mcp` automatically through MCP stdio configuration
- Use Appium MCP tools to navigate Settings and capture evidence
- Validate artifacts and generate a report

### How It Works

1. **Environment Check** — `npm run validate-env` ensures you have Android SDK, adb, and an active emulator
2. **Prompt Preparation** — `npm run poc` prepares prompts for the selected execution path
3. **MCP Startup** — Direct and Codex runs start `appium-mcp` with `scripts/appium-mcp-with-log.sh`; VS Code uses `.vscode/mcp.json`
4. **Execution** — `npm run poc` executes via the direct runner or the selected CLI in non-interactive mode
5. **Evidence Collection** — The runner captures screenshots, page source, and logs navigation
6. **Validation & Reporting** — `npm run poc` validates artifacts and generates a summary report

## Execution Modes

```bash
# Default from .env: end-to-end direct Appium MCP runner + finalize
npm run poc

# Direct Appium MCP runner
AGENT_PROVIDER=direct npm run poc

# Codex CLI execution + finalize
AGENT_PROVIDER=codex npm run poc

# Copilot CLI execution + finalize
AGENT_PROVIDER=copilot npm run poc

# Manual mode: only prepare prompts for agent chat
npm run poc:prepare

# Finalize after manual agent execution
npm run poc:finalize
```

### Individual Task Execution

```bash
# Run specific tasks
npm run poc:explore        # Prepare and execute exploration prompt
npm run poc:reachability   # Prepare and execute reachability prompt
npm run validate-artifacts # Validate captured artifacts (after agent execution)
npm run report             # Generate report from artifacts
```

### CLI Flags

- `--skip-validation` — Skip environment checks
- `--prepare-only` — Prepare prompts only (manual agent execution)
- `--explore-only` — Prepare exploration prompt only
- `--reachability-only` — Prepare reachability prompt only

### Agent Environment Variables

- `AGENT_PROVIDER` — `direct`, `codex`, or `copilot`
- `AGENT_MODEL` — optional model passed to the selected CLI; leave unset to use the CLI default
- `AGENT_CLI_TIMEOUT_MS` — CLI timeout in milliseconds; Codex uses at least 600000ms unless `CODEX_CLI_TIMEOUT_MS` is set
- `CODEX_CLI_TIMEOUT_MS` — optional Codex-specific timeout override in milliseconds
- `CODEX_FAST_MODE=false` — opt out of terse Codex automation instructions; default is enabled for faster Appium runs
- `AGENT_MANUAL_FALLBACK=true` — save prompts instead of failing when the selected CLI is unavailable
- `CODEX_BYPASS_APPROVALS_AND_SANDBOX=false` — opt out of Codex's no-prompt automation mode; default is enabled so MCP tool calls can run non-interactively
- `APPIUM_MCP_ENABLED=false` — disable automatic Appium MCP config injection for Codex
- `APPIUM_MCP_COMMAND` — command used to start Appium MCP; default `bash`
- `APPIUM_MCP_ARGS` — space-separated args for Appium MCP; default `scripts/appium-mcp-with-log.sh`
- `APPIUM_MCP_LOG_FILE` — Appium MCP stderr log path; default `artifacts/logs/appium-mcp.log`

### Appium MCP Logs

Codex logs MCP tool calls in files like `artifacts/logs/settings-explore-codex-output.txt`. The Appium MCP server's own stderr is captured separately:

```bash
tail -f artifacts/logs/appium-mcp.log
```

The wrapper keeps stdout reserved for the MCP protocol, so only stderr is written to the log file.

Report generation uses concise `*.md` run summaries from `artifacts/logs/`. Raw `*-codex-output.txt` files are kept for debugging and are intentionally not embedded in `artifacts/run-report.md`.

## Recommended first tasks

- Open Settings home.
- Navigate to Apps.
- Return to home.
- Navigate to About phone or Device info.
- Save screenshot and page source after each major transition.

## Success criteria

The PoC is successful if the agent can:

- connect to Appium MCP
- create a session with the provided capabilities
- launch and navigate within Android Settings
- recover from small UI differences by inspecting live state
- leave artifacts that allow the run to be reviewed afterward

## Notes

- The exact labels inside Settings vary by Android version, locale, and emulator image.
- Keep the first run read-only when possible.
- Avoid destructive actions.
