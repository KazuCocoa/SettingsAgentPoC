# Task: prove Settings reachability

Use Appium MCP tools to prove that the coding agent can navigate between major Settings pages and preserve evidence.

## Target sequence

1. Start an Appium session using `appium/capabilities.android.json`.
2. Start at the Settings home screen.
3. Open Apps.
4. Capture evidence.
5. Back to home.
6. Open About phone or the closest device information page.
7. Capture evidence.
8. Back to home if practical.
9. Save a short summary of the route and any ambiguities encountered.

## Rules

- Use the current visible UI as the source of truth.
- Prefer safe, read-only navigation.
- If exact labels are unavailable, choose the closest safe match.
- Stop if the next available action appears risky.
