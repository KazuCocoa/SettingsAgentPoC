#!/usr/bin/env node

/**
 * Master orchestrator for Settings Agent PoC
 * Prepares environment, guides user to execute prompts via GitHub Copilot Chat
 * Validates artifacts and generates reports
 */

import { execSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const skipValidation = args.includes('--skip-validation');
const exploreOnly = args.includes('--explore-only');
const reachabilityOnly = args.includes('--reachability-only');
const finalize = args.includes('--finalize');
const prepareOnly = args.includes('--prepare-only');

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${message}`);
}

function runCommand(label, command) {
  log('INFO', `Running: ${label}`);

  try {
    execSync(command, { stdio: 'inherit' });
    log('OK', `${label} completed successfully`);
    return true;
  } catch (err) {
    log('ERROR', `${label} failed with exit code ${err.status}`);
    return false;
  }
}

function printInstructions(taskName, promptPath) {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                  LLM-DRIVEN TASK INSTRUCTIONS                      ║
╚════════════════════════════════════════════════════════════════════╝

Task: ${taskName}
Prompt: ${promptPath}

STEP 1: Open the Prompt
─────────────────────
1. In VS Code, open the prompt file: ${promptPath}
2. Or copy the prompt from: artifacts/logs/${taskName}-prompt.txt

STEP 2: Start GitHub Copilot Chat
──────────────────────────────────
1. Open GitHub Copilot Chat in VS Code (Cmd+Shift+I on macOS, Ctrl+Shift+I on Windows/Linux)
2. Select a code file or open the prompt file above

STEP 3: Ask Copilot to Execute
───────────────────────────────
1. Paste the prompt into Copilot Chat
2. Or ask: "Read this prompt and execute it using the available tools"

STEP 4: Available Tools for Copilot
────────────────────────────────────
Copilot has access to these tools (via Appium MCP):

  • create_session          - Create Appium session for Settings
  • delete_session          - Cleanup session
  • take_screenshot         - Capture screen (filename param)
  • get_page_source         - Capture page XML (filename param)
  • find_element            - Find element by text
  • tap_element             - Tap element by text
  • press_back              - Press Android back button
  • get_current_package     - Verify Settings app active
  • log_action              - Log decisions/actions

STEP 5: Safety Guidelines
─────────────────────────
✓ Read-only navigation (no destructive actions)
✓ Safe targets only: About phone, Apps, Display, Battery, Storage
✓ Always verify package is com.android.settings
✓ Capture evidence (screenshots + page source) at each step

STEP 6: What to Expect
──────────────────────
- Copilot will analyze the current screen
- Decide actions based on visible UI
- Recover from label variations (About device vs About phone)
- Navigate safely and capture evidence
- Log the navigation path

═══════════════════════════════════════════════════════════════════════
`);
}

async function main() {
  log('INFO', '=== Settings Agent PoC Orchestrator (LLM-Driven) ===');
  log('INFO', `Mode: ${finalize ? 'finalize (post-Copilot validation/report)' : prepareOnly ? 'prepare-only (manual Copilot Chat)' : 'auto (Copilot CLI + finalize)'}`);
  log('INFO', 'Execution model: Copilot CLI + Appium MCP tools');

  // Phase 1: Environment validation
  if (!skipValidation) {
    log('INFO', '\n=== Phase 1: Environment Validation ===');
    const envValid = runCommand('Environment validation', 'node scripts/validate-environment.mjs');

    if (!envValid) {
      log('ERROR', 'Environment validation failed. Please fix issues and try again.');
      process.exit(1);
    }
  }

  if (!finalize) {
    // Phase 2: Exploration task
    if (!reachabilityOnly) {
      log('INFO', '\n=== Phase 2: Exploration Task ===');
      log('INFO', 'Running prompt executor to prepare exploration task...');
      const exploreSuccess = runCommand(
        'Exploration setup',
        'node scripts/run-explore.mjs'
      );

      if (exploreSuccess) {
        if (prepareOnly) {
          printInstructions('settings-explore', 'prompts/settings-explore.md');
        }
      } else {
        log('ERROR', 'Failed to prepare exploration task');
        process.exit(1);
      }
    }

    // Phase 3: Reachability task
    if (!exploreOnly) {
      log('INFO', '\n=== Phase 3: Reachability Task ===');
      log('INFO', 'Running prompt executor to prepare reachability task...');
      const reachSuccess = runCommand(
        'Reachability setup',
        'node scripts/run-reachability.mjs'
      );

      if (reachSuccess) {
        if (prepareOnly) {
          printInstructions('settings-reachability', 'prompts/settings-reachability.md');
        }
      } else {
        log('ERROR', 'Failed to prepare reachability task');
        process.exit(1);
      }
    }

    if (prepareOnly) {
      log('INFO', '\n=== Prepare Mode Complete ===');
      log('INFO', 'Execute prompts in Copilot Chat first, then run: npm run poc:finalize');
      process.exit(0);
    }
  }

  // Finalize mode: validate/report after Copilot execution
  log('INFO', '\n=== Phase 2: Artifact Validation ===');
  log('INFO', 'Checking artifacts captured by Copilot...');
  const artifactsValid = runCommand('Artifact validation', 'node scripts/validate-artifacts.mjs');

  if (!artifactsValid) {
    log('ERROR', 'Artifact validation failed. Ensure Copilot completed the tasks and created screenshots/page-source files.');
    process.exit(1);
  }

  log('INFO', '\n=== Phase 3: Report Generation ===');
  const reportSuccess = runCommand('Report generation', 'node scripts/generate-report.mjs');

  // Final summary
  log('INFO', '\n=== Orchestration Summary ===');
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                      NEXT STEPS                                    ║
╚════════════════════════════════════════════════════════════════════╝

1. Finalization completed.
2. Artifacts validated.
3. Report generated.

Review artifacts:
  • artifacts/screenshots/ - Navigation evidence
  • artifacts/page-source/ - UI structure at each step
  • artifacts/logs/ - Navigation logs
  • artifacts/run-report.md - Summary report

For details on implementation, see: docs/implementation-notes.md
For tool definitions, see: scripts/prompt-executor.mjs

═══════════════════════════════════════════════════════════════════════
`);

  if (artifactsValid && reportSuccess) {
    log('OK', 'PoC orchestration complete. Check artifacts for results.');
    process.exit(0);
  }

  log('ERROR', 'Finalization failed. Check logs above.');
  process.exit(1);
}

main().catch((err) => {
  console.error(`[ERROR] Unexpected error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
