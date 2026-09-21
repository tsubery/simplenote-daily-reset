#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { resetDailySection } from './checklist.mjs';

const TAG = process.env.SIMPLENOTE_TAG || 'daily-reset';
const SERVER = process.env.SIMPLENOTE_MCP_COMMAND || 'simplenote-mcp';

if (!process.env.SIMPLENOTE_TOKEN) {
  console.error('SIMPLENOTE_TOKEN is required.');
  process.exit(1);
}

class McpClient {
  constructor(command) {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.child = spawn(command, [], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.#consume(chunk));
    this.child.on('error', (error) => this.#rejectAll(error));
    this.child.on('exit', (code, signal) => {
      if (this.pending.size) {
        this.#rejectAll(new Error(`Simplenote MCP exited (${signal || code})`));
      }
    });
  }

  #consume(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }

      if (message.id === undefined) continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  #rejectAll(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }

  request(method, params = {}) {
    const id = this.nextId++;
    const message = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  close() {
    this.child.stdin.end();
  }
}

function toolValue(result) {
  if (result?.isError) {
    const message = result.content?.map((item) => item.text).filter(Boolean).join('\n');
    throw new Error(message || 'Simplenote tool call failed');
  }

  if (result?.structuredContent !== undefined) return result.structuredContent;
  const text = result?.content?.find((item) => item.type === 'text')?.text;
  if (!text) throw new Error('Simplenote returned no usable result');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Unexpected Simplenote response: ${text}`);
  }
}

async function callTool(client, name, args) {
  return toolValue(await client.request('tools/call', { name, arguments: args }));
}

const client = new McpClient(SERVER);

try {
  await client.request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'simplenote-daily-reset', version: '1.0.0' },
  });
  client.notify('notifications/initialized');

  const listed = await callTool(client, 'list_notes', { tag: TAG, limit: 100 });
  const notes = Array.isArray(listed) ? listed : listed.notes;

  if (!Array.isArray(notes)) throw new Error('list_notes returned an unexpected result');
  if (notes.length !== 1) {
    throw new Error(`Expected exactly one active note tagged "${TAG}", found ${notes.length}.`);
  }

  const fetched = await callTool(client, 'get_note', { id: notes[0].id });
  const note = fetched.note || fetched;
  if (typeof note.content !== 'string') {
    throw new Error('get_note returned an unexpected result');
  }
  const { content, resetCount } = resetDailySection(note.content);

  if (resetCount === 0) {
    console.log(`No checked tasks found under a Daily heading in "${notes[0].title}".`);
  } else {
    await callTool(client, 'update_note', { id: notes[0].id, content });
    console.log(`Reset ${resetCount} task${resetCount === 1 ? '' : 's'} in "${notes[0].title}".`);
  }
} finally {
  client.close();
}
