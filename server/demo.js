/**
 * Demo Mode generators.
 *
 * These are deterministic, locally-generated sample responses derived from what
 * the user actually typed. They are NOT model output and the UI labels them as
 * samples. Same input + same day → same plan, which makes them predictable
 * enough to demo and easy to test.
 */
import { addDaysISO, todayISO } from './ai/dates.js';

const DOMAINS = [
  {
    id: 'study',
    test: /\b(assignment|exam|study|homework|thesis|report|quiz|class|lecture|submission|submit|grade|course|project)\b/i,
    minutes: 50,
    description:
      'Open the material, work in one uninterrupted block, and produce one visible section or solved problem rather than reviewing everything.',
    done: 'A draft, section, or solved set exists in the right file and the remaining work is written down.',
  },
  {
    id: 'money',
    test: /\b(bill|rent|pay|payment|invoice|tax|budget|bank|loan|fee|insurance|expense|salary)\b/i,
    minutes: 20,
    description:
      'Open the exact bill or banking page, confirm the amount and due date, then complete the payment or form in one pass.',
    done: 'The payment or form is submitted and the confirmation or receipt is saved where you can find it.',
  },
  {
    id: 'work',
    test: /\b(meeting|client|deck|slide|standup|manager|team|presentation|interview|apply|application|resume|portfolio|proposal)\b/i,
    minutes: 40,
    description:
      'Decide the one outcome this needs, assemble the minimum material, and produce a complete rough version you could send.',
    done: 'A sendable version exists and the next person who needs it has been told what changed.',
  },
  {
    id: 'comms',
    test: /\b(email|inbox|reply|respond|message|slack|whatsapp|call|phone|text|follow.?up)\b/i,
    minutes: 15,
    description:
      'Write the short version first: three to five sentences, one clear ask, then send it without polishing further.',
    done: 'The message is sent and any promised follow-up date is on your calendar.',
  },
  {
    id: 'admin',
    test: /\b(form|document|paperwork|renew|register|book|appointment|visa|passport|license|id|application)\b/i,
    minutes: 25,
    description:
      'Gather the two or three required details, fill the form once, and submit before you start reorganising anything else.',
    done: 'The submitted confirmation or reference number is saved in one place.',
  },
  {
    id: 'home',
    test: /\b(clean|laundry|grocery|groceries|cook|kitchen|room|dishes|trash|repair|move|pack|tidy)\b/i,
    minutes: 30,
    description:
      'Set a timer and finish one contained area end-to-end instead of rotating between rooms or half-finished piles.',
    done: 'One area is fully finished and the supplies needed for next time are back in place.',
  },
  {
    id: 'code',
    test: /\b(code|bug|deploy|build|api|feature|test|github|repo|debug|release|server|database|refactor)\b/i,
    minutes: 45,
    description:
      'Reproduce the smallest failing case, fix only that, and verify with a test or a manual check before touching anything else.',
    done: 'The failing case now passes, the change is committed, and the verification command is recorded.',
  },
  {
    id: 'health',
    test: /\b(doctor|dentist|gym|workout|sleep|health|therapy|medicine|walk|run|appointment)\b/i,
    minutes: 25,
    description:
      'Book the slot or do the shortest complete version of the activity; skip planning the perfect routine.',
    done: 'The appointment is booked or the session is logged with a real duration.',
  },
];
const DEFAULT_DOMAIN = {
  id: 'general',
  minutes: 30,
  description:
    'Write the first physical action on paper, then spend one sitting on that action only. Stop when you can point at something that changed.',
  done: 'You can point at a concrete output (file, message, decision, or completed chore) and it is saved.',
};

