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

- VS Code with GitHub Copilot Agent Mode
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
4. Configure GitHub Copilot in VS Code (with MCP support for appium-mcp).

## Quick Start (LLM-Driven Execution via Copilot CLI)

The PoC is designed to be driven by GitHub Copilot using Appium MCP tools. The workflow:

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

This will:
- Validate your Android setup
- Prepare exploration and reachability prompts
- Feed prompts to Copilot CLI automatically (`copilot -p ...`)
- Let Copilot use Appium MCP tools to navigate Settings and capture evidence
- Validate artifacts and generate a report

### How It Works

1. **Environment Check** — `npm run validate-env` ensures you have Android SDK, adb, and an active emulator
2. **Prompt Preparation** — `npm run poc` prepares prompts with tool definitions for Copilot
3. **LLM Execution** — `npm run poc` executes prompts via Copilot CLI in non-interactive mode
4. **Tool Usage** — Copilot has access to Appium MCP tools:
   - `create_session` / `delete_session` — Manage Appium sessions
   - `take_screenshot` / `get_page_source` — Capture evidence
   - `find_element` / `tap_element` — Navigate UI
   - `press_back` — Go back
   - `get_current_package` — Verify Settings app
5. **Evidence Collection** — Copilot captures screenshots, page source, and logs navigation
6. **Validation & Reporting** — `npm run poc` validates artifacts and generates a summary report

## Execution Modes

```bash
# Default: end-to-end (Copilot CLI execution + finalize)
npm run poc

# Manual mode: only prepare prompts for Copilot Chat
npm run poc:prepare

# Finalize after manual Copilot Chat execution
npm run poc:finalize
```

### Individual Task Execution

```bash
# Run specific tasks
npm run poc:explore        # Prepare exploration prompt for Copilot
npm run poc:reachability   # Prepare reachability prompt for Copilot
npm run validate-artifacts # Validate captured artifacts (after Copilot execution)
npm run report             # Generate report from artifacts
```

### CLI Flags

- `--skip-validation` — Skip environment checks
- `--prepare-only` — Prepare prompts only (manual Copilot Chat execution)
- `--explore-only` — Prepare exploration prompt only
- `--reachability-only` — Prepare reachability prompt only

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
