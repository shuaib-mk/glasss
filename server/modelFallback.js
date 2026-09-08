export const MODEL_FALLBACK_ORDER = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'groq/compound-mini'
];

const modelCooldowns = new Map();
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MODEL_UNAVAILABLE_PATTERN = /model.*(?:not found|does not exist|decommissioned|unsupported|unavailable)|(?:not found|decommissioned|unsupported|unavailable).*model/i;

export function buildModelQueue(preferredModel) {
  return [...new Set([preferredModel, ...MODEL_FALLBACK_ORDER].filter(Boolean))];
}

function getErrorStatus(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  return Number.isFinite(status) ? status : 0;
}

function getErrorMessage(error) {
  return String(error?.message ?? error?.error?.message ?? error?.response?.data?.error?.message ?? '');
}

function getHeader(error, name) {
  const headers = error?.headers ?? error?.response?.headers;
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

export function isRetryableModelError(error) {
  const status = getErrorStatus(error);
  if (RETRYABLE_STATUSES.has(status)) return true;
  return (status === 400 || status === 404) && MODEL_UNAVAILABLE_PATTERN.test(getErrorMessage(error));
}

export function getRetryDelayMs(error, now = Date.now()) {
  const retryAfter = getHeader(error, 'retry-after');
  if (retryAfter !== undefined && retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(5 * 60_000, Math.max(1_000, Math.ceil(seconds * 1_000)));
    }

    const retryDate = Date.parse(String(retryAfter));
    if (Number.isFinite(retryDate)) {
      return Math.min(5 * 60_000, Math.max(1_000, retryDate - now));
    }
  }

  const status = getErrorStatus(error);
  if (status === 400 || status === 404) return 5 * 60_000;
  return status === 429 ? 10_000 : 5_000;
}

export class AllModelsUnavailableError extends Error {
  constructor(retryAfterSeconds, cause) {
    super(`All available models are temporarily busy. Please retry in about ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`, { cause });
    this.name = 'AllModelsUnavailableError';
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function streamChatWithFallback({
  groq,
  preferredModel,
  request,
  onChunk,
  now = () => Date.now()
}) {
  const queue = buildModelQueue(preferredModel);
  let shortestWaitMs = Infinity;
  let lastError;

  for (const candidateModel of queue) {
    const currentTime = now();
    const cooldownUntil = modelCooldowns.get(candidateModel) || 0;
    if (cooldownUntil > currentTime) {
      shortestWaitMs = Math.min(shortestWaitMs, cooldownUntil - currentTime);
      continue;
    }

    let emittedContent = false;
    let completedResponse = '';

    try {
      const stream = await groq.chat.completions.create({
        ...request,
        model: candidateModel,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content || '';
        if (!content) continue;
        emittedContent = true;
        completedResponse += content;
        onChunk(content);
      }

      if (!completedResponse.trim()) {
        const emptyResponseError = new Error('The model returned an empty response.');
        emptyResponseError.status = 503;
        throw emptyResponseError;
      }

      modelCooldowns.delete(candidateModel);
      return { completedResponse, model: candidateModel };
    } catch (error) {
      // Never replay after text reached the browser; doing so could duplicate an answer.
      if (emittedContent || !isRetryableModelError(error)) throw error;

      lastError = error;
      const delayMs = getRetryDelayMs(error, currentTime);
      modelCooldowns.set(candidateModel, currentTime + delayMs);
      shortestWaitMs = Math.min(shortestWaitMs, delayMs);
    }
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((Number.isFinite(shortestWaitMs) ? shortestWaitMs : 10_000) / 1_000));
  throw new AllModelsUnavailableError(retryAfterSeconds, lastError);
}

export function clearModelCooldowns() {
  modelCooldowns.clear();
}

export function getActiveModelCooldowns(now = Date.now()) {
  return [...modelCooldowns.entries()]
    .filter(([, cooldownUntil]) => cooldownUntil > now)
    .map(([model, cooldownUntil]) => ({
      model,
      retryInSeconds: Math.max(1, Math.ceil((cooldownUntil - now) / 1_000))
    }));
}
