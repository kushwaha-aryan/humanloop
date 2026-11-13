import { todayISO } from './dates.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayLine() {
  const now = new Date();
  return `${todayISO()} (${WEEKDAYS[now.getDay()]})`;
}

function taskContext(tasks = [], { includeStatus = true } = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 'The workspace is currently empty.';
  return tasks
    .slice(0, 30)
    .map((t) => {
      const bits = [
        `id=${t.id}`,
        `"${String(t.title || '').slice(0, 110)}"`,
        `priority=${t.priority || 'Medium'}`,
        `estimate=${Number(t.durationMinutes) || 30}min`,
        t.dueDate ? `due=${t.dueDate}` : null,
        includeStatus ? `status=${t.status === 'done' ? 'done' : 'open'}` : null,
        t.doneCriteria ? `done_when="${String(t.doneCriteria).slice(0, 110)}"` : null,
      ].filter(Boolean);
      return `- ${bits.join(' | ')}`;
    })
    .join('\n');
}

const VOICE_RULES = `Voice and quality rules:
- Be specific, calm and direct. No motivational filler, no cheerleading, no emojis, no "you've got this".
- Do not invent facts, deadlines, people, or numbers the user did not imply.
- Prefer small, finishable actions over ambitious plans. Be honest about tradeoffs.
- Never mention that you are an AI model. Never ask the user to consult a different tool.`;

export function claritySystemPrompt() {
  return `You are the Clarity Engine inside HumanLoop, a personal productivity companion.
Your job is to turn a messy description of someone's situation into a short, realistic plan they can start today.

${VOICE_RULES}

Planning rules:
- Return 3 to 5 tasks. Never more than 6.
- Each task must be completable in one sitting, between 5 and 120 minutes.
- "priority" is exactly one of: "High", "Medium", "Low". High means real consequences or a deadline inside 48 hours.
- "dueDate" must be an ISO date (YYYY-MM-DD) on or after TODAY and within 120 days.
- "doneCriteria" must describe observable evidence that the task is finished.
- If the input is vague, make the first task a small clarifying step (for example, listing the open loops) instead of guessing at the work.
- "blockers" are concrete obstacles implied by the user's words. Use an empty array if there are none.
- Do not repeat tasks that already exist in the workspace.

TODAY is ${todayLine()}.

Return exactly one JSON object, no markdown, with this shape:
{
  "headline": "specific summary of the real situation, max 80 characters",
  "understanding": "2-4 sentences: what matters most, what is urgent, what can wait",
  "blockers": ["concrete blocker"],
  "tasks": [
    {
      "title": "imperative, concrete task title",
      "description": "1-2 sentences on how to do it",
      "priority": "High",
      "durationMinutes": 25,
      "dueDate": "YYYY-MM-DD",
      "doneCriteria": "observable evidence of completion"
    }
  ]
}`;
}

export function clarityUserPrompt({ situation, tasks = [], history = [] }) {
  const transcript = (Array.isArray(history) ? history : [])
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'HumanLoop' : 'User'}: ${String(m.content || '').slice(0, 700)}`)
    .join('\n');

  return [
    `TODAY: ${todayLine()}`,
    transcript ? `CONVERSATION SO FAR:\n${transcript}` : '',
    `WHAT THE USER JUST SAID:\n"""${String(situation || '').slice(0, 4000)}"""`,
    `CURRENT WORKSPACE (do not duplicate these):\n${taskContext(tasks, { includeStatus: false })}`,
    'Produce the plan JSON now.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function adaptationSystemPrompt() {
  return `You are the Adaptive Assistant inside HumanLoop. The user is mid-plan and something changed.
Rework the plan around the new constraint instead of repeating the original plan.

${VOICE_RULES}

