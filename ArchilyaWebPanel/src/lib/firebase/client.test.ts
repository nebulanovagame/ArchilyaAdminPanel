import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initializeAppMock = vi.fn();
const getAppMock = vi.fn();
const getAppsMock = vi.fn();
const getAnalyticsMock = vi.fn();

vi.mock("firebase/app", () => ({
  getApp: getAppMock,
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
}));

vi.mock("firebase/analytics", () => ({
  getAnalytics: getAnalyticsMock,
}));

const baseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "test.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "9876543210",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:9876543210:web:testapp",
};

async function loadClientModule() {
  vi.resetModules();
  return import("@/lib/firebase/client");
}

beforeEach(() => {
  Object.entries(baseEnv).forEach(([key, value]) => {
    vi.stubEnv(key, value);
  });

  vi.stubGlobal("window", {});

  const app = { name: "test-app" };
  getAppsMock.mockReturnValue([]);
  initializeAppMock.mockReturnValue(app);
  getAppMock.mockReturnValue(app);
  getAnalyticsMock.mockReturnValue({ app, analytics: true });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("firebase client analytics config", () => {
  it("does not initialize analytics when measurement id is missing", async () => {
    const client = await loadClientModule();

    expect(client.isFirebaseAnalyticsConfigured()).toBe(false);
    expect(client.getFirebaseAnalytics()).toBeNull();
    expect(getAnalyticsMock).not.toHaveBeenCalled();
  });

  it("initializes analytics when measurement id is present", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", "G-TEST1234");
    const client = await loadClientModule();

    expect(client.isFirebaseAnalyticsConfigured()).toBe(true);
    expect(client.getFirebaseAnalytics()).toEqual({
      app: { name: "test-app" },
      analytics: true,
    });
    expect(getAnalyticsMock).toHaveBeenCalledTimes(1);
  });
});
