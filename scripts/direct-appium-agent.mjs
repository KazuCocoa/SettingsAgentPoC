#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import './load-env.mjs';

const TASK_SUMMARIES = {
  'settings-explore': 'settings-explore-summary.md',
  'settings-reachability': 'settings-reachability-summary.md',
};

const DIRECT_TOOL_NAMES = [
  'select_device',
  'appium_session_management',
  'appium_screenshot',
  'appium_get_page_source',
  'appium_find_element',
  'appium_gesture',
  'appium_get_text',
  'appium_get_element_attribute',
  'appium_get_window_size',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isoNow() {
  return new Date().toISOString();
}

function getModelName() {
  const model = process.env.DIRECT_MODEL
    || process.env.OLLAMA_MODEL
    || process.env.AGENT_MODEL
    || process.env.LLM_MODEL
    || 'qwen3.5:2b';
  return model.replace(/^ollama\//, '');
}

function getOllamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
}

function getLlmTimeoutMs() {
  return parseInt(process.env.DIRECT_LLM_TIMEOUT_MS || '120000', 10);
}

function getMaxSteps() {
  return parseInt(process.env.DIRECT_MAX_STEPS || '30', 10);
}

function getAppiumMcpCommand() {
  const command = process.env.APPIUM_MCP_COMMAND || 'bash';
  const args = process.env.APPIUM_MCP_ARGS
    ? process.env.APPIUM_MCP_ARGS.split(/\s+/).filter(Boolean)
    : ['scripts/appium-mcp-with-log.sh'];
  return { command, args };
}

function readCapabilitiesJson() {
  const capabilitiesPath = path.join(process.cwd(), 'appium', 'capabilities.android.json');
  if (!fs.existsSync(capabilitiesPath)) return '{}';
  return JSON.stringify(JSON.parse(fs.readFileSync(capabilitiesPath, 'utf-8')));
}

function buildCreateSessionArgs() {
  return JSON.stringify({
    action: 'create',
    platform: 'android',
    capabilities: readCapabilitiesJson(),
  });
}

function textFromToolResult(result) {
  const content = result?.content || [];
  return content
    .map((part) => {
      if (part.type === 'text') return part.text;
      if (part.type === 'image') return '[image]';
      if (part.type === 'resource') return '[resource]';
      return JSON.stringify(part);
    })
    .join('\n');
}

function extractXml(text) {
  const fenced = text.match(/```xml\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('<');
  const end = text.lastIndexOf('>');
  if (start >= 0 && end > start) return text.slice(start, end + 1).trim();
  return '';
}

function truncate(text, limit = 20000) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[truncated ${text.length - limit} chars]`;
}

function parseToolArgs(rawArgs) {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'object') return rawArgs;
  try {
    return JSON.parse(rawArgs);
  } catch {
    return {};
  }
}

function directToolDescription(tool) {
  if (tool.name === 'select_device') {
    return `${tool.description || ''}\nFor Android startup, call with exactly {"platform":"android"}.`;
  }

  if (tool.name === 'appium_session_management') {
    return [
      tool.description || '',
      'For Android startup, action=create requires all three arguments: action, platform, capabilities.',
      'Use platform="android". Use the complete capabilities JSON string supplied in the user prompt.',
      'Never call action=create with only {"action":"create"}.',
    ].join('\n');
  }

  return tool.description || '';
}

function toChatTool(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: directToolDescription(tool),
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
      },
    },
  };
}

function normalizeToolName(name, toolNames) {
  if (toolNames.has(name)) return name;
  const withoutPrefix = name.replace(/^appium-mcp_/, '');
  if (toolNames.has(withoutPrefix)) return withoutPrefix;
  return name;
}

