
# Guardrails

**Note:** This PoC is prompt-driven (not chat-driven). All navigation and evidence capture are automated by scripts and prompt files, not by interactive chat.

## Scope

- Platform: Android only
- App: default Settings app
- Mode: safe exploration PoC

## Allowed actions

- Launch Settings
- Scroll safe lists
- Open safe informational pages
- Navigate back
- Capture screenshot
- Capture page source
- Record observations

## Avoid by default

- Toggling critical network state
- Editing accounts
- Resetting preferences
- Clearing data
- Security-sensitive settings
- Language changes
- Accessibility changes
- Developer options changes
- Anything that may lock the device or break automation continuity

## Safer fallback choices

If multiple targets are visible, prefer these in order:

1. About phone / device info
2. Apps
3. Display
4. Battery
5. Storage

## Abort conditions

Stop the run and report the current state if:

- the next available step appears destructive
- the app leaves the Settings package unexpectedly
- the UI becomes blocked by system dialogs that cannot be handled safely
- the session appears unstable or disconnected
