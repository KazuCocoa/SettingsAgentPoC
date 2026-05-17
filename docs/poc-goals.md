# PoC goals

## Goal

Verify that a coding agent can use Appium MCP to interact with the default Android Settings app in a safe, traceable way.

## Execution contract

1. `npm run poc` is the default end-to-end command.
2. It must prepare prompts, invoke Copilot CLI automatically, and run the scenario.
3. It must validate artifacts and generate a summary report in the same run.
4. Manual mode remains available via `npm run poc:prepare` and `npm run poc:finalize`.

## Mandatory outcomes

1. Start an Appium session successfully.
2. Open the Android Settings app.
3. Capture the initial screen state.
4. Navigate to at least two safe target pages.
5. Return to a known screen when possible.
6. Save screenshots and page source for each major step.
7. Summarize the path taken.

## Safe target pages

Pick at least two:

- Apps
- Network & Internet
- Display
- About phone
- Battery
- Storage

## Non-goals

- Full automation framework design
- Broad destructive testing
- OEM-specific deep settings coverage
- Cross-device consistency in the first iteration

## Evaluation questions

- Can the agent navigate using live UI observation instead of a fully predefined graph?
- Does the agent recover gracefully from small UI or label differences?
- Are the resulting artifacts sufficient for later review and replay design?