async function callOllama({ model, messages, tools }) {
  const response = await fetch(`${getOllamaBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(getLlmTimeoutMs()),
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function withMcpClient(fn) {
  const { command, args } = getAppiumMcpCommand();
  const transport = new StdioClientTransport({
    command,
    args,
    cwd: process.cwd(),
    env: {
      ...process.env,
      APPIUM_MCP_LOG_FILE: process.env.APPIUM_MCP_LOG_FILE || 'artifacts/logs/appium-mcp.log',
      NO_UI: 'true',
      CAPABILITIES_CONFIG: path.join(process.cwd(), 'appium', 'capabilities.android.json'),
      SCREENSHOTS_DIR: path.join(process.cwd(), 'artifacts', 'screenshots'),
    },
    stderr: 'pipe',
  });

  const client = new Client({ name: 'settings-agent-poc-local-model', version: '0.1.0' });
  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function callTool(client, name, args = {}, transcript) {
  const startedAt = isoNow();
  transcript.push({ type: 'tool_call', name, args, startedAt });
  let result;
  let text;

  try {
    result = await client.callTool({ name, arguments: args });
    text = textFromToolResult(result);
  } catch (err) {
    text = err instanceof Error ? err.message : String(err);
    result = {
      isError: true,
      content: [{ type: 'text', text }],
    };
  } finally {
    transcript.push({
      type: 'tool_result',
      name,
      isError: Boolean(result?.isError),
      text: truncate(text || '', 5000),
      endedAt: isoNow(),
    });
  }

  return { result, text };
}

function savePageSourceArtifact({ taskName, sequence, toolName, text, transcript }) {
  if (toolName !== 'appium_get_page_source') return;
  const xml = extractXml(text);
  if (!xml) return;

  const fileName = `${String(sequence.value).padStart(3, '0')}_${taskName}_page-source.xml`;
  sequence.value += 1;
  const filePath = path.join('artifacts', 'page-source', fileName);
  fs.writeFileSync(filePath, xml, 'utf-8');
  transcript.push({ type: 'artifact', kind: 'page_source', path: filePath, bytes: Buffer.byteLength(xml) });
}

function buildSystemPrompt(toolNames) {
  return [
    'You are controlling Android Settings through Appium MCP tools.',
    'You must choose and call tools yourself. Do not ask for deterministic execution.',
    'Use only the tool-calling interface. Do not write XML, <function>, <tool>, or pseudo-code tool calls in text.',
    'Use the exact tool names provided by the tool list. If task text mentions appium-mcp_ prefixes, strip that prefix when calling tools.',
    'For Android local sessions, first call select_device, then call appium_session_management to create the session.',
    'For appium_session_management create calls, always include all three keys: action, platform, capabilities.',
    'For appium_session_management, action must be exactly one of: create, attach, detach, delete, list, select.',
    'Use screenshots and page source as evidence. Prefer safe read-only navigation.',
    'Before finishing, close/delete the Appium session if one was created.',
    'When the task is complete, respond with a concise summary that starts with TASK_COMPLETE.',
    '',
    `Available raw MCP tool names: ${Array.from(toolNames).join(', ')}`,
  ].join('\n');
}

function buildTaskPrompt(prompt) {
  const createSessionArgs = buildCreateSessionArgs();
  return [
    'DIRECT LOCAL-MODEL STARTUP',
    '',
    'Call these first, in this order:',
    '1. select_device with arguments:',
    '{"platform":"android"}',
    '2. appium_session_management with arguments:',
    createSessionArgs,
    '',
    'Important: the create-session call is invalid unless it includes action, platform, and capabilities. Do not call appium_session_management with only {"action":"create"}.',
    'The capabilities field is a JSON string. Copy the complete capabilities string from the exact arguments above.',
    '',
    'After the session is created, continue with screenshots, page source, safe navigation, and session cleanup.',
    '',
    prompt,
    '',
    'Tool-name reminders for this direct local-model run:',
    '- Choose Appium MCP tools using the tool-calling interface.',
    '- Do not inspect unrelated repository files or prior artifacts.',
    '- If the prompt shows appium-mcp_appium_screenshot, call appium_screenshot.',
    '- If the prompt shows appium-mcp_appium_get_page_source, call appium_get_page_source.',
    '- If the prompt shows appium-mcp_appium_session_management, call appium_session_management.',
    '- If the prompt shows appium-mcp_select_device, call select_device.',
  ].join('\n');
}

async function runDirectTask(taskName, prompt = '') {
  const model = getModelName();
  const transcript = [];
  const startedAt = isoNow();
  const outputFile = path.join('artifacts', 'logs', `${taskName}-direct-output.txt`);
  const summaryPath = path.join('artifacts', 'logs', TASK_SUMMARIES[taskName] || `${taskName}-summary.md`);
  const pageSourceSequence = { value: 1 };
  let finalText = '';
  let runError = null;

  ensureDir(path.join('artifacts', 'logs'));
  ensureDir(path.join('artifacts', 'page-source'));
  ensureDir(path.join('artifacts', 'screenshots'));

  try {
    await withMcpClient(async (client) => {
    const listed = await client.listTools();
    const availableToolNames = new Set(listed.tools.map((tool) => tool.name));
    const selectedTools = listed.tools.filter((tool) => DIRECT_TOOL_NAMES.includes(tool.name));
    const toolNames = new Set(selectedTools.map((tool) => tool.name));
    const tools = selectedTools.map(toChatTool);
    transcript.push({
      type: 'mcp_tools',
      count: selectedTools.length,
      names: Array.from(toolNames),
      availableCount: listed.tools.length,
      availableNames: Array.from(availableToolNames),
    });

    const messages = [
      { role: 'system', content: buildSystemPrompt(toolNames) },
      { role: 'user', content: buildTaskPrompt(prompt) },
    ];

    for (let step = 1; step <= getMaxSteps(); step += 1) {
      const payload = await callOllama({ model, messages, tools });
      const assistantMessage = payload.choices?.[0]?.message || {};
      const toolCalls = (assistantMessage.tool_calls || []).map((toolCall, index) => ({
        ...toolCall,
        id: toolCall.id || `call_${step}_${index}`,
      }));
      transcript.push({
        type: 'assistant',
        step,
        content: assistantMessage.content || '',
        toolCalls,
      });

      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: toolCalls,
      });

      if (toolCalls.length === 0) {
        finalText = assistantMessage.content || '';
        if (finalText.includes('TASK_COMPLETE')) break;

        messages.push({
          role: 'user',
          content: 'Continue by calling the next required Appium MCP tool. Finish only after evidence is captured and the session is closed.',
        });
        continue;
      }

      for (const toolCall of toolCalls) {
        const requestedName = toolCall.function?.name || '';
        const toolName = normalizeToolName(requestedName, toolNames);
        const args = parseToolArgs(toolCall.function?.arguments);
        const { result, text } = await callTool(client, toolName, args, transcript);
        savePageSourceArtifact({
          taskName,
          sequence: pageSourceSequence,
          toolName,
          text,
          transcript,
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result.isError
            ? `ERROR from ${toolName}: ${truncate(text, 3000)}`
            : truncate(text, 3000),
        });

        if (result.isError && toolName === 'appium_session_management') {
          messages.push({
            role: 'user',
            content: [
              'Repair the appium_session_management call by calling the tool again.',
              'Use these exact arguments for starting Android Settings:',
              buildCreateSessionArgs(),
              'Do not omit platform or capabilities. Do not explain; call the tool.',
            ].join(' '),
          });
        }
      }
    }
    });
  } catch (err) {
    runError = err;
    transcript.push({
      type: 'run_error',
      message: err instanceof Error ? err.message : String(err),
      endedAt: isoNow(),
    });
  }

  const endedAt = isoNow();
  const completed = finalText.includes('TASK_COMPLETE');
  const summary = completed
    ? finalText
    : [
      'TASK_INCOMPLETE',
      '',
      runError
        ? `The local model run failed: ${runError instanceof Error ? runError.message : String(runError)}`
        : 'The local model did not emit TASK_COMPLETE within the configured step budget.',
      `Model: ${model}`,
    ].join('\n');

  fs.writeFileSync(summaryPath, summary, 'utf-8');
  fs.writeFileSync(
    outputFile,
    [
      `# Task: ${taskName}`,
      '# Provider: Direct Appium MCP local model',
      `# Model: ${model}`,
      `# Started at: ${startedAt}`,
      `# Ended at: ${endedAt}`,
      `# Completed: ${completed}`,
      '',
      '## Transcript',
      JSON.stringify(transcript, null, 2),
      '',
      '## Summary',
      summary,
    ].join('\n'),
    'utf-8'
  );

  if (runError) {
    throw new Error(`Local model run failed for ${taskName}. See ${outputFile}: ${runError instanceof Error ? runError.message : String(runError)}`);
  }

  if (!completed) {
    throw new Error(`Local model did not complete ${taskName}. See ${outputFile}`);
  }

  return {
    outputFile,
    summaryPath,
    response: summary,
  };
}

async function main() {
  const taskArgIndex = process.argv.indexOf('--task');
  const promptArgIndex = process.argv.indexOf('--prompt-file');
  const taskName = taskArgIndex >= 0 ? process.argv[taskArgIndex + 1] : 'settings-explore';
  const promptFile = promptArgIndex >= 0 ? process.argv[promptArgIndex + 1] : '';
  const prompt = promptFile && fs.existsSync(promptFile)
    ? fs.readFileSync(promptFile, 'utf-8')
    : '';
  const result = await runDirectTask(taskName, prompt);
  console.log(result.response);
  console.log(`Output: ${result.outputFile}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[direct-appium-agent] Fatal error: ${err.message}`);
    process.exit(1);
  });
}

export { runDirectTask };
