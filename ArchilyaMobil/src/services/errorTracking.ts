import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let initialized = false;
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

type PrimitiveContext = string | number | boolean | null | undefined;

type CaptureContext = {
  tags?: Record<string, PrimitiveContext>;
  extras?: Record<string, PrimitiveContext>;
  contexts?: Record<string, Record<string, PrimitiveContext>>;
};

function setScopedValues(
  scope: {
    setTag: (key: string, value: PrimitiveContext) => void;
    setExtra: (key: string, value: PrimitiveContext) => void;
    setContext: (key: string, value: Record<string, PrimitiveContext> | null) => void;
  },
  context: CaptureContext = {}
) {
  Object.entries(context.tags || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      scope.setTag(key, String(value));
    }
  });

  Object.entries(context.extras || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      scope.setExtra(key, value);
    }
  });

  Object.entries(context.contexts || {}).forEach(([key, value]) => {
    if (value && Object.keys(value).length > 0) {
      scope.setContext(key, value);
    }
  });
}

export function initErrorTracking() {
  if (initialized || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    enabled: true,
    integrations: [
      Sentry.reactNativeTracingIntegration(),
      navigationIntegration,
    ],
  });

  initialized = true;
}

export function registerNavigationContainer(navigationRef: Parameters<typeof navigationIntegration.registerNavigationContainer>[0]) {
  navigationIntegration.registerNavigationContainer(navigationRef);
}

export function setUserContext(user: {
  id?: string | null;
  email?: string | null;
  username?: string | null;
  name?: string | null;
} | null) {
  if (!user?.id && !user?.email) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id || undefined,
    email: user.email || undefined,
    username: user.username || user.name || undefined,
  });
}

export function clearUserContext() {
  Sentry.setUser(null);
}

export function setRouteContext(route: {
  path?: string;
  segments?: string[];
  params?: Record<string, PrimitiveContext>;
}) {
  Sentry.setContext('route', {
    path: String(route.path || ''),
    segments: Array.isArray(route.segments) ? route.segments.join('/') : '',
    ...(route.params || {}),
  });
}

export function captureException(error: unknown, context: CaptureContext & Record<string, PrimitiveContext> = {}) {
  if (!error) return;

  const { tags = {}, extras = {}, contexts = {}, ...legacyExtras } = context || {};
  const mergedExtras = {
    ...legacyExtras,
    ...extras,
  };

  if (Object.keys(tags).length > 0 || Object.keys(mergedExtras).length > 0 || Object.keys(contexts).length > 0) {
    Sentry.withScope((scope) => {
      setScopedValues(scope, {
        tags,
        extras: mergedExtras,
        contexts,
      });
      Sentry.captureException(error);
    });
    return;
  }

  Sentry.captureException(error);
}

export function captureScopedMessage(message: string, context: CaptureContext = {}) {
  if (!message) return;

  if (Object.keys(context.tags || {}).length > 0 || Object.keys(context.extras || {}).length > 0 || Object.keys(context.contexts || {}).length > 0) {
    Sentry.withScope((scope) => {
      setScopedValues(scope, context);
      Sentry.captureMessage(message);
    });
    return;
  }

  Sentry.captureMessage(message);
}

export { Sentry };
