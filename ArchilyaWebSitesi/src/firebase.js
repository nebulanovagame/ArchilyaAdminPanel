import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
let analytics = null;

if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
  } catch {
    analytics = null;
  }
}

function sanitizeAnalyticsParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value]),
  );
}

export function logAnalyticsEvent(name, params = {}) {
  if (!analytics) return;

  try {
    logEvent(analytics, name, sanitizeAnalyticsParams(params));
  } catch {
    // Analytics should never block UX flows.
  }
}

export const functions = getFunctions(app, 'europe-west1');
export { analytics };

export default app;
