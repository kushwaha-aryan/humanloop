import assert from 'node:assert/strict';
import test from 'node:test';

import { demoAdaptation, demoClarityPlan, demoReflection, extractItems } from '../demo.js';
import { validateAdaptation, validateClarityPlan, validateReflection } from '../ai/validate.js';

const NOW = new Date('2026-11-13T09:00:00.000Z');
const SITUATION =
  'I have a client deck due tomorrow, two unanswered emails, and I keep avoiding the tax form.';

test('extractItems splits comma lists into clean task fragments', () => {
  const items = extractItems(SITUATION);
  assert.deepEqual(items.slice(0, 3), [
    'client deck due tomorrow',
    'two unanswered emails',
    'avoiding the tax form',
  ]);
});

test('extractItems ignores pure feeling statements and duplicates', () => {
  const items = extractItems("I'm so overwhelmed. I need to email Sam. Email Sam. Also I need to book the dentist.");
  assert.ok(items.length >= 2);
  assert.ok(items.every((item) => !/^i'?m\b/i.test(item)));
  assert.equal(new Set(items.map((item) => item.toLowerCase())).size, items.length);
});

test('demoClarityPlan is deterministic and passes the same validator as live AI', () => {
  const first = demoClarityPlan({ situation: SITUATION, now: NOW });
  const second = demoClarityPlan({ situation: SITUATION, now: NOW });
  assert.deepEqual(first, second);

  const checked = validateClarityPlan(first, NOW);
  assert.equal(checked.ok, true);
  assert.ok(checked.data.tasks.length >= 3);
  assert.ok(checked.data.headline.length <= 80);
  assert.ok(checked.data.tasks.every((task) => task.durationMinutes >= 5));
});

test('demoClarityPlan still produces a plan from a short vague note', () => {
  const plan = demoClarityPlan({ situation: 'everything is a mess', now: NOW });
  const checked = validateClarityPlan(plan, NOW);
  assert.equal(checked.ok, true);
  assert.ok(checked.data.tasks.length >= 3);
  assert.ok(checked.data.blockers.length > 0);
});

test('demoAdaptation with less time shrinks the top task and defers the rest', () => {
  const tasks = [
    { id: 't1', title: 'Finish report', priority: 'High', durationMinutes: 90, dueDate: '2026-11-14', status: 'open' },
    { id: 't2', title: 'Clear inbox', priority: 'Low', durationMinutes: 25, dueDate: '', status: 'open' },
    { id: 't3', title: 'Book dentist', priority: 'Low', durationMinutes: 10, dueDate: '', status: 'open' },
  ];
  const plan = demoAdaptation({ signal: 'less_time', note: 'I only have 40 minutes.', tasks, now: NOW });
  const checked = validateAdaptation(plan, NOW, tasks);

  assert.equal(checked.ok, true);
  const primary = plan.adjustments.find((adjustment) => adjustment.taskId === 't1');
  assert.equal(primary.action, 'reduce_scope');
  assert.ok(primary.durationMinutes < 90);
  assert.ok(plan.adjustments.some((adjustment) => adjustment.action === 'defer' && adjustment.taskId === 't2'));
  assert.ok(plan.nextAction.title.length >= 3);
});

test('demoAdaptation creates a starting point when the workspace is empty', () => {
  const plan = demoAdaptation({ signal: 'overwhelmed', note: '', tasks: [], now: NOW });
  const checked = validateAdaptation(plan, NOW, []);
  assert.equal(checked.ok, true);
  assert.equal(plan.adjustments[0].action, 'add');
  assert.equal(plan.adjustments[0].taskId, null);
});

test('demoReflection uses measured stats instead of inventing progress', () => {
  const plan = demoReflection({
    input: {
      accomplished: 'Finished the opening section of the deck and sent two replies.',
      unfinished: 'The rest of the deck.',
      blockers: 'I did not know what the client wanted.',
      nextPriority: 'Send three questions to the client.',
    },
    stats: { completedToday: 2, createdToday: 1, focusMinutesToday: 50, sessionsToday: 2, openTasks: 3 },
    tasks: [],
  });

  const checked = validateReflection(plan);
  assert.equal(checked.ok, true);
  assert.match(plan.reflection, /2 completed tasks/);
  assert.match(plan.reflection, /50 focus minutes/);
  assert.ok(plan.wins.some((win) => /2/.test(win)));
  assert.equal(plan.nextSteps[0].title, 'Send three questions to the client');
});

test('demoReflection stays honest when nothing was logged', () => {
  const plan = demoReflection({
    input: { accomplished: 'I read the brief twice.', unfinished: '', blockers: '', nextPriority: '' },
    stats: { completedToday: 0, createdToday: 0, focusMinutesToday: 0, sessionsToday: 0, openTasks: 0 },
    tasks: [],
  });
  assert.equal(validateReflection(plan).ok, true);
  assert.match(plan.reflection, /No focus sessions were logged/);
  assert.doesNotMatch(plan.reflection, /0 focus minutes/);
});
