# Implementation Notes: Settings Agent PoC Automation

## Overview

This document describes the automated orchestration infrastructure for the Settings Agent PoC, which enables reproducible, end-to-end testing of Android Settings navigation without requiring manual agent intervention.

## Architecture

### Orchestration Flow

```
validate-environment.mjs
    ↓ (check ANDROID_HOME, adb, emulator)
run-explore.mjs
    ↓ (navigate to 2+ safe targets, capture evidence)
validate-artifacts.mjs
    ↓ (check PNG/XML quality, log content)
run-reachability.mjs
    ↓ (execute Home → Apps → Home → About phone → Home)
validate-artifacts.mjs
    ↓ (final check)
generate-report.mjs
    ↓ (summarize findings)
run-report.md
```

**Master entry point:** `scripts/run-poc.mjs`
**CLI interface:** `npm run poc` (and variants)
**Note:** Appium server startup is handled by appium-mcp; validation only checks device prerequisites.

### Component Responsibilities

#### `validate-environment.mjs`
**Purpose:** Pre-flight checks for device and SDK prerequisites.

**Checks:**

**Behavior:**

#### `run-explore.mjs`
**Purpose:** Execute exploratory navigation task (implements `prompts/settings-explore.md`).

**Flow:**
1. Create Appium session
2. Verify Settings app is active (`com.android.settings`)
3. Capture initial home screen (screenshot + page source)
4. For each of 2 safe targets:
   - Find target text in page source
   - Tap target element
   - Capture new screen
   - Return to home (press back 3x)
5. Write run log to `artifacts/logs/run-explore.log`
6. Delete session and exit

**Target priority:**

**Artifacts generated:**

#### `run-reachability.mjs`
**Purpose:** Execute specific navigation sequence (implements `prompts/settings-reachability.md`).

**Flow:**
1. Create Appium session
2. Verify Settings app is active
3. At home: capture state
4. Navigate to Apps (or Applications)
5. Capture state
6. Return to home
7. Navigate to About phone (or About device / Device info)
8. Capture state
9. Return to home
10. Capture final state
11. Write run log to `artifacts/logs/run-reachability.log`
12. Delete session and exit

**Sequence:**
```
Home -> Apps -> [capture] -> Home -> [capture] -> About phone -> [capture] -> Home -> [capture]
```

**Artifacts generated:**

#### `validate-artifacts.mjs`
**Purpose:** Quality assurance for captured artifacts.

**Checks:**

**Behavior:**

#### `generate-report.mjs`
**Purpose:** Generate human-readable summary of all runs.

**Reads:**

**Generates:**
  - Run summaries (extracted from logs)
  - Artifact counts and sizes
  - File listings
  - Recommendations for next steps

#### `run-poc.mjs`
**Purpose:** Master orchestrator that sequences all phases.

**Phases (in order):**
1. Environment validation (skip with `--skip-validation`)
2. Exploration task
3. Artifact validation
4. Reachability task
5. Final artifact validation
6. Report generation

**CLI flags:**

**Behavior:**

### Data Flow

```
Environment
    ↓
    Appium Server (HTTP port 4723)
         ↓
    Android Emulator (via adb)
         ↓
    Settings App
         ↓
    Screenshots (PNG, base64 from driver) → artifacts/screenshots/
    Page Source (XML from driver)          → artifacts/page-source/
    Session Log (JSON from appium-client)  → run-*.log
         ↓
    generate-report.js
         ↓
    artifacts/run-report.md
```

## Safety & Guardrails

### Built-in Safety Measures

1. **Package verification:** Both `run-explore.js` and `run-reachability.js` call `getCurrentPackage()` at startup to ensure Settings app is active before navigation.

2. **Safe targets only:** Navigation targets are hardcoded to safe, read-only pages (About phone, Apps, Display, Battery, Storage).

3. **Text-based navigation:** Uses `tapByText()` to find targets by visible label, making it resilient to UI ID changes.

4. **No destructive actions:** The Appium client does not expose write or delete operations; only tap, back, screenshot, and inspection.

5. **Timeout enforcement:** WebdriverIO imposes action and session timeouts to prevent hanging.

### Failure Modes

| Failure | Recovery | Exit Code |
|---------|----------|-----------|
| ANDROID_HOME not set | Report error, suggest fix, exit | 1 |
| No emulator connected | Report error, suggest emulator start | 1 |
| Appium unreachable | Report error, suggest start | 1 |
| Settings not launching | Log error, exit session | 1 |
| Target not found | Try next target or abort gracefully | 1 |
| Screenshot corrupt | Log warning, continue | 1 |
| Page source malformed | Log warning, continue | 1 |

## File Structure

```
scripts/
    ├─ validate-environment.mjs   (pre-flight checks)
    ├─ appium-client.js          (Appium wrapper)
    ├─ run-explore.mjs            (exploration task)
    ├─ run-reachability.mjs        (reachability task)
    ├─ validate-artifacts.mjs      (quality checks)
    ├─ generate-report.mjs         (report generation)
    └─ run-poc.mjs                 (master orchestrator)
artifacts/
  ├─ screenshots/              (PNG files from runs)
  ├─ page-source/              (XML page sources)
  └─ logs/                      (run-*.log and run-report.md)
.env.example                   (template for configuration)
package.json                   (dependencies: webdriverio)
```

## Environment Variables

Create `.env` file from `.env.example`:

```bash
# Appium Server Configuration (used by appium-client to connect to Appium server)
# Note: appium-mcp manages the server lifecycle automatically
APPIUM_HOST=localhost
APPIUM_PORT=4723

# Android Configuration
ANDROID_HOME=/path/to/android/sdk
ADB_PATH=adb

# Timeout Configuration (in milliseconds)
ACTION_TIMEOUT=30000
SESSION_TIMEOUT=120000

# Run Configuration
LOG_LEVEL=info
SKIP_ENV_VALIDATION=false
```

## Dependencies


Install with:
```bash
npm install
```

## Running the PoC

### Full end-to-end run:
```bash
npm run poc
```

### Exploration only:
```bash
npm run poc:explore
```

### Reachability only:
```bash
npm run poc:reachability
```

### Validate environment first:
```bash
npm run validate-env
```

### Validate existing artifacts:
```bash
npm run validate-artifacts
```

### Generate report:
```bash
npm run report
```

## Troubleshooting

### "ANDROID_HOME is not set"
Set the environment variable:
```bash
export ANDROID_HOME=/path/to/android/sdk
```

### "adb not found"
Ensure Android SDK is installed and `adb` is in PATH:
```bash
which adb
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

### "No active emulator"
Start an emulator:
```bash
emulator -avd <emulator-name> &
adb wait-for-device
```

### "Settings app not launching"
Verify the package name and activity:
```bash
adb shell pm list packages | grep settings
adb shell am start -n com.android.settings/.Settings
```

### "appium-mcp session creation fails"
The appium-mcp server should start Appium automatically. If sessions fail to create:
1. Ensure Node.js and npm are installed
2. Check that `.vscode/mcp.json` is correctly configured
3. Verify emulator is visible: `adb devices`
4. Check MCP server logs for errors

## Notes

