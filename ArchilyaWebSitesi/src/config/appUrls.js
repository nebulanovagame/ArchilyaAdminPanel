const DEFAULT_PANEL_APP_URL = 'https://panel.archilya.com';

function normalizeBaseUrl(value, fallback) {
  const rawValue = String(value || fallback || '').trim();
  const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;

  try {
    const normalized = new URL(withProtocol);
    return normalized.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export const panelAppUrl = normalizeBaseUrl(
  import.meta.env.VITE_PANEL_APP_URL,
  DEFAULT_PANEL_APP_URL,
);

export function buildPanelUrl(path = '/') {
  const normalizedPath = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`;
  return new URL(normalizedPath, `${panelAppUrl}/`).toString();
}
