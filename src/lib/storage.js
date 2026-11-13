import { makeId } from './fmt.js';

export const STORAGE_KEY = 'humanloop.state.v1';
export const SCHEMA_VERSION = 1;

export const PRIORITIES = ['High', 'Medium', 'Low'];
export const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

export const PROMPT_SUGGESTIONS = [
  'I have four assignments due this week, a part-time job, and I keep starting everything at once.',
  'I need to sort out an overdue bill and I have been avoiding it for a week.',
  'I have three hours today and a list that feels impossible.',
];

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      name: '',
      focusMinutes: 25,
      dailyCapacityMinutes: 180,
      theme: 'dark',
    },
    tasks: [],
    sessions: [],
    activities: [],
    reflections: [],
    conversation: [],
  };
}

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function normalizeTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = cleanText(raw.title, 160);
  if (!title) return null;
  const status = raw.status === 'done' ? 'done' : 'open';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('task'),
    title,
    description: cleanText(raw.description, 800),
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'Medium',
    durationMinutes: clamp(raw.durationMinutes, 5, 240, 30),
    dueDate: typeof raw.dueDate === 'string' ? raw.dueDate.slice(0, 10) : '',
    doneCriteria: cleanText(raw.doneCriteria, 400),
    status,
    createdAt: raw.createdAt || new Date().toISOString(),
    completedAt: status === 'done' ? raw.completedAt || new Date().toISOString() : null,
    source: raw.source === 'ai' || raw.source === 'plan' ? raw.source : 'manual',
  };
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const minutes = clamp(raw.minutes, 0, 600, 0);
  if (minutes <= 0) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('session'),
    taskId: typeof raw.taskId === 'string' ? raw.taskId : null,
    taskTitle: cleanText(raw.taskTitle, 160) || 'Focus session',
    minutes,
    date: typeof raw.date === 'string' ? raw.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    startedAt: raw.startedAt || new Date().toISOString(),
    endedAt: raw.endedAt || new Date().toISOString(),
    completed: Boolean(raw.completed),
  };
}

function normalizeActivity(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const message = cleanText(raw.message, 240);
  if (!message) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('act'),
    type: cleanText(raw.type, 40) || 'note',
    message,
    at: raw.at || new Date().toISOString(),
  };
}

function normalizeReflection(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const result = raw.result;
  if (!result || typeof result !== 'object') return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('refl'),
    createdAt: raw.createdAt || new Date().toISOString(),
    mode: raw.mode === 'live' ? 'live' : 'demo',
    input: {
      accomplished: cleanText(raw.input?.accomplished, 2000),
      unfinished: cleanText(raw.input?.unfinished, 2000),
      blockers: cleanText(raw.input?.blockers, 2000),
      nextPriority: cleanText(raw.input?.nextPriority, 2000),
    },
    result: {
      headline: cleanText(result.headline, 200),
      reflection: typeof result.reflection === 'string' ? result.reflection.slice(0, 2000) : '',
      wins: Array.isArray(result.wins) ? result.wins.map((w) => cleanText(w, 200)).filter(Boolean).slice(0, 6) : [],
      nextSteps: Array.isArray(result.nextSteps)
        ? result.nextSteps
            .map((s) => ({
              title: cleanText(s?.title, 200),
              why: cleanText(s?.why, 300),
            }))
            .filter((s) => s.title)
            .slice(0, 5)
        : [],
    },
  };
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const content = typeof raw.content === 'string' ? raw.content.slice(0, 6000) : '';
  if (raw.role === 'user') {
    return content ? { id: raw.id || makeId('msg'), role: 'user', content, at: raw.at || new Date().toISOString() } : null;
  }
  if (raw.role !== 'assistant') return null;
  const message = {
    id: raw.id || makeId('msg'),
    role: 'assistant',
    content,
    at: raw.at || new Date().toISOString(),
    mode: raw.mode === 'live' ? 'live' : 'demo',
  };
  if (raw.plan && typeof raw.plan === 'object') {
    const plan = raw.plan;
    message.plan = {
      headline: cleanText(plan.headline, 200),
      understanding: typeof plan.understanding === 'string' ? plan.understanding.slice(0, 2000) : '',
      blockers: Array.isArray(plan.blockers) ? plan.blockers.map((b) => cleanText(b, 200)).filter(Boolean).slice(0, 6) : [],
      tasks: Array.isArray(plan.tasks)
        ? plan.tasks
            .map((t) => normalizeTask({ ...t, source: 'plan' }))
            .filter(Boolean)
            .slice(0, 8)
        : [],
    };
  }
  if (raw.error) message.error = cleanText(raw.error, 400);
  return message;
}

/** Merge stored JSON with defaults defensively — corrupt data must never crash the app. */
export function hydrateState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;

  const profile = raw.profile && typeof raw.profile === 'object' ? raw.profile : {};
  const state = {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      name: cleanText(profile.name, 60),
      focusMinutes: clamp(profile.focusMinutes, 5, 120, 25),
      dailyCapacityMinutes: clamp(profile.dailyCapacityMinutes, 30, 720, 180),
      theme: profile.theme === 'light' ? 'light' : 'dark',
    },
    tasks: Array.isArray(raw.tasks) ? raw.tasks.map(normalizeTask).filter(Boolean).slice(0, 500) : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions.map(normalizeSession).filter(Boolean).slice(0, 500) : [],
    activities: Array.isArray(raw.activities) ? raw.activities.map(normalizeActivity).filter(Boolean).slice(0, 200) : [],
    reflections: Array.isArray(raw.reflections)
      ? raw.reflections.map(normalizeReflection).filter(Boolean).slice(0, 50)
      : [],
    conversation: Array.isArray(raw.conversation) ? raw.conversation.map(normalizeMessage).filter(Boolean).slice(-40) : [],
  };
  return state;
}

export function loadState() {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return hydrateState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function makeTask(input = {}) {
  return {
    id: makeId('task'),
    title: cleanText(input.title, 160),
    description: cleanText(input.description, 800),
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'Medium',
    durationMinutes: clamp(input.durationMinutes, 5, 240, 30),
    dueDate: input.dueDate || '',
    doneCriteria: cleanText(input.doneCriteria, 400),
    status: 'open',
    createdAt: new Date().toISOString(),
    completedAt: null,
    source: input.source === 'ai' || input.source === 'plan' ? input.source : 'manual',
  };
}

export function makeActivity(type, message) {
  return { id: makeId('act'), type, message: cleanText(message, 240), at: new Date().toISOString() };
}
