class HttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'HttpsError';
    this.code = code;
    this.details = details;
  }
}

function onCall(options, handler) {
  if (typeof options === 'function') {
    handler = options;
    options = {};
  }

  async function callable(request) {
    return handler(request);
  }

  callable.__callable = true;
  callable.__options = options || {};
  return callable;
}

function toHttpStatus(code) {
  switch (code) {
    case 'invalid-argument':
      return 400;
    case 'unauthenticated':
      return 401;
    case 'permission-denied':
      return 403;
    case 'not-found':
      return 404;
    case 'already-exists':
      return 409;
    case 'failed-precondition':
      return 412;
    case 'resource-exhausted':
      return 429;
    default:
      return 500;
  }
}

module.exports = { HttpsError, onCall, toHttpStatus };
