import assert from 'node:assert/strict';
import test from 'node:test';

import { extractJson } from '../ai/groq.js';
import { readString, sanitizeHistory, sanitizeStats, sanitizeTasks } from '../ai/input.js';
import { AiError, toPublicError } from '../ai/errors.js';
import { normalizeDueDate } from '../ai/dates.js';

test('extractJson parses plain JSON and fenced JSON', () => {
  assert.deepEqual(extractJson('{"ok":true}'), { ok: true });
  assert.deepEqual(extractJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(extractJson('Here is the plan:\n{"headline":"A","tasks":[]}\nDone.'), {
    headline: 'A',
    tasks: [],
  });
});

test('extractJson rejects empty or non-JSON output with a safe error', () => {
  assert.throws(() => extractJson(''), (error) => error instanceof AiError && error.code === 'invalid_response');
  assert.throws(() => extractJson('no object here'), (error) => error instanceof AiError && error.code === 'invalid_response');
});

test('toPublicError only leaks messages from AiError', () => {
  const safe = toPublicError(new AiError('rate_limited', 'Slow down.', { status: 429, retryAfter: 20 }));
  assert.equal(safe.status, 429);
  assert.equal(safe.body.error.code, 'rate_limited');
  assert.equal(safe.body.error.retryAfterSeconds, 20);

  const hidden = toPublicError(new Error('secret upstream detail'));
  assert.equal(hidden.status, 500);
  assert.equal(hidden.body.error.code, 'server_error');
  assert.doesNotMatch(JSON.stringify(hidden), /secret/);
});

test('readString enforces required minimums and maximums', () => {
  assert.deepEqual(readString('  hello  ', { field: 'Message', min: 3, required: true }), { ok: true, value: 'hello' });
  assert.equal(readString('hi', { field: 'Message', min: 3, required: true }).ok, false);
  assert.equal(readString('x'.repeat(11), { field: 'Message', max: 10 }).ok, false);
  assert.equal(readString(42, { field: 'Message' }).value, '');
});

test('sanitizeTasks drops junk, clamps numbers and strips extra fields', () => {
  const tasks = sanitizeTasks([
    { id: 'a', title: 'Real task', priority: 'High', durationMinutes: 999, secret: 'nope' },
    { id: '', title: 'No id' },
    { id: 'b', title: '' },
    null,
  ]);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].durationMinutes, 240);
  assert.equal(tasks[0].priority, 'High');
  assert.equal(tasks[0].status, 'open');
  assert.equal('secret' in tasks[0], false);
});

test('sanitizeHistory keeps the last valid messages only', () => {
  const history = sanitizeHistory([
    { role: 'user', content: 'old' },
    { role: 'assistant', content: 'reply' },
    { role: 'system', content: 'ignore me' },
    { role: 'user', content: '' },
    { role: 'user', content: 'newest' },
  ]);
  assert.deepEqual(history, [
    { role: 'user', content: 'old' },
    { role: 'assistant', content: 'reply' },
    { role: 'user', content: 'newest' },
  ]);
});

test('sanitizeStats clamps negatives and absurd values', () => {
  const stats = sanitizeStats({
    completedToday: -4,
    createdToday: 2.6,
    focusMinutesToday: 99999,
    sessionsToday: '3',
    openTasks: 'many',
  });
  assert.deepEqual(stats, {
    completedToday: 0,
    createdToday: 3,
    focusMinutesToday: 1440,
    sessionsToday: 3,
    openTasks: 0,
  });
});

test('normalizeDueDate keeps valid ISO dates, clamps the window and defaults invalid input', () => {
  const today = new Date('2026-11-13T09:00:00.000Z');
  assert.equal(normalizeDueDate('2026-11-14', { today }), '2026-11-14');
  assert.equal(normalizeDueDate('2000-01-01', { today }), '2026-11-13');
  assert.equal(normalizeDueDate('2099-01-01', { today }), '2027-03-13');
  assert.equal(normalizeDueDate('2026-02-31', { today }), '2026-11-16');
  assert.equal(normalizeDueDate('tomorrow', { today }), '2026-11-16');
  assert.equal(normalizeDueDate(null, { today }), '2026-11-16');
});
