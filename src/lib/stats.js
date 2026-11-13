import { PRIORITY_RANK } from './storage.js';
import { daysAgoISO, formatDueDate, parseISODate, toISODate, todayISO, weekdayShort } from './fmt.js';

export function sortTasks(tasks = [], now = new Date()) {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
    const priority = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    if (priority !== 0) return priority;
    const aDue = parseISODate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = parseISODate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

export function getOpenTasks(tasks = []) {
  return sortTasks(tasks.filter((t) => t.status !== 'done'));
}

export function getNextTasks(tasks = [], count = 4) {
  return getOpenTasks(tasks).slice(0, count);
}

export function computeStreak(state, now = new Date()) {
  const sessionDays = new Set((state.sessions || []).map((s) => s.date));
  const completionDays = new Set(
    (state.tasks || [])
      .filter((t) => t.completedAt)
      .map((t) => toISODate(new Date(t.completedAt))),
  );
  const active = (iso) => sessionDays.has(iso) || completionDays.has(iso);

  const today = todayISO();
  let count = 0;
  let cursor = 0;
  if (!active(today)) {
    const yesterday = daysAgoISO(1, now);
    if (!active(yesterday)) return { days: 0, includesToday: false };
    cursor = 1;
  }
  for (let i = cursor; i < 400; i += 1) {
    if (!active(daysAgoISO(i, now))) break;
    count += 1;
  }
  return { days: count, includesToday: active(today) };
}

export function computeStats(state, now = new Date()) {
  const tasks = state.tasks || [];
  const sessions = state.sessions || [];
  const today = todayISO();
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const doneToday = done.filter((t) => t.completedAt && toISODate(new Date(t.completedAt)) === today);
  const createdToday = tasks.filter((t) => t.createdAt && toISODate(new Date(t.createdAt)) === today);
  const overdue = open.filter((t) => formatDueDate(t.dueDate, now).overdue);
  const dueToday = open.filter((t) => t.dueDate === today);
  const sessionsToday = sessions.filter((s) => s.date === today);
  const focusMinutesToday = sessionsToday.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);

  const last7 = Array.from({ length: 7 }, (_, index) => {
    const iso = daysAgoISO(6 - index, now);
    const date = parseISODate(iso);
    const minutes = sessions.filter((s) => s.date === iso).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
    return {
      iso,
      minutes,
      label: weekdayShort(date).slice(0, 2),
      isToday: iso === today,
    };
  });

  const priorityOpen = { High: 0, Medium: 0, Low: 0 };
  for (const task of open) priorityOpen[task.priority] = (priorityOpen[task.priority] || 0) + 1;

  const total = tasks.length;
  const completionPct = total === 0 ? 0 : Math.round((done.length / total) * 100);
  const capacity = state.profile?.dailyCapacityMinutes || 180;
  const weekMinutes = last7.reduce((sum, day) => sum + day.minutes, 0);
  const avgSession = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0) / sessions.length)
    : 0;

  return {
    total,
    completed: done.length,
    pending: open.length,
    completionPct,
    overdue: overdue.length,
    dueToday: dueToday.length,
    highOpen: priorityOpen.High,
    priorityOpen,
    focusMinutesToday,
    focusMinutesWeek: weekMinutes,
    sessionsToday: sessionsToday.length,
    completedToday: doneToday.length,
    createdToday: createdToday.length,
    avgSession,
    last7,
    capacity,
    capacityPct: capacity > 0 ? Math.min(100, Math.round((focusMinutesToday / capacity) * 100)) : 0,
    streak: computeStreak(state, now),
    openTasks: open,
    doneTasks: done,
  };
}

export function activityIcon(type) {
  switch (type) {
    case 'task_created':
      return 'plus';
    case 'task_completed':
      return 'check';
    case 'task_updated':
    case 'plan_applied':
      return 'edit';
    case 'task_deleted':
      return 'trash';
    case 'focus':
      return 'timer';
    case 'reflection':
      return 'book';
    default:
      return 'dot';
  }
}
