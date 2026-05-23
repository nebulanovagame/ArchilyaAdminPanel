<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project shape

- Next.js 16.2.4 + React 19.2.4 App Router project; Tailwind is v4 via `@tailwindcss/postcss`, and Zod is v4.
- The web app lives in `src/`; Firebase Cloud Functions are a separate package in `functions/` and are excluded from the root `tsconfig.json`.
- `CLAUDE.md` only points here, and there is no repo-local OpenCode config; keep shared agent guidance in this file.
- Local subdirectory guidance exists for high-risk domains. Read the nearest `AGENTS.md` before editing files under `src/app/api/`, `src/app/(dashboard)/`, `src/app/(dashboard)/archilya-render/`, `src/app/(dashboard)/ai-studio/`, `src/components/dashboard/archilya-render/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/stores/`, or `functions/`.

## Commands that match CI

- Install with `npm ci` from the repo root; `.github/workflows/ci.yml` uses Node 20 and runs only lint, unit tests, then build.
- Root verification order is `npm run lint` -> `npm run test` -> `npm run build`; CI does not run Playwright or `functions/` checks.
- Focused unit tests: `npm run test -- src/path/to/file.test.ts`.
- E2E tests: `npm run test:e2e` (Playwright auto-starts `npm run dev`, uses Chromium only, base URL `http://127.0.0.1:3000`). Focused E2E: `npx playwright test e2e/auth.spec.ts`.
- Useful non-CI commands: `npm run test:e2e:ui` for Playwright UI mode and `npm run analyze` for `ANALYZE=true npm run build`.
- Functions commands must run through the subpackage: `npm --prefix functions run build`, `npm --prefix functions run test`, `npm --prefix functions run deploy`; `functions/tsconfig.json` emits to ignored `functions/lib/`.

## Routing and auth gotchas

- User-facing route slugs are Turkish: `/giris`, `/kayit`, `/sifre-sifirla`, `/ekip`, `/ai-studio`, `/abonelik`, `/cop-kutusu`, `/ayarlar`, `/gizlilik`, `/sartlar`.
- App route groups are `src/app/(auth)` and `src/app/(dashboard)`; dashboard auth is enforced in `src/app/(dashboard)/layout.tsx` with `requireSessionUser()`.
- `src/proxy.ts` looks like middleware but there is no `src/middleware.ts` and `proxy` is not imported elsewhere. Do not assume it protects routes.
- Auth is two-layer: Firebase Auth on the client, then `/api/auth/session` creates the httpOnly `archilya_panel_session` JWT cookie used by server components/API routes.
- `src/lib/auth/session.ts` imports `server-only`; never import it from client components or hooks.

## Data, state, and domain boundaries

- Shared library modules live in `src/lib/`; client-only service wrappers live in `src/services/`; reusable React hooks live in `src/hooks/`; render wizard context providers live in `src/stores/`.
- Sensitive operations generally go through Next.js API routes or deployed Firebase HTTPS callables. Direct client Firestore services are for rule-governed project/activity/branding style data, not privileged entitlement changes.
- Archilya Render is a multi-stage route at `/archilya-render` using `?stage=intake|markup|spatial|pipeline`; its local state is React Context plus `localStorage`, not Zustand/Redux.
- AI Studio and Archilya Render share job concepts but not all storage locations: top-level `aiStudioJobs/{jobId}` and user subcollection `users/{uid}/aiStudioJobs/{jobId}` both exist. Check the nearest domain guide before changing job watchers.

## Firebase, i18n, and API behavior

- Firebase default project is `nng-toma`; client config comes from `NEXT_PUBLIC_FIREBASE_*`, and Functions default to region `europe-west1`.
- `functions/` contains the in-repo scheduled cleanup and render-pipeline callables. Other callable names used by workspace, Iyzico, credits, and AI tool flows may be deployed from a separate Firebase codebase; do not assume every callable consumer has source under `functions/src/`.
- Vercel deploys exclude `functions/`, `firebase.json`, `.firebaserc`, and `.firebase` via `.vercelignore`; Firebase deploy settings live in `firebase.json` with functions codebase `panel`.
- next-intl uses `messages/tr.json` and `messages/en.json`; default locale is `tr`, selected via the `archilya-locale` cookie.
- API route handlers generally validate with Zod, verify the panel session, then verify the caller's Firebase ID token before calling backend services.
- Rate limiting uses Upstash Redis when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` exist, otherwise an in-memory fallback.
- Error messages shown to users and many API classification keywords are Turkish. Keep i18n keys in both `messages/tr.json` and `messages/en.json` when adding UI text.

## Tests and generated/artifact directories

- ESLint uses the v9 flat config in `eslint.config.mjs`; there is no Husky, lint-staged, Prettier, or commitlint config in this repo.
- Vitest is configured with `environment: "node"` and only includes `src/**/*.{test,spec}.{ts,tsx}`; do not expect jsdom unless a test sets it up.
- Playwright reports go to `qa/playwright-report`; `qa/`, `docs/`, logs, `.next/`, `test-results/`, and `functions/lib/` are local artifacts/ignored outputs.
- Firestore rules and indexes are real sources of truth: `firestore.rules` and `firestore.indexes.json`.
- Render-domain tests are unusually important: `src/stores/*store.test.ts`, `src/app/(dashboard)/archilya-render/*.test.ts`, and `e2e/archilya-render.spec.ts` cover persistence, i18n keys, job timeouts, and stage flow.
