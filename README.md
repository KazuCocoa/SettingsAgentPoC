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

- Codex or VS Code with GitHub Copilot Agent Mode
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
4. Configure Codex or GitHub Copilot in VS Code (with MCP support for appium-mcp).

## Quick Start (LLM-Driven Execution via Agent CLI)

The PoC is designed to be driven by Codex or GitHub Copilot using Appium MCP tools. The default provider is Codex.

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

To use Copilot instead:

```bash
AGENT_PROVIDER=copilot npm run poc
```

This will:
- Validate your Android setup
- Prepare exploration and reachability prompts
- Feed prompts to the selected agent CLI automatically (`codex exec ...` or `copilot -p ...`)
- Let the agent use Appium MCP tools to navigate Settings and capture evidence
- Validate artifacts and generate a report

### How It Works

1. **Environment Check** — `npm run validate-env` ensures you have Android SDK, adb, and an active emulator
2. **Prompt Preparation** — `npm run poc` prepares prompts for the selected agent
3. **LLM Execution** — `npm run poc` executes prompts via Codex CLI or Copilot CLI in non-interactive mode
4. **Evidence Collection** — The agent captures screenshots, page source, and logs navigation
5. **Validation & Reporting** — `npm run poc` validates artifacts and generates a summary report

## Execution Modes

```bash
# Default: end-to-end (Codex CLI execution + finalize)
npm run poc

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

- `AGENT_PROVIDER` — `codex` (default) or `copilot`
- `AGENT_MODEL` — model passed to the selected CLI
- `AGENT_CLI_TIMEOUT_MS` — CLI timeout in milliseconds
- `AGENT_MANUAL_FALLBACK=true` — save prompts instead of failing when the selected CLI is unavailable

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
