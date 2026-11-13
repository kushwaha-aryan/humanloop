import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { config, isLiveMode, runtimeInfo } from './config.js';
import { AiError, toPublicError } from './ai/errors.js';
import { completeJSON } from './ai/groq.js';
import {
  adaptationSystemPrompt,
  adaptationUserPrompt,
  claritySystemPrompt,
  clarityUserPrompt,
  reflectionSystemPrompt,
  reflectionUserPrompt,
  repairPrompt,
} from './ai/prompts.js';
import { validateAdaptation, validateClarityPlan, validateReflection } from './ai/validate.js';
import { readString, sanitizeHistory, sanitizeStats, sanitizeTasks, SIGNALS } from './ai/input.js';
import { demoAdaptation, demoClarityPlan, demoReflection, signalLabel } from './demo.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

/* -------------------------------------------------------------------------- */
/* Small in-memory rate limiter (per IP, per process)                          */
/* -------------------------------------------------------------------------- */

const RATE_LIMIT = { windowMs: 60_000, max: 30 };
const rateBuckets = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT.max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: `Too many AI requests from this browser. Wait ${retryAfter}s and try again.`,
        retryAfterSeconds: retryAfter,
      },
    });
  }
  return next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}, 60_000).unref();

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch((error) => {
    if (res.headersSent) return next(error);
    // AiError instances carry a safe status + message; everything else is a
    // generic 500. This keeps upstream details out of the browser.
    return sendApiError(res, error, req.path);
  });
};

function sendApiError(res, error, context) {
  const { status, body } = toPublicError(error);
  const detail = error instanceof AiError ? error.code : 'unexpected_error';
  // Server-side logging only; never logs headers, keys, or bodies.
  console.error(`[api:${context}] ${detail}: ${error?.message || error}`);
  res.status(status).json(body);
}

/** Ask the model once; if validation fails, ask once more with the errors. */
async function generateValidated({ system, user, validate, maxTokens = 1600, temperature = 0.35 }) {
  const raw = await completeJSON({ system, user, temperature, maxTokens });
  let checked = validate(raw);
  if (checked.ok) return checked.data;

  const repaired = await completeJSON({
    system,
    user: `${user}\n\n${repairPrompt(checked.errors)}`,
    temperature: 0.1,
    maxTokens,
  });
  checked = validate(repaired);
  if (checked.ok) return checked.data;

  throw new AiError(
    'invalid_response',
    'The AI returned a plan that could not be validated. Try rephrasing your input — being slightly more specific usually fixes it.',
    { status: 502 },
  );
}

const aiMeta = () => ({ ...runtimeInfo(), generatedAt: new Date().toISOString() });

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    ...runtimeInfo(),
    uptimeSeconds: Math.round(process.uptime()),
    demoMode: !isLiveMode(),
  });
});

app.post(
  '/api/ai/clarity',
  rateLimit,
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const situation = readString(body.situation, {
      field: 'Your description',
      min: 8,
      max: 4000,
      required: true,
    });
    if (!situation.ok) {
      return res.status(400).json({ error: { code: 'invalid_request', message: situation.message } });
    }

    const tasks = sanitizeTasks(body.tasks);
    const history = sanitizeHistory(body.history);
    const started = Date.now();

    if (!isLiveMode()) {
      const plan = demoClarityPlan({ situation: situation.value });
      const checked = validateClarityPlan(plan);
      if (!checked.ok) {
        throw new AiError('demo_error', 'The demo plan generator produced invalid output.', { status: 500 });
      }
      return res.json({
        mode: 'demo',
        ...aiMeta(),
        latencyMs: Date.now() - started,
        notice: 'Demo sample generated locally from your words. Add GROQ_API_KEY to use live AI.',
        result: checked.data,
      });
    }

    const system = claritySystemPrompt();
    const user = clarityUserPrompt({ situation: situation.value, tasks, history });
    const result = await generateValidated({
      system,
      user,
      validate: (raw) => validateClarityPlan(raw),
      maxTokens: 1700,
      temperature: 0.35,
    });

    res.json({
      mode: 'live',
      ...aiMeta(),
      latencyMs: Date.now() - started,
      result,
    });
  }),
);

