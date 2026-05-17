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
2. Install and run Appium.
3. Install Android SDK and create or start an Android emulator.
4. Confirm the emulator is visible through `adb devices`.
5. Confirm the Settings app package/activity for your emulator if needed.
6. Configure your MCP-capable coding agent to launch `appium-mcp`.

## Run outline

1. Start the Android emulator.
2. Start Appium locally.
3. Open this repo in VS Code.
4. Ensure `.vscode/mcp.json` is recognized by your coding agent host.
5. Open `prompts/settings-explore.md` and ask the agent to execute the task using Appium MCP tools.
6. Review `artifacts/` after the run.

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
