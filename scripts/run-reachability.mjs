#!/usr/bin/env node

/**
 * Orchestrate Settings reachability test using LLM
 * The LLM executes the specific navigation sequence
 * Invokes: prompts/settings-reachability.md with Appium tools
 */

import { executeTask } from './prompt-executor.mjs';

async function main() {
  console.log('[run-reachability] Starting Settings reachability test via LLM');

  try {
    const result = await executeTask('prompts/settings-reachability.md', 'settings-reachability');

    console.log('\n[run-reachability] Task execution initiated');
    console.log(`[run-reachability] Prompt file: ${result.promptFile}`);
    console.log(`[run-reachability] Status: ${result.status}`);
    if (result.outputFile) {
      console.log(`[run-reachability] ${result.provider} CLI output: ${result.outputFile}`);
      console.log(`[run-reachability] Reachability task executed automatically via ${result.provider} CLI.`);
    } else {
      console.log('\n[run-reachability] === Instructions ===');
      console.log('1. Open Codex or GitHub Copilot Chat');
      console.log('2. Open the prompt file: prompts/settings-reachability.md');
      console.log('3. Ask the agent to execute the task');
      console.log('4. The agent will use available Appium MCP tools to:');
      console.log('   - Create a session');
      console.log('   - Navigate: Home → Apps → Home → About phone → Home');
      console.log('   - Capture state at each major transition');
      console.log('   - Log the navigation sequence');
    }

    console.log('\n[run-reachability] === Next Steps ===');
    console.log('1. Review artifacts in artifacts/screenshots/ and artifacts/page-source/');
    console.log(`2. Check execution log in ${result.outputFile || 'artifacts/logs/settings-reachability-*-output.txt'}`);
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
