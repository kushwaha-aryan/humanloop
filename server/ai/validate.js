import { normalizeDueDate } from './dates.js';

export const PRIORITIES = ['High', 'Medium', 'Low'];
export const ADJUSTMENT_ACTIONS = [
  'reschedule',
  'reduce_scope',
  'split',
  'defer',
  'drop',
  'complete',
  'add',
  'keep',
];

const clampInt = (value, min, max) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};

/** Trim, collapse whitespace, drop control characters, and cap length. */
export function cleanText(value, max = 280) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function asArray(value, max) {
  if (Array.isArray(value)) return value.slice(0, max);
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n|\s*[;•]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, max);
  }
  return [];
}

export function normalizePriority(value, fallback = 'Medium') {
  const s = cleanText(String(value ?? ''), 24).toLowerCase();
  if (!s) return fallback;
  if (s.startsWith('h') || s.includes('urgent') || s.includes('critical') || s === 'p1') return 'High';
  if (s.startsWith('l') || s.includes('someday') || s.includes('later') || s === 'p3') return 'Low';
  if (s.startsWith('m') || s === 'p2') return 'Medium';
  return fallback;
}

function normalizeDuration(value, fallback) {
  const n = clampInt(value, 5, 240);
  if (n === null) return fallback;
  // Round to a usable block: 5-minute granularity.
  return Math.max(5, Math.round(n / 5) * 5);
}

function normalizeTaskTitle(value) {
  const title = cleanText(value, 120);
  if (title.length < 3) return '';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function validatePlanTask(raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  const title = normalizeTaskTitle(raw.title);
  if (!title) return null;
  return {
    title,
    description: cleanText(raw.description, 400) || `Focus only on the next visible step of “${title}”.`,
    priority: normalizePriority(raw.priority),
    durationMinutes: normalizeDuration(raw.durationMinutes, 30),
    dueDate: normalizeDueDate(raw.dueDate, { today: now }),
    doneCriteria:
      cleanText(raw.doneCriteria, 220) ||
      'The task is visibly finished and the output is saved somewhere you can find it.',
  };
}

/**
 * Validate a Clarity Engine plan. Fatal problems (no usable tasks, missing
 * framing) return ok:false so the API can ask the model to repair its output.
 */
export function validateClarityPlan(raw, now = new Date()) {
  const errors = [];
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const tasks = asArray(obj.tasks, 8)
    .map((task) => validatePlanTask(task, now))
    .filter(Boolean)
    .slice(0, 6);

  if (tasks.length === 0) errors.push('tasks: at least one valid task is required');

  const headline = cleanText(obj.headline, 80);
  const understanding = cleanText(obj.understanding, 600);
  if (headline.length < 6) errors.push('headline: required (6-80 characters)');
  if (understanding.length < 20) errors.push('understanding: required (20-600 characters)');

  if (errors.length) return { ok: false, errors };

  const blockers = asArray(obj.blockers, 4)
    .map((b) => cleanText(typeof b === 'string' ? b : b?.label, 160))
    .filter((b) => b.length >= 3);

  return {
    ok: true,
    data: {
      headline,
      understanding,
      blockers,
      tasks,
    },
  };
}

function validateAdjustment(raw, now, validTaskIds) {
  if (!raw || typeof raw !== 'object') return null;
  const action = cleanText(raw.action, 20).toLowerCase();
  if (!ADJUSTMENT_ACTIONS.includes(action)) return null;

  const taskId = cleanText(raw.taskId, 64) || null;
  if (action !== 'add' && (!taskId || !validTaskIds.has(taskId))) return null;

  const adjustment = {
    taskId,
    action,
    reason: cleanText(raw.reason, 200) || 'Adjusted to match your available time and energy.',
  };

  if (action === 'add') {
    const title = normalizeTaskTitle(raw.title);
    if (!title) return null;
    adjustment.title = title;
    adjustment.description = cleanText(raw.description, 400) || `Next step created from your check-in: ${title}.`;
    adjustment.priority = normalizePriority(raw.priority);
    adjustment.durationMinutes = normalizeDuration(raw.durationMinutes, 25);
    adjustment.dueDate = normalizeDueDate(raw.dueDate, { today: now });
    adjustment.doneCriteria = cleanText(raw.doneCriteria, 220) || 'The new task is visibly finished and saved.';
    adjustment.taskId = null;
    return adjustment;
  }

  if (raw.priority !== undefined && raw.priority !== null) {
    adjustment.priority = normalizePriority(raw.priority);
  }
  if (raw.durationMinutes !== undefined && raw.durationMinutes !== null) {
    adjustment.durationMinutes = normalizeDuration(raw.durationMinutes, 20);
  }
  if (raw.dueDate !== undefined && raw.dueDate !== null) {
    adjustment.dueDate = normalizeDueDate(raw.dueDate, { today: now });
  }
  if (raw.title !== undefined) {
    const title = normalizeTaskTitle(raw.title);
    if (title) adjustment.title = title;
  }
  if (raw.description !== undefined) {
    const description = cleanText(raw.description, 400);
    if (description) adjustment.description = description;
  }
  if (raw.doneCriteria !== undefined) {
    const doneCriteria = cleanText(raw.doneCriteria, 220);
    if (doneCriteria) adjustment.doneCriteria = doneCriteria;
  }
  return adjustment;
}

export function validateAdaptation(raw, now = new Date(), tasks = []) {
  const errors = [];
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const validTaskIds = new Set(tasks.map((t) => t.id).filter(Boolean));

  const headline = cleanText(obj.headline, 90);
  const assessment = cleanText(obj.assessment, 600);
  if (headline.length < 4) errors.push('headline: required (4-90 characters)');
  if (assessment.length < 20) errors.push('assessment: required (20-600 characters)');

  const adjustments = asArray(obj.adjustments, 8)
    .map((a) => validateAdjustment(a, now, validTaskIds))
    .filter(Boolean)
    .slice(0, 6);

  if (adjustments.length === 0) errors.push('adjustments: at least one actionable adjustment is required');

  const nextRaw = obj.nextAction && typeof obj.nextAction === 'object' ? obj.nextAction : {};
  const nextAction = {
    title: normalizeTaskTitle(nextRaw.title),
    durationMinutes: normalizeDuration(nextRaw.durationMinutes, 10),
    reason: cleanText(nextRaw.reason, 200) || 'The smallest useful step available to you right now.',
  };
  if (!nextAction.title) errors.push('nextAction.title: required');

  if (errors.length) return { ok: false, errors };

  return { ok: true, data: { headline, assessment, adjustments, nextAction } };
}

export function validateReflection(raw) {
  const errors = [];
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const headline = cleanText(obj.headline, 90);
  const reflection = cleanText(obj.reflection, 900);
  if (headline.length < 4) errors.push('headline: required (4-90 characters)');
  if (reflection.length < 40) errors.push('reflection: required (40-900 characters)');

  const wins = asArray(obj.wins, 5)
    .map((w) => cleanText(w, 160))
    .filter((w) => w.length >= 3);

  const nextSteps = asArray(obj.nextSteps, 5)
    .map((step) => {
      if (typeof step === 'string') {
        const title = normalizeTaskTitle(step);
        return title ? { title, why: 'Keeps momentum on the most important open loop.' } : null;
      }
      if (!step || typeof step !== 'object') return null;
      const title = normalizeTaskTitle(step.title);
      if (!title) return null;
      return {
        title,
        why: cleanText(step.why, 200) || 'Keeps momentum on the most important open loop.',
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  if (nextSteps.length === 0) errors.push('nextSteps: at least one next step is required');

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { headline, reflection, wins, nextSteps } };
}
