import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  buildRedirectPath,
  PANEL_LAST_PATH_COOKIE_NAME,
} from "@/lib/auth/redirect";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { protectedPanelPrefixes } from "@/lib/panel/panel-routes";

function isProtectedPanelPath(pathname: string) {
  return protectedPanelPrefixes.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const redirectPath = buildRedirectPath(pathname, search);
  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (isProtectedPanelPath(pathname) && !hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/giris";
    loginUrl.search = new URLSearchParams({
      from: redirectPath,
    }).toString();

    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedPanelPath(pathname)) {
    const response = NextResponse.next();
    response.cookies.set(PANEL_LAST_PATH_COOKIE_NAME, redirectPath, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 6,
    });

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/ekip/:path*",
    "/ai-studio/:path*",
    "/abonelik/:path*",
    "/cop-kutusu/:path*",
    "/ayarlar/:path*",
  ],
};
