import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh the auth token if needed.
  // Use getSession first (reads from cookie, no network round-trip),
  // then validate with getUser only for protected/auth routes.
  const { data: { session } } = await supabase.auth.getSession();
  let user = null;

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/giris") ||
    pathname.startsWith("/kayit") ||
    pathname.startsWith("/sifre-sifirla");

  const isDashboardRoute =
    pathname === "/" ||
    pathname.startsWith("/ai-studio") ||
    pathname.startsWith("/abonelik") ||
    pathname.startsWith("/ayarlar");

  if (isDashboardRoute || isAuthRoute) {
    if (session) {
      const { data: { user: validatedUser } } = await supabase.auth.getUser();
      user = validatedUser;
    }
  }

  if (isDashboardRoute && !user) {
    const loginUrl = new URL("/giris", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && user) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
