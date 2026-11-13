/**
 * Errors that are safe to surface to the client.
 * Anything not wrapped in AiError is treated as an unexpected server error.
 */
export class AiError extends Error {
  constructor(code, message, { status = 502, retryAfter = null, cause = null } = {}) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    this.cause = cause;
  }
}

export function toPublicError(error) {
  if (error instanceof AiError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.retryAfter ? { retryAfterSeconds: error.retryAfter } : {}),
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: 'server_error',
        message: 'Something went wrong on the server. Please try again.',
      },
    },
  };
}
