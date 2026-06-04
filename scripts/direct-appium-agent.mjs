#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import './load-env.mjs';

const TASK_CONFIGS = {
  'settings-explore': {
    safeTargets: ['Apps', 'Battery', 'Display', 'Storage', 'About phone'],
    summaryName: 'settings-explore-summary.md',
    maxTargets: 2,
  },
  'settings-reachability': {
    safeTargets: ['Apps', 'Battery'],
    summaryName: 'settings-reachability-summary.md',
    maxTargets: 2,
  },
};

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
  return parseInt(process.env.DIRECT_LLM_TIMEOUT_MS || '15000', 10);
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
  return JSON.stringify(JSON.parse(fs.readFileSync(capabilitiesPath, 'utf-8')));
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
  return text.trim();
}

function compactPageSource(xml, limit = 12000) {
  return xml
    .replace(/\s+/g, ' ')
    .slice(0, limit);
}

function parseJsonObject(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function callOllamaJson({ model, messages }) {
  const response = await fetch(`${getOllamaBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(getLlmTimeoutMs()),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || '';
  return { content, parsed: parseJsonObject(content), payload };
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

  const client = new Client({ name: 'settings-agent-poc-direct', version: '0.1.0' });
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
  const result = await client.callTool({ name, arguments: args });
  const text = textFromToolResult(result);
  transcript.push({
    type: 'tool_result',
    name,
    isError: Boolean(result.isError),
    text: text.slice(0, 5000),
    endedAt: isoNow(),
  });

  if (result.isError) {
    throw new Error(`${name} failed: ${text}`);
  }

  return { result, text };
}

async function captureEvidence(client, taskName, label, seq, transcript) {
  await callTool(client, 'appium_screenshot', { maxWidth: 900 }, transcript);
  const page = await callTool(client, 'appium_get_page_source', {}, transcript);
  const xml = extractXml(page.text);
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'screen';
  const fileName = `${String(seq).padStart(3, '0')}_${taskName}_${safeLabel}.xml`;
  const filePath = path.join('artifacts', 'page-source', fileName);
  fs.writeFileSync(filePath, xml, 'utf-8');
  transcript.push({ type: 'artifact', kind: 'page_source', path: filePath, bytes: Buffer.byteLength(xml) });
  return { xml, filePath };
}

async function chooseTargetWithLlm({ model, pageXml, safeTargets, visited, taskName }) {
  const response = await callOllamaJson({
    model,
    messages: [
      {
        role: 'system',
        content: [
          'You choose one safe Android Settings target from page source.',
          'Return only JSON with keys: target, reason.',
          'target must be an exact item from the safe target list if visible; otherwise closest safe visible Settings item.',
          'Do not include prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          taskName,
          safeTargets,
          alreadyVisited: visited,
          pageSource: compactPageSource(pageXml),
        }),
      },
    ],
  });

  return response.parsed?.target || null;
}

function chooseFallbackTarget(pageXml, safeTargets, visited) {
  const visibleXml = pageXml.toLowerCase();
  return safeTargets.find((candidate) => (
    !visited.includes(candidate)
    && visibleXml.includes(`text="${candidate.toLowerCase()}`)
  )) || safeTargets.find((candidate) => !visited.includes(candidate));
}

async function navigateToTarget(client, target, transcript) {
  const selector = `new UiSelector().textContains("${target.replace(/"/g, '\\"')}")`;
  const findArgs = {
    strategy: '-android uiautomator',
    selector,
  };
  let found;

  try {
    found = await callTool(client, 'appium_find_element', findArgs, transcript);
  } catch (err) {
    transcript.push({ type: 'find_fallback', target, reason: err.message });
    await callTool(
      client,
      'appium_gesture',
      {
        action: 'scroll_to_element',
        ...findArgs,
        direction: 'down',
        maxScrollAttempts: 5,
        scrollDistancePreset: 'medium',
      },
      transcript
    );
    found = await callTool(client, 'appium_find_element', findArgs, transcript);
  }

  const elementId = found.text.match(/elementId\s+'([^']+)'/i)?.[1]
    || found.text.match(/(?:elementId|elementUUID):\s*([^\s]+)/i)?.[1]
    || found.text.match(/[0-9a-f]{8}-[0-9a-f-]{20,}/i)?.[0];

  if (!elementId) {
    throw new Error(`Could not extract element id for target "${target}" from: ${found.text}`);
  }

  await callTool(client, 'appium_gesture', { action: 'tap', elementUUID: elementId }, transcript);
}

