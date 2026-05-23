const AUTH_PAGES = new Set(["/giris", "/kayit", "/sifre-sifirla"]);

export const PANEL_LAST_PATH_COOKIE_NAME = "archilya_panel_last_path";

export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/",
) {
  const value = String(candidate || "").trim();

  if (!value) {
    return fallback;
  }

  if (!value.startsWith("/")) {
    return fallback;
  }

  if (value.startsWith("//") || /^[a-z]+:/i.test(value)) {
    return fallback;
  }

  const pathname = value.split(/[?#]/)[0] || fallback;

  if (AUTH_PAGES.has(pathname)) {
    return fallback;
  }

  return value;
}

export function buildRedirectPath(pathname: string, search = "") {
  return getSafeRedirectPath(`${pathname}${search}`, "/");
}

export function buildAuthRedirectHref(candidate: string | null | undefined) {
  const safePath = getSafeRedirectPath(candidate, "/");
  const params = new URLSearchParams({ from: safePath });
  return `/giris?${params.toString()}`;
}

export function buildAuthPageHref(
  pathname: "/giris" | "/kayit" | "/sifre-sifirla",
  candidate: string | null | undefined,
) {
  const safePath = getSafeRedirectPath(candidate, "/");

  if (safePath === "/") {
    return pathname;
  }

  const params = new URLSearchParams({ from: safePath });
  return `${pathname}?${params.toString()}`;
}
