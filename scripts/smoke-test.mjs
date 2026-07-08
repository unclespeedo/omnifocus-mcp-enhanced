#!/usr/bin/env node
// Smoke test for omnifocus-mcp-enhanced: spawns dist/server.js over stdio,
// lists tools, and calls a few read-only tools against the live OmniFocus DB.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../dist/server.js', import.meta.url));
const server = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });
const rl = createInterface({ input: server.stdout });
const pending = new Map();
let nextId = 1;

function rejectAllPending(err) {
  for (const [, entry] of pending) entry.reject(err);
  pending.clear();
}

server.on('error', (err) => rejectAllPending(new Error(`server spawn failed: ${err.message}`)));
server.on('exit', (code, signal) => {
  if (pending.size > 0) {
    rejectAllPending(new Error(`server exited early (code ${code}, signal ${signal})`));
  }
});
server.stdin.on('error', () => {}); // EPIPE after child death; exit handler reports it

rl.on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id && msg.method === undefined && pending.has(msg.id)) {
    pending.get(msg.id).resolve(msg);
    pending.delete(msg.id);
  }
});

function rpc(method, params, timeoutMs = 30000) {
  const id = nextId++;
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout: ${method}`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (msg) => { clearTimeout(t); resolve(msg); },
      reject: (err) => { clearTimeout(t); reject(err); },
    });
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
    if (!tools.includes(name)) {
      failed++;
      console.log(`FAIL  ${name}: not registered`);
      continue;
    }
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
    console.log(`FAIL  move_task validation: ${JSON.stringify(bad.result ?? bad.error).slice(0, 200)}`);
  }
} catch (err) {
  failed++;
  console.error(`FAIL  ${err.message}`);
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
