import { config } from '../config.js';
import { AiError } from './errors.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Groq speaks the OpenAI chat-completions protocol, so the payload is the
 * familiar `messages` / `response_format` shape.
 */
function buildPayload({ system, user, temperature, maxTokens }) {
  return {
    model: config.groq.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };
}

function mapHttpError(status, retryAfterHeader, detail) {
  if (status === 401 || status === 403) {
    return new AiError(
      'invalid_api_key',
      'Groq rejected the API key. Check GROQ_API_KEY in your .env file and restart the server.',
      { status: 502 },
    );
  }
  if (status === 429) {
    const retryAfter = Number(retryAfterHeader) || 20;
    return new AiError(
      'rate_limited',
      `The Groq rate limit was reached. Try again in about ${retryAfter} seconds, or use a shorter prompt.`,
      { status: 429, retryAfter },
    );
  }
  if (status === 404) {
    return new AiError(
      'unknown_model',
      `The model "${config.groq.model}" is not available on this Groq account. Set GROQ_MODEL in .env to a model you can access.`,
      { status: 502 },
    );
  }
  if (status === 413) {
    return new AiError('prompt_too_large', 'That request was too large for the model. Try a shorter description.', {
      status: 413,
    });
  }
  if (status >= 500) {
    return new AiError(
      'upstream_unavailable',
      'Groq is temporarily unavailable. Your data is safe — try again in a moment.',
      { status: 502 },
    );
  }
  return new AiError('upstream_error', `The AI request failed (HTTP ${status}). ${detail || ''}`.trim(), {
    status: 502,
  });
}

/** Models occasionally wrap JSON in prose or fences. Recover the first JSON object. */
export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new AiError('invalid_response', 'The AI returned an empty response. Please try again.', { status: 502 });
  }
  const cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new AiError('invalid_response', 'The AI response was not valid JSON. Please try again.', {
        status: 502,
      });
    }
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new AiError('invalid_response', 'The AI response could not be parsed. Please try again.', {
        status: 502,
      });
    }
  }
}

async function requestOnce(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.groq.timeoutMs);
  let response;
  try {
    response = await fetch(`${config.groq.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new AiError('timeout', 'The AI took too long to respond. Please try again.', { status: 504 });
    }
    throw new AiError('network_error', 'Could not reach Groq. Check the server’s internet connection.', {
      status: 502,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message || '';
    } catch {
      /* non-JSON error body — ignore */
    }
    throw mapHttpError(response.status, response.headers.get('retry-after'), detail);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new AiError('invalid_response', 'Groq returned a malformed response. Please try again.', { status: 502 });
  }

  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AiError('invalid_response', 'The AI returned an unexpected shape. Please try again.', { status: 502 });
  }
  return parsed;
}

/**
 * Ask Groq for a JSON object, retrying once for transient failures.
 * Invalid-key, unknown-model and validation errors are never retried.
 */
export async function completeJSON({ system, user, temperature = 0.35, maxTokens = 1600 }) {
  if (!config.groq.apiKey) {
    throw new AiError('demo_mode', 'No GROQ_API_KEY is configured, so live AI is unavailable.', { status: 503 });
  }

  const payload = buildPayload({ system, user, temperature, maxTokens });
  const transientCodes = new Set(['rate_limited', 'upstream_unavailable', 'network_error', 'timeout']);

  try {
    return await requestOnce(payload);
  } catch (error) {
    if (error instanceof AiError && transientCodes.has(error.code)) {
      await sleep(error.code === 'rate_limited' ? 1200 : 500);
      return requestOnce(payload);
    }
    throw error;
  }
}
