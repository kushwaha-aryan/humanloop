/**
 * Browser-level UI check using the Chrome DevTools Protocol.
 * No extra npm packages: requires a local Chrome/Chromium install.
 *
 * Usage: node scripts/ui-check.mjs   (server must already be running on PORT)
 */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const BASE = `http://127.0.0.1:${PORT}`;
const DEBUG_PORT = 9333;

const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chromePath = candidates.find((candidate) => fs.existsSync(candidate));
if (!chromePath) {
  console.error('Chrome was not found. Set CHROME_PATH to run this check.');
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'humanloop-chrome-'));
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,1100',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const pageErrors = [];

function pass(name, detail = '') {
  checks.push(`  ok  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitForUrl(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      /* not ready */
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class Session {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const detail = message.params.exceptionDetails;
        pageErrors.push(detail.exception?.description || detail.text || 'Unknown page exception');
      }
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        pageErrors.push(message.params.entry.text);
      }
    });
  }

  send(method, params = {}) {
    this.id += 1;
    const id = this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }

  async waitFor(expression, label, timeout = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await this.evaluate(`Boolean(${expression})`)) return;
      await sleep(120);
    }
    throw new Error(`Timed out waiting for ${label}`);
  }

  click(selector) {
    return this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Missing element: ' + ${JSON.stringify(selector)});
      el.click();
      return true;
    })()`);
  }

  clickText(tag, text) {
    return this.evaluate(`(() => {
      const wanted = ${JSON.stringify(text)};
      const el = [...document.querySelectorAll(${JSON.stringify(tag)})]
        .find((node) => node.textContent.replace(/\\s+/g, ' ').trim().includes(wanted));
      if (!el) throw new Error('Missing ${tag} containing: ' + wanted);
      el.click();
      return true;
    })()`);
  }

  fill(selector, value) {
    return this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Missing field: ' + ${JSON.stringify(selector)});
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return el.value;
    })()`);
  }

  async goto(route) {
    await this.evaluate(`window.location.hash = ${JSON.stringify(`#/${route}`)}`);
    await sleep(220);
  }
}

try {
  await waitForUrl(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(`${BASE}/#/overview`)}`, {
    method: 'PUT',
  });
  assert.equal(targetResponse.ok, true, 'Chrome refused to open a test tab');
  const target = await targetResponse.json();

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const page = new Session(socket);
  await page.send('Runtime.enable');
  await page.send('Log.enable');
  await page.send('Page.enable');

  await page.waitFor("document.querySelector('.app-shell')", 'the app shell');
  await page.waitFor("document.querySelector('.page-title')", 'the overview page');
  await page.waitFor("document.querySelector('.demo-banner')", 'the demo-mode banner');
  pass('React app renders');

  const overview = await page.evaluate(`(() => ({
    title: document.querySelector('.page-title').textContent,
    nav: [...document.querySelectorAll('.nav-item')].map((el) => el.textContent.replace(/\\s+/g, ' ').trim()),
    demo: Boolean(document.querySelector('.demo-banner')),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    cards: document.querySelectorAll('.card').length,
  }))()`);
  assert.match(overview.title, /good (morning|afternoon|evening)/i);
  assert.ok(overview.nav.length >= 6);
  assert.equal(overview.demo, true);
  assert.ok(overview.cards >= 4);
  assert.ok(overview.overflow <= 1, `overview overflows by ${overview.overflow}px`);
  pass('overview layout and demo banner', `${overview.cards} cards`);

  // Clarity: describe a situation, generate a demo plan, add a task.
  await page.clickText('.nav-item', 'AI Clarity');
  await page.waitFor("document.querySelector('#clarity-input')", 'the clarity composer');
  await page.fill(
    '#clarity-input',
    'I have a client deck due tomorrow, two unanswered emails, and I keep avoiding the tax form.',
  );
  await page.clickText('button', 'Find my next step');
  await page.waitFor("document.querySelector('.plan .plan-task')", 'a generated plan');
  const planCount = await page.evaluate("document.querySelectorAll('.plan-task').length");
  assert.ok(planCount >= 1);
  await page.clickText('.plan-task button', 'Add task');
  await page.waitFor("document.querySelector('.toast')", 'the add-task toast');
  pass('clarity plan generates and adds a task', `${planCount} planned`);

  // Tasks: add via modal, complete, and reopen.
  await page.clickText('.nav-item', 'My Tasks');
  await page.waitFor("document.querySelector('.tasks-card')", 'the task list');
  const before = await page.evaluate("document.querySelectorAll('.task-row').length");
  await page.clickText('button', 'New task');
  await page.waitFor("document.querySelector('#task-editor-form')", 'the task editor');
  await page.fill('#task-title', 'Verify the HumanLoop build');
  await page.fill('#task-description', 'Walk the main flow and confirm state persists.');
  await page.clickText('button[type="submit"]', 'Create task');
  await page.waitFor("document.querySelector('.toast')", 'the task toast');
  await page.waitFor(
    `[...document.querySelectorAll('.task-title-btn')].some((el) => el.textContent.includes('Verify the HumanLoop build'))`,
    'the new task row',
  );
  const after = await page.evaluate("document.querySelectorAll('.task-row').length");
  assert.ok(after >= before + 1, `expected a new task (${before} -> ${after})`);
  await page.evaluate(`(() => {
    const row = [...document.querySelectorAll('.task-row')].find((el) => el.textContent.includes('Verify the HumanLoop build'));
    row.querySelector('.task-check').click();
  })()`);
  // The default tab only lists open tasks, so the completed row leaves this view.
  await page.waitFor(
    `![...document.querySelectorAll('.task-row')].some((el) => el.textContent.includes('Verify the HumanLoop build'))`,
    'the task to leave the open list',
  );
  await page.clickText('.segmented button', 'Completed');
  await page.waitFor(
    `[...document.querySelectorAll('.task-row.is-done')].some((el) => el.textContent.includes('Verify the HumanLoop build'))`,
    'the completed task row',
  );
  await page.clickText('.segmented button', 'Open');
  pass('tasks can be created, completed and filtered', `${before} -> ${after} rows`);

  // Replan flow applies an adjustment.
  await page.clickText('.nav-item', 'Overview');
  await page.waitFor("document.querySelector('.today-card')", 'overview cards');
  await page.clickText('button', 'Something changed');
  await page.waitFor("document.querySelector('.signal-grid')", 'the adaptive assistant');
  await page.clickText('.signal-btn', 'less time');
  await page.fill('.modal-panel textarea', 'I only have 25 minutes before the next call.');
  await page.clickText('.modal-panel button', 'Rework my plan');
  await page.waitFor("document.querySelector('.adjust-item')", 'a revised plan');
  await page.clickText('.adjust-item button', 'Apply');
  await page.waitFor("document.querySelector('.adjust-item.is-applied')", 'an applied adjustment');
  pass('adaptive replanning applies a change');

  // Focus timer starts, runs, pauses and ends.
  await page.evaluate("document.querySelector('.modal-panel .icon-btn[aria-label=\"Close dialog\"]')?.click()");
  await page.clickText('.nav-item', 'Focus Mode');
  await page.waitFor("document.querySelector('.timer-card')", 'the focus timer');
  await page.clickText('.timer-controls button', 'Start');
  await page.waitFor("document.querySelector('.nav-live')", 'the live timer indicator');
  const clockBefore = await page.evaluate("document.querySelector('.ring-timer .ring-center strong').textContent");
  await sleep(1600);
  const clockAfter = await page.evaluate("document.querySelector('.ring-timer .ring-center strong').textContent");
  assert.notEqual(clockAfter, clockBefore, 'timer clock did not move');
  await page.clickText('.timer-controls button', 'Pause');
  await page.waitFor(
    `[...document.querySelectorAll('.timer-controls button')].some((el) => el.textContent.includes('Resume'))`,
    'the paused timer state',
  );
  await page.clickText('.timer-controls button', 'End');
  pass('focus timer counts down and pauses', `${clockBefore} -> ${clockAfter}`);

  // Reflection flow produces a saved entry.
  await page.clickText('.nav-item', 'Reflection');
  await page.waitFor("document.querySelector('#reflect-accomplished')", 'the reflection form');
  await page.fill('#reflect-accomplished', 'Walked the main flows and fixed the live AI error handling.');
  await page.fill('#reflect-unfinished', 'Write the README and deployment notes.');
  await page.fill('#reflect-blockers', 'The configured model was not enabled for this account.');
  await page.fill('#reflect-next', 'Verify the production build one more time.');
  await page.clickText('button', 'Generate my reflection');
  await page.waitFor("document.querySelector('.latest-card .reflection-result')", 'the generated reflection');
  await page.waitFor("document.querySelector('.history-item')", 'the saved reflection history');
  pass('reflection generates and saves');

  // Settings: theme switch, health facts, demo connection test.
  await page.clickText('.nav-item', 'Settings');
  await page.waitFor("document.querySelector('.theme-options')", 'the settings page');
  await page.clickText('.theme-option', 'Paper');
  await page.waitFor("document.documentElement.dataset.theme === 'light'", 'light theme');
  const themed = await page.evaluate("document.documentElement.dataset.theme");
  assert.equal(themed, 'light');
  await page.clickText('.theme-option', 'Charcoal');
  await page.waitFor("document.documentElement.dataset.theme === 'dark'", 'dark theme');
  await page.clickText('button', 'Test AI connection');
  await page.waitFor("document.querySelector('.test-ok')", 'the connection test result');
  const testText = await page.evaluate("document.querySelector('.test-ok').textContent");
  assert.match(testText, /Demo sample generated/i);
  pass('settings theme and connection test work');

  // Persistence across reload.
  await page.evaluate("window.location.reload()");
  await page.waitFor("document.querySelector('.app-shell')", 'the reloaded app');
  await page.goto('overview');
  await page.waitFor("document.querySelector('.today-card')", 'the reloaded overview');
  const persisted = await page.evaluate(`(() => {
    const raw = window.localStorage.getItem('humanloop.state.v1');
    if (!raw) return { tasks: 0, reflections: 0, taskKept: false };
    const saved = JSON.parse(raw);
    return {
      tasks: (saved.tasks || []).length,
      reflections: (saved.reflections || []).length,
      taskKept: (saved.tasks || []).some((task) => task.title === 'Verify the HumanLoop build'),
    };
  })()`);
  assert.ok(persisted.tasks > 0, 'no tasks persisted');
  assert.ok(persisted.reflections > 0, 'no reflections persisted');
  assert.equal(persisted.taskKept, true, 'the created task did not persist');
  pass('state survives a page reload', `${persisted.tasks} tasks, ${persisted.reflections} reflection`);

  // Mobile layout: drawer navigation, no horizontal overflow.
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await page.goto('overview');
  await page.waitFor("getComputedStyle(document.querySelector('.mobile-bar')).display !== 'none'", 'the mobile bar');
  const mobileOverflow = await page.evaluate("document.documentElement.scrollWidth - window.innerWidth");
  assert.ok(mobileOverflow <= 1, `mobile overview overflows by ${mobileOverflow}px`);
  await page.evaluate("document.querySelector('.mobile-bar .icon-btn').click()");
  await page.waitFor("document.querySelector('.sidebar.is-open')", 'the opened drawer');
  await page.evaluate("document.querySelector('.sidebar-close').click()");
  await page.waitFor("!document.querySelector('.sidebar.is-open')", 'the closed drawer');
  pass('mobile drawer and layout work', '390px wide');

  // Check each remaining route for runtime errors and horizontal overflow.
  for (const route of ['clarity', 'tasks', 'focus', 'reflection', 'settings']) {
    await page.goto(route);
    await page.waitFor("document.querySelector('.page-title')", `${route} page`);
    const overflow = await page.evaluate("document.documentElement.scrollWidth - window.innerWidth");
    assert.ok(overflow <= 1, `${route} overflows by ${overflow}px at 390px`);
  }
  pass('every route fits a 390px viewport');

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
  pass('no browser console or runtime errors');

  console.log('\nHumanLoop browser check (headless Chrome)\n');
  console.log(checks.join('\n'));
  console.log(`\n${checks.length} checks passed.\n`);
} catch (error) {
  console.error('\nBrowser check failed:\n');
  console.error(error);
  if (pageErrors.length) console.error(`\nPage errors:\n${pageErrors.join('\n')}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(300);
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {
    /* Windows may still hold a lock; the temp folder is disposable. */
  }
}
