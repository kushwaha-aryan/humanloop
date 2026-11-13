import { PRIORITIES } from './validate.js';
import { normalizeDueDate, parseISODate } from './dates.js';

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function readString(value, { field, min = 0, max = 4000, required = false }) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && text.length < min) {
    return { ok: false, message: `${field} must be at least ${min} characters.` };
  }
  if (text.length > max) {
    return { ok: false, message: `${field} must be under ${max} characters.` };
  }
  return { ok: true, value: text };
}

/** Only the fields the prompts need — never trust arbitrary client objects. */
export function sanitizeTasks(input, { max = 40 } = {}) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, max)
    .map((task) => {
      if (!task || typeof task !== 'object') return null;
      const id = clean(task.id, 64);
      const title = clean(task.title, 140);
      if (!id || !title) return null;
      const priority = PRIORITIES.includes(task.priority) ? task.priority : 'Medium';
      const duration = Number(task.durationMinutes);
      return {
        id,
        title,
        priority,
        durationMinutes: Number.isFinite(duration) ? Math.min(240, Math.max(5, Math.round(duration))) : 30,
        dueDate: parseISODate(task.dueDate) ? normalizeDueDate(task.dueDate) : null,
        status: task.status === 'done' ? 'done' : 'open',
        doneCriteria: clean(task.doneCriteria, 220),
        description: clean(task.description, 400),
      };
    })
    .filter(Boolean);
}

export function sanitizeHistory(input, { max = 8, maxChars = 900 } = {}) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-max)
    .map((message) => {
      if (!message || typeof message !== 'object') return null;
      const role = message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : null;
      const content = clean(message.content, maxChars);
      if (!role || !content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

export function sanitizeStats(input) {
  const obj = input && typeof input === 'object' ? input : {};
  const num = (value, max = 10000) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0;
  };
  return {
    completedToday: num(obj.completedToday, 500),
    createdToday: num(obj.createdToday, 500),
    focusMinutesToday: num(obj.focusMinutesToday, 1440),
    sessionsToday: num(obj.sessionsToday, 100),
    openTasks: num(obj.openTasks, 500),
  };
}

export const SIGNALS = ['couldnt_finish', 'less_time', 'urgent', 'completed', 'overwhelmed'];
