type AnalyticsPrimitive = string | number | boolean | null | undefined;

function sanitizeAnalyticsParams(params: Record<string, AnalyticsPrimitive> = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value])
  );
}

export async function initializeAnalytics() {
  return Promise.resolve();
}

export async function trackEvent(name: string, params: Record<string, AnalyticsPrimitive> = {}) {
  void name;
  void sanitizeAnalyticsParams(params);
  return Promise.resolve();
}

export async function trackPageView(pagePath: string) {
  const normalizedPath = String(pagePath || '/').trim() || '/';
  await trackEvent('page_view', { page_path: normalizedPath });
}
