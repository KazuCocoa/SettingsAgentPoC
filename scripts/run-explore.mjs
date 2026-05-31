#!/usr/bin/env node

/**
 * Orchestrate Settings exploration using LLM
 * The LLM decides navigation based on available tools
 * Invokes: prompts/settings-explore.md with Appium tools
 */

import { executeTask } from './prompt-executor.mjs';

async function main() {
  console.log('[run-explore] Starting Android Settings exploration via LLM');

  try {
    const result = await executeTask('prompts/settings-explore.md', 'settings-explore');

    console.log('\n[run-explore] Task execution initiated');
    console.log(`[run-explore] Prompt file: ${result.promptFile}`);
    console.log(`[run-explore] Status: ${result.status}`);
    if (result.outputFile) {
      console.log(`[run-explore] ${result.provider} CLI output: ${result.outputFile}`);
      console.log(`[run-explore] Exploration task executed automatically via ${result.provider} CLI.`);
    } else {
      console.log('\n[run-explore] === Instructions ===');
      console.log('1. Open Codex or GitHub Copilot Chat');
      console.log('2. Open the prompt file: prompts/settings-explore.md');
      console.log('3. Ask the agent to execute the task');
      console.log('4. The agent will use available Appium MCP tools to:');
      console.log('   - Create a session');
      console.log('   - Navigate to safe Settings pages');
      console.log('   - Capture screenshots and page source');
      console.log('   - Log navigation path');
    }

    console.log('\n[run-explore] === Next Steps ===');
    console.log('1. Review artifacts in artifacts/screenshots/ and artifacts/page-source/');
    console.log(`2. Check execution log in ${result.outputFile || 'artifacts/logs/settings-explore-*-output.txt'}`);
    console.log('3. Continue with reachability or run: npm run poc:finalize');

    process.exit(0);
  } catch (err) {
    console.error('[run-explore] Fatal error:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[run-explore] Uncaught error:', err);
  process.exit(1);
});
