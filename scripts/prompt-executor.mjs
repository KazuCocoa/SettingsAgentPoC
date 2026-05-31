#!/usr/bin/env node

/**
 * Prompt Executor for Settings Agent PoC
 * Reads a prompt and invokes the LLM to execute it with available tools
 * Supports Codex CLI or Copilot CLI
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const executedActions = [];

function getAppiumMcpCommandArgs() {
  const command = process.env.APPIUM_MCP_COMMAND || 'sh';
  const args = process.env.APPIUM_MCP_ARGS
    ? process.env.APPIUM_MCP_ARGS.split(' ').filter(Boolean)
    : ['scripts/appium-mcp-with-log.sh'];

  return { command, args };
}

function addCodexAppiumMcpArgs(args) {
  if (process.env.APPIUM_MCP_ENABLED === 'false') {
    return;
  }

  const { command, args: mcpArgs } = getAppiumMcpCommandArgs();

  args.push(
    '-c',
    `mcp_servers.appium-mcp.command=${JSON.stringify(command)}`,
    '-c',
    `mcp_servers.appium-mcp.args=${JSON.stringify(mcpArgs)}`,
    '-c',
    `mcp_servers.appium-mcp.cwd=${JSON.stringify(process.cwd())}`,
    '-c',
    `mcp_servers.appium-mcp.env.APPIUM_MCP_LOG_FILE=${JSON.stringify(process.env.APPIUM_MCP_LOG_FILE || 'artifacts/logs/appium-mcp.log')}`,
    '-c',
    // CI doesn't need to work as a UI mode.
    'mcp_servers.appium-mcp.env.NO_UI="true"'
  );

  if (process.env.ANDROID_HOME) {
    args.push(
      '-c',
      `mcp_servers.appium-mcp.env.ANDROID_HOME=${JSON.stringify(process.env.ANDROID_HOME)}`
    );
  }
}

function shouldBypassCodexApprovalsAndSandbox() {
  return process.env.CODEX_BYPASS_APPROVALS_AND_SANDBOX !== 'false';
}

const PROVIDERS = {
  codex: {
    binary: 'codex',
    displayName: 'Codex CLI',
    status: 'executed-via-codex-cli',
    awaitingStatus: 'awaiting-codex-execution',
    outputSuffix: 'codex',
    manualName: 'Codex',
    manualProduct: 'Codex',
    promptViaStdin: true,
    buildArgs({ model }) {
      const args = [
        'exec',
        '--cd',
        process.cwd(),
        '--add-dir',
        process.cwd(),
      ];

      if (shouldBypassCodexApprovalsAndSandbox()) {
        args.push('--dangerously-bypass-approvals-and-sandbox');
      } else {
        args.push('--sandbox', process.env.CODEX_SANDBOX || 'workspace-write');
      }

      if (model) {
        args.push('--model', model);
      }

      addCodexAppiumMcpArgs(args);

      args.push('-');
      return args;
    },
  },
  copilot: {
    binary: 'copilot',
    displayName: 'Copilot CLI',
    status: 'executed-via-copilot-cli',
    awaitingStatus: 'awaiting-copilot-execution',
    outputSuffix: 'copilot',
    manualName: 'Copilot Chat',
    manualProduct: 'GitHub Copilot Chat',
    buildArgs({ model, prompt }) {
      return [
        '--model',
        model,
        '--allow-all-tools',
        '--add-dir',
        process.cwd(),
        '-p',
        prompt,
      ];
    },
  },
};

function getProvider() {
  const providerName = (process.env.AGENT_PROVIDER || process.env.LLM_PROVIDER || 'codex').toLowerCase();
  const provider = PROVIDERS[providerName];

  if (!provider) {
    const names = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Unsupported AGENT_PROVIDER "${providerName}". Supported providers: ${names}.`);
  }

  return { ...provider, name: providerName };
}

function getProviderModel(providerName) {
  if (providerName === 'codex') {
    return process.env.CODEX_MODEL || process.env.AGENT_MODEL || process.env.LLM_MODEL;
  }

  return process.env.COPILOT_MODEL || process.env.AGENT_MODEL || process.env.LLM_MODEL || 'gpt-5.3-codex';
}

function getProviderTimeoutMs(providerName) {
  if (providerName === 'codex') {
    if (process.env.CODEX_CLI_TIMEOUT_MS) {
      return parseInt(process.env.CODEX_CLI_TIMEOUT_MS, 10);
    }

    const genericTimeout = process.env.AGENT_CLI_TIMEOUT_MS || process.env.LLM_CLI_TIMEOUT_MS || process.env.COPILOT_CLI_TIMEOUT_MS;
    return Math.max(parseInt(genericTimeout || '600000', 10), 600000);
  }

  const timeout = process.env.COPILOT_CLI_TIMEOUT_MS || process.env.AGENT_CLI_TIMEOUT_MS || process.env.LLM_CLI_TIMEOUT_MS;
  return parseInt(timeout || '120000', 10);
}

function getManualFallback() {
  return process.env.AGENT_MANUAL_FALLBACK === 'true'
    || process.env.LLM_MANUAL_FALLBACK === 'true'
    || process.env.COPILOT_MANUAL_FALLBACK === 'true';
}

function getManualOnly() {
  return process.env.AGENT_MANUAL_ONLY === 'true'
    || process.env.LLM_MANUAL_ONLY === 'true'
    || process.env.COPILOT_MANUAL_ONLY === 'true';
}

function withAutomationFooter(prompt, providerName) {
  if (
    providerName !== 'codex'
    || process.env.CODEX_AUTOMATION_FOOTER === 'false'
    || prompt.includes('## Automation completion requirements')
  ) {
    return prompt;
  }

  return `${prompt.trim()}

## Automation completion requirements

- Keep this run bounded. Do not continue exploring after the requested targets are complete.
- Before finishing, delete/close the Appium session if one was created.
- Once the requested screenshots, page source files, and run summary are written, stop tool use.
- Verify page source artifacts are real XML with UI hierarchy content. Do not leave placeholder files such as "Killed" or empty XML artifacts.
- Final response must be a short completion summary that starts with: TASK_COMPLETE
`;
}

function runProviderCli(provider, prompt, taskName) {
  const model = getProviderModel(provider.name);
  const timeoutMs = getProviderTimeoutMs(provider.name);
  const outputFile = `artifacts/logs/${taskName}-${provider.outputSuffix}-output.txt`;
  const executablePrompt = withAutomationFooter(prompt, provider.name);
  const args = provider.buildArgs({ model, prompt: executablePrompt });

  const result = spawnSync(provider.binary, args, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    input: provider.promptViaStdin ? executablePrompt : undefined,
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
    `# Provider: ${provider.displayName}`,
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
        `${provider.displayName} timed out after ${timeoutMs}ms. Increase ${provider.name.toUpperCase()}_CLI_TIMEOUT_MS or run manual mode with npm run poc:prepare.`
      );
    }

    throw new Error(`Failed to execute ${provider.displayName}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(`${provider.displayName} exited with code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }

  const outputText = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (provider.name === 'codex' && outputText.includes('user cancelled MCP tool call')) {
    throw new Error(
      `${provider.displayName} reported cancelled MCP tool calls. ` +
      'For automated Appium MCP runs, keep CODEX_BYPASS_APPROVALS_AND_SANDBOX unset or set it to true.'
    );
  }

  return {
    outputFile,
    response: (result.stdout || '').trim(),
  };
}

async function invokeLLM(prompt, taskName) {
  const provider = getProvider();
  const executablePrompt = withAutomationFooter(prompt, provider.name);

  console.log(`[Executor] Invoking LLM for task: ${taskName}`);
  console.log(`[Executor] Preparing prompt for ${provider.displayName}...`);

  // Create a temporary file with the prompt
  const promptFile = `artifacts/logs/${taskName}-prompt.txt`;
  const dir = path.dirname(promptFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(promptFile, executablePrompt, 'utf-8');

  console.log(`[Executor] Prompt saved to: ${promptFile}`);

  if (getManualOnly()) {
    console.log(`[Executor] Manual-only mode enabled. Skipping ${provider.displayName} execution.`);
    return {
      promptFile,
      provider: provider.name,
      status: provider.awaitingStatus,
      message:
        `Open the prompt file above in ${provider.manualProduct} and execute it manually.`,
    };
  }

  const fallbackToManual = getManualFallback();
  const probe = spawnSync(provider.binary, ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
  if (probe.error || probe.status !== 0) {
    if (!fallbackToManual) {
      const reason = probe.error ? probe.error.message : `exit code ${probe.status}`;
      throw new Error(
        `${provider.displayName} is not available (${reason}). Install/configure it or set AGENT_MANUAL_FALLBACK=true to prepare prompts without executing.`
      );
    }

    console.log(`[Executor] ${provider.displayName} not available. Falling back to manual ${provider.manualName} execution.`);
    return {
      promptFile,
      provider: provider.name,
      status: provider.awaitingStatus,
      message:
        `Open the prompt file above in ${provider.manualProduct} and execute it manually.`,
    };
  }

  console.log(`[Executor] Running ${provider.displayName} in non-interactive mode...`);
  const cliResult = runProviderCli(provider, executablePrompt, taskName);

  return {
    promptFile,
    provider: provider.name,
    status: provider.status,
    outputFile: cliResult.outputFile,
    message: `${provider.displayName} executed the task prompt successfully.`,
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

  // The selected agent uses the MCP tools configured in the editor or CLI environment.
  // The executor provides the task prompt and records the agent output for review.

  return {
    taskName,
    provider: llmResult.provider,
    promptFile: llmResult.promptFile,
    status: llmResult.status,
    outputFile: llmResult.outputFile,
    executedActions,
  };
}

export { executeTask, executedActions };
