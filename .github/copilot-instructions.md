# Copilot instructions for Settings Agent PoC

You are helping with a PoC that uses Appium MCP to explore the default Android Settings app.

## Primary objective

Use Appium MCP tools to safely navigate the Android Settings app and produce reviewable evidence.

## Working style

- Prefer short action-observe loops.
- After each major action, inspect the updated state before deciding the next step.
- Prefer robust navigation over brittle assumptions.
- Treat the current UI hierarchy as the source of truth.
- If a label differs slightly from the prompt, choose the closest safe match.

## Required behavior

- Create an Appium session using `appium/capabilities.android.json`.
- Stay within the Android Settings app unless the task explicitly says otherwise.
- Capture a screenshot and page source at the start, after each major transition, and at the end.
- Write a concise action log into `artifacts/logs/` when possible.
- If a step fails, inspect the current UI and try a safer alternative.
- Stop and report if the only available next steps appear risky or destructive.

## Safety rules

Never intentionally perform destructive or high-risk actions, including:

- factory reset
- erasing data
- removing accounts
- changing lock screen or security settings
- disabling core connectivity in a way that could block the session
- modifying developer options unless explicitly requested
- changing language or locale

## Preferred navigation strategy

1. Observe the current screen.
2. Identify visible tappable targets.
3. Choose the safest action that moves toward the goal.
4. Execute one action.
5. Capture evidence.
6. Re-evaluate.

## Evidence expectations

Use clear file names when saving artifacts, for example:

- `artifacts/screenshots/01-settings-home.png`
- `artifacts/page-source/01-settings-home.xml`
- `artifacts/logs/run-001.md`

## Goal interpretation

For this PoC, success means reliable reachability and traceability, not exhaustive coverage.