async function runDirectTask(taskName) {
  const config = TASK_CONFIGS[taskName] || TASK_CONFIGS['settings-explore'];
  const model = getModelName();
  const transcript = [];
  const startedAt = isoNow();
  let sequence = 1;
  const visited = [];

  ensureDir(path.join('artifacts', 'logs'));
  ensureDir(path.join('artifacts', 'page-source'));
  ensureDir(path.join('artifacts', 'screenshots'));

  const outputFile = path.join('artifacts', 'logs', `${taskName}-direct-output.txt`);

  await withMcpClient(async (client) => {
    const tools = await client.listTools();
    transcript.push({
      type: 'mcp_tools',
      count: tools.tools.length,
      names: tools.tools.map((tool) => tool.name),
    });

    await callTool(client, 'select_device', { platform: 'android' }, transcript);
    await callTool(
      client,
      'appium_session_management',
      {
        action: 'create',
        platform: 'android',
        capabilities: readCapabilitiesJson(),
      },
      transcript
    );

    let evidence = await captureEvidence(client, taskName, 'settings-home', sequence++, transcript);

    try {
      while (visited.length < config.maxTargets) {
        let target;

        try {
          target = await chooseTargetWithLlm({
            model,
            pageXml: evidence.xml,
            safeTargets: config.safeTargets,
            visited,
            taskName,
          });
        } catch (err) {
          transcript.push({
            type: 'llm_fallback',
            model,
            message: err.message,
          });
          target = chooseFallbackTarget(evidence.xml, config.safeTargets, visited);
        }

        if (!target || visited.includes(target)) {
          target = chooseFallbackTarget(evidence.xml, config.safeTargets, visited);
        }

        if (!target) break;

        transcript.push({ type: 'llm_decision', target });
        await navigateToTarget(client, target, transcript);
        visited.push(target);
        evidence = await captureEvidence(client, taskName, target, sequence++, transcript);
        await callTool(client, 'appium_gesture', { action: 'back' }, transcript);
        evidence = await captureEvidence(client, taskName, 'settings-home', sequence++, transcript);
      }
    } finally {
      await callTool(client, 'appium_session_management', { action: 'delete' }, transcript).catch((err) => {
        transcript.push({ type: 'cleanup_error', message: err.message });
      });
    }
  });

  const endedAt = isoNow();
  const summaryPath = path.join('artifacts', 'logs', config.summaryName);
  const summary = [
    `# ${taskName} direct run`,
    '',
    `Started: ${startedAt}`,
    `Ended: ${endedAt}`,
    `Model: ${model}`,
    `Visited targets: ${visited.length ? visited.join(', ') : '(none)'}`,
    '',
    'TASK_COMPLETE',
  ].join('\n');
  fs.writeFileSync(summaryPath, summary, 'utf-8');

  fs.writeFileSync(
    outputFile,
    [
      `# Task: ${taskName}`,
      '# Provider: Direct Appium MCP + Ollama',
      `# Model: ${model}`,
      `# Started at: ${startedAt}`,
      `# Ended at: ${endedAt}`,
      '',
      '## Transcript',
      JSON.stringify(transcript, null, 2),
      '',
      '## Summary',
      summary,
    ].join('\n'),
    'utf-8'
  );

  return {
    outputFile,
    summaryPath,
    response: summary,
  };
}

async function main() {
  const taskArgIndex = process.argv.indexOf('--task');
  const taskName = taskArgIndex >= 0 ? process.argv[taskArgIndex + 1] : 'settings-explore';
  const result = await runDirectTask(taskName);
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
