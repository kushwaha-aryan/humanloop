/**
 * End-to-end smoke test against a real server process in demo mode.
 * Usage: npm run smoke (build first: npm run build).
 */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const PORT = 3210;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), GROQ_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  output += chunk;
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      /* not listening yet */
    }
    await sleep(150);
  }
  throw new Error(`Server did not start on port ${PORT}. Output:\n${output}`);
}

async function json(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  const body = await response.json();
  return { status: response.status, body, headers: response.headers };
}

const post = (path, body) =>
  json(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const results = [];
function pass(name, extra = '') {
  results.push(`  ok  ${name}${extra ? ` — ${extra}` : ''}`);
}

try {
  await waitForServer();

  const health = await json('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.mode, 'demo');
  assert.equal(health.body.hasApiKey, false);
  assert.equal(health.body.demoMode, true);
  pass('health reports demo mode');

  const page = await fetch(`${BASE}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') || '', /text\/html/);
  const html = await page.text();
  assert.match(html, /HumanLoop/);
  pass('production HTML is served');

  const missing = await json('/api/unknown');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'not_found');
  pass('unknown API routes return JSON 404');

  const clarity = await post('/api/ai/clarity', {
    situation: 'I have a client deck due tomorrow, two unanswered emails, and I keep avoiding the tax form.',
    tasks: [{ id: 't1', title: 'Existing task', priority: 'High', durationMinutes: 45, status: 'open' }],
  });
  assert.equal(clarity.status, 200);
  assert.equal(clarity.body.mode, 'demo');
  assert.ok(clarity.body.result.tasks.length >= 1);
  assert.ok(clarity.body.result.tasks.every((task) => task.title.length >= 3));
  assert.ok(clarity.body.result.tasks.every((task) => task.durationMinutes >= 5));
  pass('clarity plan is valid', `${clarity.body.result.tasks.length} tasks`);

  const adapt = await post('/api/ai/adapt', {
    signal: 'less_time',
    note: 'I only have 40 minutes before I leave.',
    tasks: [
      { id: 't1', title: 'Finish report', priority: 'High', durationMinutes: 90, dueDate: '2026-11-14', status: 'open' },
      { id: 't2', title: 'Clear inbox', priority: 'Low', durationMinutes: 25, dueDate: '', status: 'open' },
    ],
  });
  assert.equal(adapt.status, 200);
  assert.ok(adapt.body.result.adjustments.length >= 1);
  assert.ok(adapt.body.result.nextAction.title.length >= 3);
  pass('adaptation is valid', `${adapt.body.result.adjustments.length} adjustments`);

  const reflect = await post('/api/ai/reflect', {
    input: {
      accomplished: 'Finished the opening section of the deck and sent two replies.',
      unfinished: 'The rest of the deck.',
      blockers: 'I did not know what the client wanted.',
      nextPriority: 'Send three questions to the client.',
    },
    stats: { completedToday: 2, createdToday: 1, focusMinutesToday: 50, sessionsToday: 2, openTasks: 3 },
    tasks: [],
  });
  assert.equal(reflect.status, 200);
  assert.ok(reflect.body.result.nextSteps.length >= 1);
  pass('reflection is valid', `${reflect.body.result.nextSteps.length} next steps`);

  const invalid = await post('/api/ai/clarity', { situation: 'short' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'invalid_request');
  assert.ok(invalid.body.error.message.length > 10);
  pass('invalid input returns a readable 400');

  const malformed = await json('/api/ai/clarity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"situation":',
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, 'invalid_json');
  pass('malformed JSON is rejected safely');

  const nosniff = missing.headers.get('x-content-type-options');
  assert.equal(nosniff, 'nosniff');
  pass('security headers are present');

  console.log('\nHumanLoop smoke test\n');
  console.log(results.join('\n'));
  console.log(`\n${results.length} checks passed.\n`);
} catch (error) {
  console.error('\nSmoke test failed:\n');
  console.error(error);
  console.error(`\nServer output:\n${output}`);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  setTimeout(() => server.kill('SIGKILL'), 1500).unref();
}
