import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanText,
  normalizePriority,
  validateAdaptation,
  validateClarityPlan,
  validateReflection,
} from '../ai/validate.js';

const NOW = new Date('2026-11-13T09:00:00.000Z');
const TASKS = [
  { id: 't1', title: 'Finish report', priority: 'High', durationMinutes: 90, status: 'open' },
  { id: 't2', title: 'Clear inbox', priority: 'Low', durationMinutes: 25, status: 'open' },
];

test('normalizePriority accepts common model spellings', () => {
  assert.equal(normalizePriority('high'), 'High');
  assert.equal(normalizePriority('URGENT'), 'High');
  assert.equal(normalizePriority('p1'), 'High');
  assert.equal(normalizePriority('medium'), 'Medium');
  assert.equal(normalizePriority('low priority'), 'Low');
  assert.equal(normalizePriority('someday'), 'Low');
  assert.equal(normalizePriority('nonsense'), 'Medium');
});

test('cleanText strips control characters and caps length', () => {
  assert.equal(cleanText('  hello\u0000   world  ', 50), 'hello world');
  assert.equal(cleanText('abcdefgh', 4), 'abcd');
  assert.equal(cleanText(null), '');
});

test('validateClarityPlan rejects a plan with no usable tasks', () => {
  const result = validateClarityPlan({ headline: 'A headline', understanding: 'x'.repeat(30), tasks: [] }, NOW);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith('tasks:')));
});

test('validateClarityPlan rejects a plan without framing', () => {
  const result = validateClarityPlan({ tasks: [{ title: 'Do the thing' }] }, NOW);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith('headline:')));
  assert.ok(result.errors.some((error) => error.startsWith('understanding:')));
});

test('validateClarityPlan normalizes a good plan', () => {
  const result = validateClarityPlan(
    {
      headline: 'One clear first move',
      understanding: 'There are three real items and only one of them has a deadline tomorrow.',
      blockers: ['No clear first step', '', { label: 'Too many open loops' }],
      tasks: [
        {
          title: 'send the client deck',
          priority: 'urgent',
          durationMinutes: 999,
          dueDate: '2026-11-14',
          description: '  Finish and send the deck.  ',
          doneCriteria: 'The deck is sent.',
        },
        { title: 'x' },
      ],
    },
    NOW,
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.tasks.length, 1);
  assert.equal(result.data.tasks[0].title, 'Send the client deck');
  assert.equal(result.data.tasks[0].priority, 'High');
  assert.equal(result.data.tasks[0].durationMinutes, 240);
  assert.equal(result.data.blockers.length, 2);
});

test('validateAdaptation refuses adjustments for unknown tasks', () => {
  const result = validateAdaptation(
    {
      headline: 'Protect the report',
      assessment: 'You have less time, so the plan gets smaller instead of pretending otherwise.',
      adjustments: [
        { taskId: 'missing', action: 'defer', dueDate: '2026-11-20' },
        { taskId: 't1', action: 'reduce_scope', durationMinutes: 30 },
      ],
      nextAction: { title: 'Do a 30-minute slice', durationMinutes: 30 },
    },
    NOW,
    TASKS,
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.adjustments.length, 1);
  assert.equal(result.data.adjustments[0].taskId, 't1');
  assert.equal(result.data.adjustments[0].durationMinutes, 30);
});

test('validateAdaptation accepts an added task without an id', () => {
  const result = validateAdaptation(
    {
      headline: 'Create a starting point',
      assessment: 'The workspace is empty, so the first move is to make one small task.',
      adjustments: [
        {
          action: 'add',
          title: 'write down the one open loop',
          priority: 'high',
          durationMinutes: 10,
          dueDate: '2026-11-13',
        },
      ],
      nextAction: { title: 'Write it down', durationMinutes: 10 },
    },
    NOW,
    [],
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.adjustments[0].action, 'add');
  assert.equal(result.data.adjustments[0].taskId, null);
  assert.equal(result.data.adjustments[0].title, 'Write down the one open loop');
});

test('validateAdaptation rejects an empty adjustment list', () => {
  const result = validateAdaptation(
    { headline: 'No change', assessment: 'This assessment is long enough to pass validation, honestly.', adjustments: [] },
    NOW,
    TASKS,
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith('adjustments:')));
});

test('validateReflection requires a headline, body and next step', () => {
  const bad = validateReflection({ headline: '', reflection: 'short' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 2);

  const good = validateReflection({
    headline: 'Real movement on the deck',
    reflection:
      'You finished the opening section and sent two replies. The remaining work is a scheduling problem, not a discipline problem.',
    wins: ['Finished the opening section', 'Sent two replies', 'x'],
    nextSteps: ['Send three questions to the client', { title: 'Finish the draft', why: 'It closes the loop.' }],
  });
  assert.equal(good.ok, true);
  assert.equal(good.data.wins.length, 2);
  assert.equal(good.data.nextSteps.length, 2);
});
