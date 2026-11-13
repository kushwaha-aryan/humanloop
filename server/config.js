import 'dotenv/config';

const PLACEHOLDER_KEYS = new Set([
  '',
  'your_api_key_here',
  'your-key',
  'changeme',
  'gsk_your_key_here',
  'sk-your-key-here',
]);

function cleanKey(value) {
  const key = String(value || '').trim();
  return PLACEHOLDER_KEYS.has(key.toLowerCase()) ? '' : key;
}

function intFromEnv(name, fallback, min, max) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

const port = intFromEnv('PORT', 3000, 1, 65535);

export const config = {
  port,
  groq: {
    apiKey: cleanKey(process.env.GROQ_API_KEY),
    model: (process.env.GROQ_MODEL || 'openai/gpt-oss-120b').trim(),
    baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    timeoutMs: intFromEnv('AI_TIMEOUT_MS', 30000, 3000, 120000),
  },
};

export function isLiveMode() {
  return config.groq.apiKey.length > 0;
}

export function runtimeInfo() {
  return {
    mode: isLiveMode() ? 'live' : 'demo',
    model: config.groq.model,
    // Never expose the key — only whether one is configured.
    hasApiKey: isLiveMode(),
    version: '1.0.0',
  };
}
