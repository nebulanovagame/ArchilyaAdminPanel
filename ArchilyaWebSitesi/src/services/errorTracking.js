import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
let initialized = false;

export function initErrorTracking() {
  if (initialized || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.PROD ? 'production' : 'development',
  });

  initialized = true;
}

export function captureException(error, context = {}) {
  if (!error) return;

  if (Object.keys(context).length > 0) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          scope.setExtra(key, value);
        }
      });
      Sentry.captureException(error);
    });
    return;
  }

  Sentry.captureException(error);
}

export { Sentry };
