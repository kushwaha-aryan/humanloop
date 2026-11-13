/**
 * Thin client for the HumanLoop backend. The browser never talks to Groq
 * directly and never sees an API key.
 */

export class ApiError extends Error {
  constructor(message, { code = 'request_failed', status = 0, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const TIMEOUT_MS = 45_000;

async function request(path, { method = 'GET', body, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort);

  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('The request took too long. Check that the server is running and try again.', {
        code: 'timeout',
      });
    }
    throw new ApiError('Could not reach the HumanLoop server. Run `npm run dev` or `npm start` and try again.', {
      code: 'network_error',
    });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const err = data?.error || {};
    throw new ApiError(err.message || `The request failed (HTTP ${response.status}).`, {
      code: err.code || 'request_failed',
      status: response.status,
      retryAfterSeconds: err.retryAfterSeconds ?? null,
    });
  }

  return data;
}

export function getHealth(options) {
  return request('/api/health', options);
}

export function requestClarity({ situation, tasks, history }, options = {}) {
  return request('/api/ai/clarity', {
    method: 'POST',
    body: { situation, tasks, history },
    signal: options.signal,
  });
}

export function requestAdaptation({ signal, note, tasks }, options = {}) {
  return request('/api/ai/adapt', {
    method: 'POST',
    body: { signal, note, tasks },
    signal: options.signal,
  });
}

export function requestReflection({ input, stats, tasks }, options = {}) {
  return request('/api/ai/reflect', {
    method: 'POST',
    body: { input, stats, tasks },
    signal: options.signal,
  });
}

export const SIGNAL_OPTIONS = [
  { id: 'couldnt_finish', label: "I couldn't finish this task", hint: 'Reshape it into a smaller, finishable slice.' },
  { id: 'less_time', label: 'I have less time than expected', hint: 'Fit the plan into the window that is left.' },
  { id: 'urgent', label: 'Something urgent came up', hint: 'Make room without losing the important work.' },
  { id: 'completed', label: 'I completed this task', hint: 'Bank the progress and pick the next real task.' },
  { id: 'overwhelmed', label: 'I am feeling overwhelmed', hint: 'Cut the plan down to one starting point.' },
];
