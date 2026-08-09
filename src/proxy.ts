import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(nonce: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const adminApiOrigin = getOrigin(process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL);
  const appOrigin = getOrigin(process.env.NEXT_PUBLIC_ADMIN_APP_URL);

  const connectSources = [
    "'self'",
    supabaseOrigin,
    supabaseOrigin?.replace(/^https:/, "wss:"),
    adminApiOrigin,
    appOrigin,
    "https://*.ingest.de.sentry.io",
    "https://*.sentry.io",
    ...(isProduction
      ? []
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "ws://localhost:3000",
          "ws://127.0.0.1:3000",
          "http://localhost:4000",
          "http://127.0.0.1:4000",
        ]),
  ].filter(Boolean);

  const imgSources = ["'self'", "data:", "blob:", supabaseOrigin].filter(Boolean);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;

  // Generate fresh nonce per request for CSP.
  // Next.js parses the nonce from the CSP header and auto-applies it
  // to its own inline scripts (__next_f RSC payload, framework scripts).
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce);

  requestHeaders.set("x-nonce", nonce);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const applySecurityHeaders = (response: NextResponse): NextResponse => {
    response.headers.set("x-nonce", nonce);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  // Refresh Supabase auth session via cookie round-trip
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh auth session — writes updated cookies via setAll callback above
  await supabase.auth.getSession();

  // Route protection
  const isAdminRoute = pathname.startsWith("/admin");
  const isApiAdminRoute = pathname.startsWith("/api/admin");
  const isAuthRoute = pathname.startsWith("/giris");

  // Protect admin routes — redirect unauthenticated users to login
  if (isAdminRoute || isApiAdminRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (isApiAdminRoute) {
        return applySecurityHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/giris";
      url.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
      return applySecurityHeaders(NextResponse.redirect(url));
    }
  }

  // Redirect authenticated users from login page to admin dashboard
  if (isAuthRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const url = request.nextUrl.clone();
      // NOTE: (admin) is a route group — it does NOT appear in URLs.
      // The real dashboard route is /dashboard; /admin/dashboard 404s.
      url.pathname = "/dashboard";
      return applySecurityHeaders(NextResponse.redirect(url));
    }
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