app.post(
  '/api/ai/adapt',
  rateLimit,
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const tasks = sanitizeTasks(body.tasks);
    const signal = SIGNALS.includes(body.signal) ? body.signal : 'overwhelmed';
    const note = readString(body.note, { field: 'Your note', min: 0, max: 1200 });
    if (!note.ok) {
      return res.status(400).json({ error: { code: 'invalid_request', message: note.message } });
    }

    const label = signalLabel(signal);
    const started = Date.now();

    if (!isLiveMode()) {
      const plan = demoAdaptation({ signal, note: note.value, tasks });
      const checked = validateAdaptation(plan, new Date(), tasks);
      if (!checked.ok) {
        throw new AiError('demo_error', 'The demo adaptation generator produced invalid output.', { status: 500 });
      }
      return res.json({
        mode: 'demo',
        ...aiMeta(),
        latencyMs: Date.now() - started,
        notice: 'Demo sample generated locally from your check-in. Add GROQ_API_KEY to use live AI.',
        result: checked.data,
      });
    }

    const system = adaptationSystemPrompt();
    const user = adaptationUserPrompt({ signalLabel: label, note: note.value, tasks });
    const result = await generateValidated({
      system,
      user,
      validate: (raw) => validateAdaptation(raw, new Date(), tasks),
      maxTokens: 1500,
      temperature: 0.3,
    });

    res.json({ mode: 'live', ...aiMeta(), latencyMs: Date.now() - started, result });
  }),
);

app.post(
  '/api/ai/reflect',
  rateLimit,
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const input = body.input && typeof body.input === 'object' ? body.input : {};
    const stats = sanitizeStats(body.stats);
    const tasks = sanitizeTasks(body.tasks);

    const accomplished = readString(input.accomplished, {
      field: 'What you accomplished',
      min: 2,
      max: 1500,
      required: true,
    });
    if (!accomplished.ok) {
      return res.status(400).json({ error: { code: 'invalid_request', message: accomplished.message } });
    }
    const unfinished = readString(input.unfinished, { field: 'What remains unfinished', max: 1500 });
    const blockers = readString(input.blockers, { field: 'What blocked you', max: 1500 });
    const nextPriority = readString(input.nextPriority, { field: 'What to prioritize next', max: 1500 });
    const invalid = [unfinished, blockers, nextPriority].find((field) => !field.ok);
    if (invalid) {
      return res.status(400).json({ error: { code: 'invalid_request', message: invalid.message } });
    }

    const cleanInput = {
      accomplished: accomplished.value,
      unfinished: unfinished.value,
      blockers: blockers.value,
      nextPriority: nextPriority.value,
    };
    const started = Date.now();

    if (!isLiveMode()) {
      const plan = demoReflection({ input: cleanInput, stats, tasks });
      const checked = validateReflection(plan);
      if (!checked.ok) {
        throw new AiError('demo_error', 'The demo reflection generator produced invalid output.', { status: 500 });
      }
      return res.json({
        mode: 'demo',
        ...aiMeta(),
        latencyMs: Date.now() - started,
        notice: 'Demo sample generated locally from your reflection. Add GROQ_API_KEY to use live AI.',
        result: checked.data,
      });
    }

    const system = reflectionSystemPrompt();
    const user = reflectionUserPrompt({ input: cleanInput, stats, tasks });
    const result = await generateValidated({
      system,
      user,
      validate: validateReflection,
      maxTokens: 1200,
      temperature: 0.4,
    });

    res.json({ mode: 'live', ...aiMeta(), latencyMs: Date.now() - started, result });
  }),
);

app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: `No API route for ${req.method} ${req.originalUrl}.` } });
});

/* -------------------------------------------------------------------------- */
/* Frontend                                                                   */
/* -------------------------------------------------------------------------- */

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));
}

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>HumanLoop API</title>
<style>body{font-family:ui-sans-serif,system-ui;background:#0A0B09;color:#EDEFE8;padding:48px;line-height:1.6}code{color:#C8F751}</style>
</head><body>
<h1>HumanLoop API is running</h1>
<p>The frontend build was not found. Run <code>npm run build</code> and restart, or use <code>npm run dev</code> for development.</p>
<p>API status: <code>GET /api/health</code></p>
</body></html>`);
  });
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'payload_too_large', message: 'That request body is too large.' } });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'The request body must be valid JSON.' } });
  }
  console.error('[server:error]', err?.message || err);
  return res.status(500).json({ error: { code: 'server_error', message: 'Unexpected server error.' } });
});

// Bind all interfaces so the app is reachable behind Render's (or any) proxy.
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(config.port, HOST, () => {
  const mode = isLiveMode() ? `live AI (${config.groq.model})` : 'DEMO MODE (no GROQ_API_KEY)';
  console.log(`\n  HumanLoop server  ·  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${config.port}`);
  console.log(`  Mode: ${mode}`);
  if (!isLiveMode()) console.log('  Add GROQ_API_KEY to .env to enable live AI.\n');
});

function shutdown(signal) {
  console.log(`\n${signal} received — shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 4000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app };
