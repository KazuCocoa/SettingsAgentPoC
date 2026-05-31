# Task: explore Android Settings safely

Use Appium MCP tools to perform a safe exploratory run in the default Android Settings app.

## Instructions

1. Start an Appium session using `appium/capabilities.android.json`.
2. Confirm that the active app is Android Settings.
3. Capture an initial screenshot and page source.
4. Identify a safe visible target from the current screen.
5. Navigate step by step using short action-observe loops.
6. After each major transition, save a screenshot and page source.
7. Reach at least two safe target pages.
8. Back to a known screen if practical.
9. Write a concise run summary into `artifacts/logs/`.

## Safe targets

Prefer these targets:

- About phone / device info
- Apps
- Display
- Battery
- Storage

## Constraints

- Do not perform destructive actions.
- Do not leave the Settings app intentionally.
- Use the live UI hierarchy rather than assuming exact labels.
- If a target label is different, choose the closest safe equivalent.
- Keep exploration bounded to two safe target pages.
- Do not inspect unrelated repository files or prior artifacts.
- Use Appium MCP screenshot/page-source tools for evidence.
- Do not use shell `adb uiautomator dump` or synthesize XML files.
- Close the Appium session when exploration is complete.

## Expected outputs

- screenshots in `artifacts/screenshots/`
- page source files in `artifacts/page-source/`
- a run log in `artifacts/logs/`
