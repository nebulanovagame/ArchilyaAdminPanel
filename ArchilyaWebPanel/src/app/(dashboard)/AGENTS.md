# Dashboard route guidance

## Routing and layout

- Dashboard routes live under this route group but user-facing slugs are Turkish (`/ai-studio`, `/abonelik`, `/ayarlar`, etc.).
- `layout.tsx` enforces auth with `requireSessionUser()` and wraps the dashboard in `WorkspaceProvider`, `ThemeProvider`, and `DashboardShell`.
- Do not rely on `src/proxy.ts` for route protection; server component/API route guards are the real protection.

## Client/server boundaries

- Pages may be server components by default; add `"use client"` only when hooks, browser APIs, or client providers are required.
- Client components should use `useAuth()` and `useWorkspace()` instead of importing server-only auth helpers.
- Keep next-intl keys synchronized in both `messages/tr.json` and `messages/en.json`.

## Data access

- Workspace and billing mutations usually go through `src/services/entitlement-service.ts` or API routes, not ad-hoc database writes.
- For realtime UI, prefer shared hooks from `src/hooks/` and mapper functions from `src/lib/**`.
