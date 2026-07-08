#!/usr/bin/env node
// Smoke test for omnifocus-mcp-enhanced: spawns dist/server.js over stdio,
// lists tools, and calls a few read-only tools against the live OmniFocus DB.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const server = spawn('node', ['dist/server.js'], { stdio: ['pipe', 'pipe', 'inherit'] });
const rl = createInterface({ input: server.stdout });
const pending = new Map();
let nextId = 1;

rl.on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function rpc(method, params, timeoutMs = 30000) {
  const id = nextId++;
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), timeoutMs);
    pending.set(id, (msg) => { clearTimeout(t); resolve(msg); });
  });
}

function summarize(name, msg) {
  if (msg.error) return `FAIL  ${name}: rpc error ${JSON.stringify(msg.error)}`;
  const r = msg.result;
  if (r.isError) return `FAIL  ${name}: ${r.content?.[0]?.text?.slice(0, 200)}`;
  const text = r.content?.[0]?.text ?? '';
  return `PASS  ${name}: ${text.length} chars — ${text.split('\n')[0].slice(0, 100)}`;
}

let failed = 0;
try {
  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '0' },
  });
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const list = await rpc('tools/list', {});
  const tools = list.result.tools.map((t) => t.name);
  console.log(`PASS  tools/list: ${tools.length} tools`);

  // Read-only calls against the live OmniFocus database
  const readOnlyCalls = [
    ['get_inbox_tasks', {}],
    ['get_flagged_tasks', {}],
    ['get_forecast_tasks', {}],
    ['list_custom_perspectives', {}],
    ['filter_tasks', { flagged: true }],
  ];
  for (const [name, args] of readOnlyCalls) {
    if (!tools.includes(name)) { console.log(`SKIP  ${name}: not registered`); continue; }
    const msg = await rpc('tools/call', { name, arguments: args }, 60000);
    const line = summarize(name, msg);
    if (line.startsWith('FAIL')) failed++;
    console.log(line);
  }

  // Validation-error path (no OmniFocus write): conflicting destinations
  const bad = await rpc('tools/call', {
    name: 'move_task',
    arguments: { id: 't1', targetProjectId: 'p1', targetInbox: true },
  });
  if (bad.result?.isError && /Exactly one destination/.test(bad.result.content[0].text)) {
    console.log('PASS  move_task validation: rejected conflicting destinations');
  } else {
    failed++;
    console.log(`FAIL  move_task validation: ${JSON.stringify(bad.result).slice(0, 200)}`);
  }
} catch (err) {
  failed++;
  console.error(`FAIL  ${err.message}`);
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