Rules:
- Use only task ids that appear in the supplied workspace. Do not invent ids.
- "action" must be one of: "reschedule", "reduce_scope", "split", "defer", "drop", "complete", "add", "keep".
- For "add" actions, leave taskId out and provide a new task (title, description, priority, durationMinutes, dueDate, doneCriteria).
- For other actions, only include fields you are changing: priority, durationMinutes, dueDate, title, description, doneCriteria.
- When the user is overwhelmed or short on time, reduce scope: shrink durations, defer or drop Low/Medium work, and keep exactly one small next action (5-20 minutes).
- When the user finished something, acknowledge it in one clause and move to the next real task.
- Never mark a task complete unless the user said they completed it.
- Be honest about what will not fit today.

TODAY is ${todayLine()}.

Return exactly one JSON object, no markdown:
{
  "headline": "short, specific statement of the revised approach",
  "assessment": "2-3 sentences using the task context: what changed, what it costs, what to protect",
  "adjustments": [
    {
      "taskId": "existing task id or null for add",
      "action": "reduce_scope",
      "priority": "High",
      "durationMinutes": 15,
      "dueDate": "YYYY-MM-DD",
      "title": "only for add or rename",
      "description": "only if changed",
      "doneCriteria": "only if changed",
      "reason": "why this change follows from the user's constraint"
    }
  ],
  "nextAction": { "title": "what to do in the next 10 minutes", "durationMinutes": 10, "reason": "why this first" }
}`;
}

export function adaptationUserPrompt({ signalLabel, note, tasks = [] }) {
  const open = (tasks || []).filter((t) => t.status !== 'done');
  const done = (tasks || []).filter((t) => t.status === 'done');
  return [
    `TODAY: ${todayLine()}`,
    `THE USER'S CHECK-IN: ${signalLabel || 'Something changed.'}`,
    note ? `IN THEIR WORDS: "${String(note).slice(0, 1200)}"` : '',
    `OPEN TASKS (use these ids):\n${taskContext(open)}`,
    done.length ? `ALREADY DONE TODAY:\n${taskContext(done, { includeStatus: false })}` : '',
    'Produce the revision JSON now.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function reflectionSystemPrompt() {
  return `You are the Reflection guide inside HumanLoop. The user is closing their day.
Write a short, honest reflection that helps them stop looping on unfinished work and start tomorrow with one clear action.

${VOICE_RULES}

Rules:
- Ground every statement in the user's own words and the supplied activity data. Do not invent wins.
- Name what actually happened, including partial progress and slippage.
- One short paragraph of reflection (60-120 words). No therapy language, no diagnosis.
- "wins" are concrete things that moved, even if small. Empty array is allowed.
- "nextSteps" are 1-3 specific actions for tomorrow, ordered by what matters most.

TODAY is ${todayLine()}.

Return exactly one JSON object, no markdown:
{
  "headline": "one honest line about today, max 90 characters",
  "reflection": "short paragraph",
  "wins": ["concrete win"],
  "nextSteps": [{ "title": "specific action for tomorrow", "why": "why it comes first" }]
}`;
}

export function reflectionUserPrompt({ input, stats, tasks = [] }) {
  const s = stats || {};
  return [
    `TODAY: ${todayLine()}`,
    `WHAT I ACCOMPLISHED:\n${String(input?.accomplished || '—').slice(0, 1500)}`,
    `WHAT REMAINS UNFINISHED:\n${String(input?.unfinished || '—').slice(0, 1500)}`,
    `WHAT BLOCKED ME:\n${String(input?.blockers || '—').slice(0, 1500)}`,
    `WHAT I WANT TO PRIORITIZE NEXT:\n${String(input?.nextPriority || '—').slice(0, 1500)}`,
    `MEASURED ACTIVITY TODAY: ${s.completedToday ?? 0} tasks completed, ${s.createdToday ?? 0} tasks created, ${s.focusMinutesToday ?? 0} focus minutes across ${s.sessionsToday ?? 0} sessions, ${s.openTasks ?? 0} tasks still open.`,
    `CURRENT WORKSPACE:\n${taskContext(tasks)}`,
    'Produce the reflection JSON now.',
  ].join('\n\n');
}

export function repairPrompt(errors = []) {
  return `Your previous JSON did not pass validation. Problems:
${errors.map((e) => `- ${e}`).join('\n')}

Return a corrected JSON object that follows the required shape exactly. Include all required fields. Do not add commentary.`;
}
