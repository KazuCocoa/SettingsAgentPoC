#!/usr/bin/env node

/**
 * Prompt Executor for Settings Agent PoC
 * Reads a prompt and invokes the LLM to execute it with available tools
 * Supports Copilot CLI or Anthropic API
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const AVAILABLE_TOOLS = {
  create_session: {
    description: 'Create a new Appium session for Android Settings',
    params: {},
  },
  delete_session: {
    description: 'Delete and cleanup the Appium session',
    params: {},
  },
  take_screenshot: {
    description: 'Capture a screenshot of the current screen',
    params: {
      filename: { type: 'string', description: 'Filename for the screenshot (without path)' },
    },
  },
  get_page_source: {
    description: 'Capture the page source (XML) of the current screen',
    params: {
      filename: { type: 'string', description: 'Filename for the page source (without path)' },
    },
  },
  find_element: {
    description: 'Find an element on the current screen by text or selector',
    params: {
      text: { type: 'string', description: 'Text to search for on the screen' },
    },
  },
  tap_element: {
    description: 'Tap an element found by text',
    params: {
      text: { type: 'string', description: 'Text of the element to tap' },
    },
  },
  press_back: {
    description: 'Press the Android back button',
    params: {},
  },
  get_current_package: {
    description: 'Get the current app package name to verify Settings is active',
    params: {},
  },
  log_action: {
    description: 'Log a navigation or decision action',
    params: {
      action: { type: 'string', description: 'Description of the action taken' },
    },
  },
};

const executedActions = [];

function runCopilotCli(prompt, taskName) {
  const model = process.env.COPILOT_MODEL || 'gpt-5.3-codex';
  const timeoutMs = parseInt(process.env.COPILOT_CLI_TIMEOUT_MS || '120000', 10);
  const outputFile = `artifacts/logs/${taskName}-copilot-output.txt`;
  const args = [
    '--model',
    model,
    '--allow-all-tools',
    '--add-dir',
    process.cwd(),
    '-p',
    prompt,
  ];

  const result = spawnSync('copilot', args, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const combinedOutput = [
    `# Task: ${taskName}`,
    `# Model: ${model}`,
    `# Exit code: ${result.status ?? 'unknown'}`,
    '',
    '## STDOUT',
    result.stdout || '',
    '',
    '## STDERR',
    result.stderr || '',
  ].join('\n');
  fs.writeFileSync(outputFile, combinedOutput, 'utf-8');

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(
        `Copilot CLI timed out after ${timeoutMs}ms. Increase COPILOT_CLI_TIMEOUT_MS or run manual mode with npm run poc:prepare.`
      );
    }

    throw new Error(`Failed to execute copilot CLI: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(`Copilot CLI exited with code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }

  return {
    outputFile,
    response: (result.stdout || '').trim(),
  };
}

async function invokeLLM(prompt, taskName) {
  console.log(`[Executor] Invoking LLM for task: ${taskName}`);
  console.log('[Executor] Preparing prompt for Copilot CLI...');

  // Create a temporary file with the prompt
  const promptFile = `artifacts/logs/${taskName}-prompt.txt`;
  const dir = path.dirname(promptFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write prompt with tool definitions
  const toolsDescription = `\n\n## Available Tools

You have access to the following tools to interact with the Android Settings app:

${Object.entries(AVAILABLE_TOOLS)
  .map(
    ([name, tool]) =>
      `### ${name}
Description: ${tool.description}
Parameters: ${Object.keys(tool.params).length > 0 ? JSON.stringify(tool.params, null, 2) : 'None'}`
  )
  .join('\n\n')}

When you need to use a tool, use this format in your response:
\`\`\`tool-call
tool_name: <tool_name>
param1: <value1>
param2: <value2>
\`\`\`
`;

  fs.writeFileSync(promptFile, prompt + toolsDescription, 'utf-8');

  console.log(`[Executor] Prompt saved to: ${promptFile}`);

  const fallbackToManual = process.env.COPILOT_MANUAL_FALLBACK === 'true';
  const probe = spawnSync('copilot', ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
  if (probe.error || probe.status !== 0) {
    if (!fallbackToManual) {
      const reason = probe.error ? probe.error.message : `exit code ${probe.status}`;
      throw new Error(
        `Copilot CLI is not available (${reason}). Install/configure it or set COPILOT_MANUAL_FALLBACK=true to prepare prompts without executing.`
      );
    }

    console.log('[Executor] Copilot CLI not available. Falling back to manual Copilot Chat execution.');
    return {
      promptFile,
      status: 'awaiting-copilot-execution',
      message:
        'Open the prompt file above in GitHub Copilot Chat and execute it manually.',
    };
  }

  console.log('[Executor] Running Copilot CLI in non-interactive mode...');
  const cliResult = runCopilotCli(prompt + toolsDescription, taskName);

  return {
    promptFile,
    status: 'executed-via-copilot-cli',
    outputFile: cliResult.outputFile,
    message: 'Copilot CLI executed the task prompt successfully.',
  };
}

async function executeTask(promptFile, taskName) {
  console.log(`\n[Executor] Starting task: ${taskName}`);
  console.log(`[Executor] Reading prompt from: ${promptFile}`);

  if (!fs.existsSync(promptFile)) {
    console.error(`[Executor] Prompt file not found: ${promptFile}`);
    process.exit(1);
  }

  const prompt = fs.readFileSync(promptFile, 'utf-8');

  // Invoke LLM
  const llmResult = await invokeLLM(prompt, taskName);

  console.log(`\n[Executor] LLM Invocation Result:`);
  console.log(llmResult);

  // Note: In the current implementation, the LLM (Copilot) runs in VS Code Chat
  // and uses the tools defined above. The executor provides the prompt and tool definitions.
  // Once Copilot CLI becomes available, this can be fully automated.

  return {
    taskName,
    promptFile: llmResult.promptFile,
    status: llmResult.status,
    outputFile: llmResult.outputFile,
    tools: AVAILABLE_TOOLS,
    executedActions,
  };
}

export { executeTask, AVAILABLE_TOOLS, executedActions };
