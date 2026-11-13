/** Date helpers shared by the AI validators and the demo planner (server-side, local time). */

export function toISODate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDaysISO(days, from = new Date()) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + Number(days || 0));
  return toISODate(d);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value.trim())) return null;
  const [y, m, d] = value.trim().split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Keep model-supplied deadlines inside a sane window so the planner stays realistic. */
export function normalizeDueDate(value, { today = new Date(), minOffset = 0, maxOffset = 120 } = {}) {
  const parsed = parseISODate(value);
  const min = new Date(today);
  min.setHours(0, 0, 0, 0);
  min.setDate(min.getDate() + minOffset);
  const max = new Date(today);
  max.setHours(23, 59, 59, 999);
  max.setDate(max.getDate() + maxOffset);

  if (!parsed) return addDaysISO(3, today);
  if (parsed < min) return toISODate(min);
  if (parsed > max) return toISODate(max);
  return toISODate(parsed);
}
