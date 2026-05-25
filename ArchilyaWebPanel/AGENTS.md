<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project shape

- Next.js 16.2.4 + React 19.2.4 App Router project; Tailwind is v4 via `@tailwindcss/postcss`, and Zod is v4.
- The web app lives in `src/`; legacy Firebase Functions were removed, `functions/` sub-package was also removed.
- `CLAUDE.md` only points here, and there is no repo-local OpenCode config; keep shared agent guidance in this file.
- Local subdirectory guidance exists for high-risk domains. Read the nearest `AGENTS.md` before editing files under `src/app/api/`, `src/app/(dashboard)/`, `src/app/(dashboard)/ai-studio/`, `src/hooks/`, `src/lib/`, `src/services/`, or `src/stores/`.

## Commands that match CI

- Install with `npm ci` from the repo root; `.github/workflows/ci.yml` uses Node 20 and runs only lint, unit tests, then build.
- Root verification order is `npm run lint` -> `npm run test` -> `npm run build`; CI does not run Playwright or `functions/` checks.
- Focused unit tests: `npm run test -- src/path/to/file.test.ts`.
- E2E tests: `npm run test:e2e` (Playwright auto-starts `npm run dev`, uses Chromium only, base URL `http://127.0.0.1:3000`). Focused E2E: `npx playwright test e2e/auth.spec.ts`.
- Useful non-CI commands: `npm run test:e2e:ui` for Playwright UI mode and `npm run analyze` for `ANALYZE=true npm run build`.
- The `functions/` sub-package was fully removed — no Firebase Functions, Firebase Admin SDK, or Firebase dependencies exist in the WebPanel project.

## Routing and auth gotchas

- User-facing route slugs are Turkish: `/giris`, `/kayit`, `/sifre-sifirla`, `/ai-studio`, `/abonelik`, `/ayarlar`, `/gizlilik`, `/sartlar`.
- App route groups are `src/app/(auth)` and `src/app/(dashboard)`; dashboard auth is enforced in `src/app/(dashboard)/layout.tsx` with `requireSessionUser()`.
- `src/proxy.ts` looks like middleware but there is no `src/middleware.ts` and `proxy` is not imported elsewhere. Do not assume it protects routes.
- Auth is Supabase-only: client auth via `@/lib/supabase/client`, server session via `@/lib/supabase/server`, server-only admin via `@/lib/supabase/admin`, and server callable via `@/lib/supabase/callable`.
- `src/lib/auth/session.ts` imports `server-only`; never import it from client components or hooks.
- `src/lib/supabase/admin.ts` imports `server-only`; never import it from client components or hooks.

## Data, state, and domain boundaries

- Shared library modules live in `src/lib/`; client-only service wrappers live in `src/services/`; reusable React hooks live in `src/hooks/`; context providers live in `src/stores/`.
- Sensitive operations go through Next.js API routes which verify the Supabase session and call WebBackend endpoints.
- AI Studio job documents live in the `ai_studio_jobs` Supabase table.

## i18n and API behavior

- next-intl uses `messages/tr.json` and `messages/en.json`; default locale is `tr`, selected via the `archilya-locale` cookie.
- API route handlers validate with Zod, verify the panel session, then verify the caller's Supabase access token before calling backend services.
- Rate limiting uses Upstash Redis when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` exist, otherwise an in-memory fallback.
- Error messages shown to users and many API classification keywords are Turkish. Keep i18n keys in both `messages/tr.json` and `messages/en.json` when adding UI text.
- WebPanel no longer uses Firebase. Auth = Supabase, DB = Supabase (via `supabase-js`), Backend = WebBackend API. Firebase was removed from `src/` runtime and `package.json`. The `functions/` sub-package was fully removed.

## Tests and generated/artifact directories

- ESLint uses the v9 flat config in `eslint.config.mjs`; there is no Husky, lint-staged, Prettier, or commitlint config in this repo.
- Vitest is configured with `environment: "node"` and only includes `src/**/*.{test,spec}.{ts,tsx}`; do not expect jsdom unless a test sets it up.
- Playwright reports go to `qa/playwright-report`; `qa/`, `docs/`, logs, `.next/`, and `test-results/` are local artifacts/ignored outputs.
