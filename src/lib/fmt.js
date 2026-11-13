const DAY_MS = 86_400_000;

export function makeId(prefix = 'id') {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${uuid}`;
}

export function parseISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function toISODate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgoISO(n, from = new Date()) {
  const d = startOfDay(from);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

export function addDaysISO(iso, days) {
  const base = parseISODate(iso) || startOfDay(new Date());
  base.setDate(base.getDate() + days);
  return toISODate(base);
}

export function formatDueDate(iso, now = new Date()) {
  const date = parseISODate(iso);
  if (!date) return { label: 'No date', tone: 'none', overdue: false };
  const diff = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
  if (diff < 0) {
    return {
      label: diff === -1 ? '1 day overdue' : `${Math.abs(diff)} days overdue`,
      tone: 'overdue',
      overdue: true,
    };
  }
  if (diff === 0) return { label: 'Due today', tone: 'today', overdue: false };
  if (diff === 1) return { label: 'Tomorrow', tone: 'soon', overdue: false };
  if (diff < 7) {
    return {
      label: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date),
      tone: 'soon',
      overdue: false,
    };
  }
  return {
    label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date),
    tone: 'later',
    overdue: false,
  };
}

export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(iso, withTime = true) {
  const date = parseISODate(iso) || new Date(iso);
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function timeAgo(isoString, now = new Date()) {
  const then = new Date(isoString);
  const diff = Math.max(0, now.getTime() - then.getTime());
  if (diff < 45_000) return 'just now';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(isoString, false);
}

export function weekdayShort(date) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
}
