#!/usr/bin/env node

/**
 * Orchestrate Settings reachability test using LLM
 * The LLM (via Copilot Chat) executes the specific navigation sequence
 * Invokes: prompts/settings-reachability.md with Appium tools
 */

import { executeTask } from './prompt-executor.js';

async function main() {
  console.log('[run-reachability] Starting Settings reachability test via LLM');

  try {
    const result = await executeTask('prompts/settings-reachability.md', 'settings-reachability');

    console.log('\n[run-reachability] Task execution initiated');
    console.log(`[run-reachability] Prompt file: ${result.promptFile}`);
    console.log(`[run-reachability] Status: ${result.status}`);
    if (result.status === 'executed-via-copilot-cli') {
      console.log(`[run-reachability] Copilot CLI output: ${result.outputFile}`);
      console.log('[run-reachability] Reachability task executed automatically via Copilot CLI.');
    } else {
      console.log('\n[run-reachability] === Instructions ===');
      console.log('1. Open GitHub Copilot Chat in VS Code');
      console.log('2. Open the prompt file: prompts/settings-reachability.md');
      console.log('3. Ask Copilot to execute the task');
      console.log('4. Copilot will use available Appium MCP tools to:');
      console.log('   - Create a session');
      console.log('   - Navigate: Home → Apps → Home → About phone → Home');
      console.log('   - Capture state at each major transition');
      console.log('   - Log the navigation sequence');
    }

    console.log('\n[run-reachability] === Next Steps ===');
    console.log('1. Review artifacts in artifacts/screenshots/ and artifacts/page-source/');
    console.log('2. Check execution log in artifacts/logs/settings-reachability-copilot-output.txt');
    console.log('3. Run: npm run poc:finalize');

    process.exit(0);
  } catch (err) {
    console.error('[run-reachability] Fatal error:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[run-reachability] Uncaught error:', err);
  process.exit(1);
});