const URGENT = /\b(today|tonight|tomorrow|asap|urgent|overdue|deadline|due|this week|by (?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i;
const LOW_ENERGY = /\b(someday|eventually|later|when i (?:can|have time)|if i have time|no rush)\b/i;
const FEELING =
  /^(?:i(?:'m| am)?\s+)?(?:just\s+|so\s+|really\s+)?(?:overwhelmed|stressed|anxious|tired|exhausted|scared|worried|burnt out|burned out|feeling|confused|lost)\b/i;

const BLOCKER_RULES = [
  [/don'?t know|not sure|no idea|unclear|where to start/i, 'No clear first step'],
  [/overwhelm|too much|drowning|so much|stressed|anxious|chaos/i, 'Too many open loops at once'],
  [/no time|busy|packed|swamped|less time|short on time|running out/i, 'Available time is smaller than the plan assumes'],
  [/waiting|blocked|depend|approval|reply from|hear back/i, 'Waiting on another person'],
  [/procrastinat|avoid|putting off|keep not|stuck/i, 'Avoidance on one specific task'],
];

function truncate(value, max = 90) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text.replace(/[\s,;:.\-–—]+$/, '').trim();
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, '').trim();
}

function sentenceCase(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function domainFor(text) {
  return DOMAINS.find((domain) => domain.test.test(text)) || DEFAULT_DOMAIN;
}

function stripLead(value) {
  return String(value || '')
    .replace(/^[\s•\-–—*]+/, '')
    .replace(
      /^(?:so\s+|and\s+|also\s+|but\s+)?(?:i|we)\s+(?:really\s+)?(?:need|have|want|must|should|'?ve|have)\s+(?:to\s+)?/i,
      '',
    )
    .replace(/^(?:need|have|got|gotta|must|should)\s+to\s+/i, '')
    .replace(/^(?:and|then|also|plus|but|so|or)\s+/i, '')
    .replace(/^i\s+(?:keep|still)\s+/i, '')
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/^(?:please\s+)?(?:help me\s+)?/i, '')
    .replace(/^(?:to\s+)/i, '')
    .trim();
}

/** Split free text into short, task-shaped fragments. */
export function extractItems(text, limit = 5) {
  const source = String(text || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' • ');
  const parts = source.split(
    /•|[.;!?]+|\s+and\s+(?=(?:i|we|my|the|there|also)\b)|\s+(?:also|then|plus)\s+|,\s*/i,
  );

  const seen = new Set();
  const items = [];
  for (const part of parts) {
    const cleaned = part.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 4) continue;
    if (FEELING.test(cleaned)) continue;
    if (/^(?:i|we)\s+(?:don'?t|can'?t|didn'?t|haven'?t)\b/i.test(cleaned)) continue;

    const stripped = stripLead(cleaned);
    if (stripped.length < 4) continue;
    const key = stripped.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(truncate(stripped, 88));
    if (items.length >= limit) break;
  }
  return items;
}

function deriveBlockers(text, itemCount) {
  const blockers = [];
  for (const [pattern, label] of BLOCKER_RULES) {
    if (pattern.test(text) && !blockers.includes(label)) blockers.push(label);
  }
  if (itemCount >= 4) blockers.push('Plan is larger than one day of capacity');
  if (!URGENT.test(text) && itemCount > 1) blockers.push('No stated deadline, so everything competes equally');
  return blockers.slice(0, 4);
}

function dueFor(priority, text, index) {
  const urgentToday = /\b(today|tonight|asap|urgent|overdue)\b/i.test(text);
  const tomorrow = /\btomorrow\b/i.test(text);
  if (priority === 'High') {
    if (urgentToday) return todayISO();
    if (tomorrow) return addDaysISO(1);
    return addDaysISO(index === 0 ? 1 : 2);
  }
  if (priority === 'Medium') return addDaysISO(4 + index);
  return addDaysISO(9 + index);
}

function durationFor(domain, text) {
  if (/\b(quick|5 min|10 min|15 min|just a minute|small)\b/i.test(text)) return 15;
  if (/\b(long|deep|full day|hours)\b/i.test(text)) return Math.min(120, domain.minutes + 30);
  return Math.min(120, domain.minutes);
}

function priorityFor(item, text, index, urgentHits) {
  if (LOW_ENERGY.test(item)) return 'Low';
  if (URGENT.test(item)) return 'High';
  if (index === 0) return urgentHits ? 'High' : 'Medium';
  if (index >= 3 && !urgentHits) return 'Low';
  return 'Medium';
}

function fallbackItems(focus) {
  const subject = truncate(focus || 'the thing you keep avoiding', 46);
  return [
    `List every open loop around ${subject}`,
    `Do a 20-minute first slice of ${subject}`,
    'Decide what to ignore this week',
  ];
}

export function demoClarityPlan({ situation, now = new Date() } = {}) {
  const text = String(situation || '').trim();
  let items = extractItems(text, 5);
  if (items.length === 0) items = fallbackItems(text);
  if (items.length < 3) {
    items = [...items, ...fallbackItems(items[0])].slice(0, 3);
  }

  const urgentHits = URGENT.test(text);

  const tasks = items.slice(0, 5).map((item, index) => {
    const domain = domainFor(item);
    const priority = priorityFor(item, text, index, urgentHits);
    return {
      title: sentenceCase(item),
      description: `${domain.description} Your note: “${truncate(item, 110)}”.`,
      priority,
      durationMinutes: durationFor(domain, item),
      dueDate: dueFor(priority, text, index),
      doneCriteria: domain.done,
    };
  });

  const highCount = tasks.filter((t) => t.priority === 'High').length;
  const blockers = deriveBlockers(text, items.length);
  const first = truncate(tasks[0].title, 42);
  const headline = truncate(
    highCount > 0 ? `Protect today: start with ${first}` : `Start small, then sequence: ${first}`,
    80,
  );

  const understanding = [
    `There ${tasks.length === 1 ? 'is 1 concrete item' : `are ${tasks.length} concrete items`} in what you shared.`,
    highCount > 0
      ? `${highCount} of them carry real time pressure, so those come first and the rest can wait without becoming urgent.`
      : 'Nothing reads as same-day urgent, which means sequence matters more than speed.',
    items.length >= 4
      ? 'The list is wider than one day of realistic capacity, so this plan deliberately leaves work out.'
      : 'Each block below is sized to finish in one sitting.',
    'The first task is intentionally small enough to start without negotiating with yourself.',
  ].join(' ');

  return { headline, understanding, blockers, tasks };
}

const SIGNALS = {
  couldnt_finish: {
    label: "I couldn't finish this task",
    headline: 'Shrink the task instead of the day',
  },
  less_time: {
    label: 'I have less time than expected',
    headline: 'Resize the plan to fit the time you actually have',
  },
  urgent: {
    label: 'Something urgent came up',
    headline: 'Make room for the interruption, protect the critical work',
  },
  completed: {
    label: 'I completed this task',
    headline: 'Bank the win and move to the next real task',
  },
  overwhelmed: {
    label: 'I am feeling overwhelmed',
    headline: 'Cut the plan down to one starting point',
  },
};

export function signalLabel(signal, fallback = 'Something changed') {
  return SIGNALS[signal]?.label || fallback;
}

const byOrder = (a, b) => {
  const rank = { High: 0, Medium: 1, Low: 2 };
  const priority = (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
  if (priority !== 0) return priority;
  return String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
};

export function demoAdaptation({ signal, note, tasks = [], now = new Date() } = {}) {
  const open = tasks.filter((t) => t.status !== 'done').sort(byOrder);
  const done = tasks.filter((t) => t.status === 'done');
  const primary = open[0] || null;
  const rest = open.slice(1);
  const adjustments = [];
  const noteText = String(note || '').trim();
  const noteItems = extractItems(noteText, 1);
  const urgentTitle = noteItems[0] ? `Handle: ${truncate(noteItems[0], 70)}` : 'Handle the urgent request first';

  const deferRest = (days, limit = 3) => {
    rest.slice(0, limit).forEach((task, i) => {
      adjustments.push({
        taskId: task.id,
        action: 'defer',
        dueDate: addDaysISO(days + i, now),
        reason: 'Lower consequence than the item you are protecting, so it moves rather than competes.',
      });
    });
  };

  if (!primary) {
    const title = signal === 'completed' ? "Choose tomorrow's single priority" : 'Write down the one open loop that matters';
    adjustments.push({
      taskId: null,
      action: 'add',
      title,
      description:
        signal === 'completed'
          ? 'Pick one outcome for tomorrow and block 25 minutes for it before the day starts.'
          : 'Spend five minutes writing the loops on paper, circle the one with real consequences, and start there.',
      priority: 'High',
      durationMinutes: 10,
      dueDate: todayISO(),
      doneCriteria: 'One priority is written down with a time block attached.',
      reason: 'The workspace is empty, so the first move is to create a starting point.',
    });
    return {
      headline: 'No open tasks — build one clean starting point',
      assessment:
        'There is nothing open in the workspace right now. Instead of generating a large plan, create one small, specific starting point you can finish today.',
      adjustments,
      nextAction: { title: adjustments[0].title, durationMinutes: 10, reason: 'It creates the next action in under ten minutes.' },
    };
  }

  if (signal === 'less_time') {
    const minutes = Math.max(10, Math.min(25, Math.round((primary.durationMinutes || 30) / 2)));
    adjustments.push({
      taskId: primary.id,
      action: 'reduce_scope',
      durationMinutes: minutes,
      priority: 'High',
      reason: `You have less time than planned, so “${truncate(primary.title, 50)}” gets a ${minutes}-minute slice instead of the full block.`,
    });
    deferRest(2);
  } else if (signal === 'overwhelmed') {
    adjustments.push({
      taskId: null,
      action: 'add',
      title: 'Brain-dump every open loop for five minutes',
      description: 'One page, no ordering, no editing. Then close the page and start the smallest task below.',
      priority: 'High',
      durationMinutes: 5,
      dueDate: todayISO(),
      doneCriteria: 'Every open loop is on one page and one item is circled.',
      reason: 'Externalising the list reduces the load that makes starting feel impossible.',
    });
    adjustments.push({
      taskId: primary.id,
      action: 'reduce_scope',
      durationMinutes: 10,
      priority: 'High',
      reason: 'Ten minutes is small enough to begin while overwhelmed; finishing is optional, starting is not.',
    });
    deferRest(3, 4);
  } else if (signal === 'urgent') {
    adjustments.push({
      taskId: null,
      action: 'add',
      title: urgentTitle,
      description: noteText
        ? `Your note: “${truncate(noteText, 160)}”. Handle only what the interruption actually requires, then return.`
        : 'Handle only what the interruption actually requires, then return to the protected task.',
      priority: 'High',
      durationMinutes: 30,
      dueDate: todayISO(),
      doneCriteria: 'The urgent request is answered or handed off, and the original task is scheduled again.',
      reason: 'Urgent work needs a real slot, otherwise it silently consumes the whole plan.',
    });
    if (primary.priority !== 'High') {
      adjustments.push({
        taskId: primary.id,
        action: 'defer',
        dueDate: addDaysISO(1, now),
        reason: 'It matters, but not more than the interruption you just named.',
      });
    } else {
      adjustments.push({
        taskId: primary.id,
        action: 'reduce_scope',
        durationMinutes: Math.max(10, Math.round((primary.durationMinutes || 30) * 0.6)),
        reason: 'Protect a smaller slice of the important task instead of losing it entirely.',
      });
    }
    deferRest(3, 2);
  } else if (signal === 'completed') {
    const next = open[0];
    adjustments.push({
      taskId: (done[0] || tasks[0])?.id,
      action: 'keep',
      reason: 'Completion is already recorded in the workspace — this adjustment only keeps the context accurate.',
    });
    if (next) {
      adjustments.push({
        taskId: next.id,
        action: 'reduce_scope',
        durationMinutes: Math.min(25, Math.max(10, next.durationMinutes || 25)),
        reason: `Next in line is “${truncate(next.title, 50)}”; a single short block keeps momentum without a second wind-up.`,
      });
    }
  } else {
    // couldnt_finish
    const remaining = Math.max(10, Math.round((primary.durationMinutes || 30) * 0.4));
    adjustments.push({
      taskId: primary.id,
      action: 'reduce_scope',
      durationMinutes: remaining,
      reason: `You stalled on the full scope, so “${truncate(primary.title, 50)}” becomes a ${remaining}-minute finishing slice.`,
    });
    adjustments.push({
      taskId: null,
      action: 'add',
      title: `Write down where “${truncate(primary.title, 46)}” actually stopped`,
      description: 'One sentence on the last completed step and the next physical action. This prevents re-reading everything.',
      priority: 'Medium',
      durationMinutes: 10,
      dueDate: todayISO(),
      doneCriteria: 'The stopping point and next action are written in the task notes.',
      reason: 'Re-entry cost, not motivation, is usually what blocks a second attempt.',
    });
  }

  const nextAction = {
    title:
      signal === 'urgent'
        ? urgentTitle
        : signal === 'overwhelmed'
          ? `Start a 10-minute slice of ${truncate(primary.title, 46)}`
          : `Start a ${Math.min(15, Math.max(10, Math.round((primary.durationMinutes || 20) / 2)))}-minute slice of ${truncate(primary.title, 46)}`,
    durationMinutes: signal === 'urgent' ? 30 : signal === 'overwhelmed' ? 10 : 15,
    reason:
      signal === 'less_time'
        ? 'A time-boxed slice fits the window you actually have.'
        : 'It is small enough to begin immediately and still moves the important task forward.',
  };

  const assessment = [
    `You told HumanLoop: “${SIGNALS[signal]?.label || 'something changed'}”.`,
    signal === 'completed'
      ? `That closes ${done.length + (done.some((t) => t.id === tasks[0]?.id) ? 0 : 1)} item${done.length === 1 ? '' : 's'} and frees attention for ${open.length} remaining.`
      : `The plan had ${open.length} open item${open.length === 1 ? '' : 's'}; it now assumes less capacity, not less commitment.`,
    rest.length > 0
      ? `${Math.min(rest.length, 3)} lower-consequence item${Math.min(rest.length, 3) === 1 ? '' : 's'} moved later so today stays honest.`
      : 'Nothing needs to be deferred — the remaining list already fits.',
  ].join(' ');

  return {
    headline: SIGNALS[signal]?.headline || 'Revised plan based on your check-in',
    assessment,
    adjustments,
    nextAction,
  };
}

function splitSentences(text, max = 4) {
  return String(text || '')
    .split(/[\n.;!?]+|(?:^|\s)[-•]\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 4)
    .slice(0, max);
}

export function demoReflection({ input = {}, stats = {}, tasks = [] } = {}) {
  const accomplished = splitSentences(input.accomplished, 4);
  const unfinished = splitSentences(input.unfinished, 3);
  const blockers = splitSentences(input.blockers, 2);
  const nextPriority = splitSentences(input.nextPriority, 1)[0] || '';
  const completed = Number(stats.completedToday) || 0;
  const focusMinutes = Number(stats.focusMinutesToday) || 0;
  const open = Number(stats.openTasks) || 0;

  const wins = [];
  accomplished.slice(0, 2).forEach((item) => wins.push(truncate(sentenceCase(item), 150)));
  if (completed > 0) {
    wins.push(`Closed ${completed} task${completed === 1 ? '' : 's'} in the workspace.`);
  }
  if (focusMinutes > 0) {
    wins.push(`${focusMinutes} focused minute${focusMinutes === 1 ? '' : 's'} logged, which is measured time rather than intention.`);
  }

  const headline = truncate(
    wins.length > 0 ? `Real movement: ${wins[0]}` : 'A slow day, named honestly',
    90,
  );

  const reflection = [
    accomplished.length > 0
      ? `Today contained visible movement: ${accomplished.slice(0, 2).join('; ')}.`
      : 'Today did not produce much visible output, and the honest read is that the plan assumed more capacity than was available.',
    focusMinutes > 0 || completed > 0
      ? `The recorded numbers agree: ${completed} completed task${completed === 1 ? '' : 's'}${focusMinutes > 0 ? ` and ${focusMinutes} focus minutes` : ''}.`
      : 'No focus sessions were logged, so this reflection relies only on what you wrote.',
    unfinished.length > 0
      ? `“${truncate(unfinished[0], 90)}” is still open. That is a scheduling problem before it is a discipline problem.`
      : open > 0
        ? `There are still ${open} open task${open === 1 ? '' : 's'} in the workspace; none of them need to be solved tonight.`
        : 'Nothing important is left dangling, which is the right place to stop.',
    blockers.length > 0
      ? `The friction you named — ${blockers.map((b) => truncate(b, 70)).join('; ')} — should be removed before adding new work.`
      : 'No blocker was named, so protect the same conditions tomorrow.',
    nextPriority
      ? `Tomorrow starts with “${truncate(nextPriority, 90)}” and nothing else until that has a first block on the calendar.`
      : 'Tomorrow needs one named priority, not a longer list.',
  ].join(' ');

  const nextSteps = [];
  if (nextPriority) {
    nextSteps.push({
      title: sentenceCase(truncate(nextPriority, 100)),
      why: 'You named it yourself, so it is the least negotiated place to start.',
    });
  }
  if (unfinished.length > 0 && nextSteps.length < 3) {
    nextSteps.push({
      title: `Put “${truncate(unfinished[0], 70)}” in a 25-minute block tomorrow`,
      why: 'An unfinished item with a real block stops leaking attention overnight.',
    });
  }
  if (blockers.length > 0 && nextSteps.length < 3) {
    nextSteps.push({
      title: `Remove the blocker: ${truncate(blockers[0], 80)}`,
      why: 'The obstacle will otherwise repeat at the same point tomorrow.',
    });
  }
  if (nextSteps.length === 0) {
    nextSteps.push({
      title: 'Choose one priority and block 25 minutes for it',
      why: 'A single scheduled outcome is more reliable than a longer list.',
    });
  }

  return { headline, reflection: reflection.slice(0, 900), wins: wins.slice(0, 5), nextSteps: nextSteps.slice(0, 3) };
}

export { todayISO };
