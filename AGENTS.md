# Archilya — Root Agent Guide

## Repo Topology
This is **not a monorepo**. There is no root `package.json`, workspace config, or shared build tool. Each directory below is an independent project with its own dependencies and dev server.

| Directory | Type | Stack | Purpose |
|---|---|---|---|
| `ArchilyaWebSitesi/` | Vite SPA | React 19, Tailwind 3, Firebase, JS/JSX | Public marketing site |
| `ArchilyaWebPanel/` | Next.js 16 | React 19, Tailwind 4, Firebase, Sentry, Playwright | Customer dashboard / AI studio |
| `ArchilyaMobil/` | Expo 55 | React Native 0.83, NativeWind, Firebase | Mobile app (iOS/Android) |
| `ArchilyaWebBackend/` | Firebase Functions | Node 20, plain JS (CommonJS) | Cloud Functions backend (11 domains) |
| `ArchilyaLauncher/` | Electron 40 | React 19, Vite 7, Tailwind 4 | Game launcher + Pixel Streaming |
| `ArchilyaAdminPanel/` | Next.js 16 | React 19, Tailwind 4, Supabase, TS/TSX | B2B admin panel (migrated from Electron) |
| `Mimerra/` | Static HTML | — | *(removed from repo — existed as AI prototype outputs)* |
| `ArchilyaSkills/` | Markdown docs | — | Build guides and sign-in fix docs |
| `docs/` | Markdown docs | — | RevenueCat / Play Console setup guides |
| `src/` | Orphaned TSX | — | Single dead file (`renderer/components/FilePreviewContent.tsx`); no `package.json` |
| `.ArchilyaCommitler/` | Reports | — | Analysis reports per project (not source) |
| `.sisyphus/` | Empty dir | — | Sisyphus workspace (empty as of audit) |

## Shared Backend & Design
- **All projects use the same Firebase project** (`nng-toma`). Firestore indexes, security rules, and Storage CORS affect every app.
- **Dark palette is hardcoded everywhere**: `background: #0f1115`, `surface: #1a1c23`, `primary: #c6a87c`, `secondary: #2a2d36`.
- **Product copy is Turkish-first**. Routes use Turkish slugs (e.g., `/giris`, `/kayit`, `/ayarlar`, `/cop-kutusu`).
- **No root-level CI or test runner**. Only `ArchilyaWebPanel` has a GitHub Actions workflow.

## Firebase Architecture (2 configs, 1 codebase)
All target project `nng-toma` (see `.firebaserc` in WebBackend).

| Config Location | Codebase | What it deploys |
|---|---|---|---|
| `ArchilyaWebBackend/firebase.json` | `backend` | Functions (`functions/`), emulators |
| `ArchilyaLauncher/firebase.json` | *(none)* | Firestore rules only |

- Note: `ArchilyaWebPanel/functions/` **no longer exists** — the Firebase Functions sub-project was removed from WebPanel. WebPanel is now Vercel-deployed with Supabase-only backend.
- `ArchilyaWebBackend/functions/` is the **large functions runtime** with 11 domain modules (`src/ai-jobs`, `src/credits`, `src/workspaces`, `src/projects`, `src/payments`, `src/notifications`, `src/ai-legacy`, `src/r2-admin`, `src/r2-user`, `src/contact`, `src/legacy`). It monkey-patches `firebase-functions/v2/https` and `v2/tasks` at startup to wrap every handler with Sentry.
- WebPanel's root `tsconfig.json` explicitly `"exclude": ["functions"]` so the former sub-project wasn't type-checked with the main app.

## CI & Automation
- **Only `ArchilyaWebPanel/.github/workflows/ci.yml` exists**. It runs on `push`/`pull_request` to `main`.
- **Steps**: checkout → setup Node 20 → `npm ci` → `npm run lint` → `npm run test` → `npm run build`.
- **CI does NOT run E2E tests** (`npm run test:e2e` is local-only).
- **No pre-commit hooks** (`husky`, `lint-staged`, `.pre-commit-config.yaml`) anywhere.
- **No monorepo task runner** (`turbo.json`, `nx.json`, `pnpm-workspace.yaml`).

## Per-Project Essentials

### ArchilyaWebPanel
- **Entry**: `src/app/layout.tsx` (root layout with i18n, Sentry, CSP).
- **Dev**: `npm run dev` → port 3000.
- **i18n**: next-intl v4, locales `tr`/`en`, default `tr`.
- **Test**:
  - Unit: `npm run test` (Vitest v4, **node** env, alias `@` → `./src`, includes `src/**/*.{test,spec}.{ts,tsx}`).
  - E2E: `npm run test:e2e` (Playwright against `http://127.0.0.1:3000`, tests in `./e2e/`, only Chromium, auto-starts dev server).
  - E2E UI: `npm run test:e2e:ui`.
- **Build**: `npm run build`.
- **Lint**: `eslint` (flat config `.mjs` for Next.js 16; ignores `qa/`, `e2e/`, `playwright.config.*`).
- **Gotcha**: Runs **Next.js 16.2.4**, which has breaking API changes vs. standard training data. Read `node_modules/next/dist/docs/` and heed deprecation notices before writing code. Also see `ArchilyaWebPanel/AGENTS.md`.
- **Gotcha**: `next.config.ts` defines **CSP headers** and **redirects** (`/ai-studyo` → `/ai-studio`, `/gizlilik-politikasi` → `/gizlilik`). Adding new external domains or image sources requires updating the CSP `connect-src`/`img-src` directives and `images.remotePatterns`.

### ArchilyaWebSitesi
- **Entry**: `src/main.jsx`.
- **Dev**: `npm run dev` → port 5174.
- **Build**: `npm run build`.
- **Lint**: `npm run lint` (flat config for JS/JSX + React Hooks/Refresh; ignores `dist/`).
- **Gotcha**: Pure JS/JSX (no TypeScript). Tailwind 3 with PostCSS + autoprefixer. Uses `react-router-dom` v7.
- **Config note**: `package.json` sets `"type": "module"`, so `postcss.config.cjs` is intentionally CommonJS (`module.exports`). `tailwind.config.js` uses ESM `export default`.
- **Gotcha**: `.gitignore` only contains `.vercel` — **it does not ignore `.env`**. Secret leak risk if `.env` is accidentally staged.

### ArchilyaMobil
- **Entry**: `app/_layout.tsx` (Expo Router root).
- **Dev**: `npm start` / `npm run android` / `npm run ios`.
- **Build**: `eas build --profile development` / `preview` / `production`.
- **Test**: `npm run test` (Jest with `jest-expo` preset, `@testing-library/jest-native` setup).
- **Gotcha**:
  - `patch-package` runs on `postinstall`.
  - Firebase logic is mostly `.js` mixed with TSX routes.
  - `tailwind.config.js` scans `app/`, `components/`, and **`src/components/`** — the Mobil `AGENTS.md` incorrectly claims otherwise; trust the actual config file.
  - `eas.json` production profile is fully defined, but Android `release` signing currently points to `signingConfigs.debug` (not production-ready), and iOS submit placeholders use Turkish filler values (`APPLE_ID_BURAYA`).
  - No CI or GitHub workflow configured yet.
- See `ArchilyaMobil/AGENTS.md` and child `app/`, `src/`, `android/` AGENTS.

### ArchilyaWebBackend
- **Entry**: `functions/index.js` (thin barrel file that re-exports 11 domain modules from `src/`).
- **Dev**: `cd functions && npm run serve` (Firebase emulator: functions on port 5001, UI on port 4000).
- **Deploy**: `cd functions && npm run deploy`.
- **Gotcha**: Secrets are injected via `defineSecret()` (Firebase Secret Manager), not `.env` in production. `firebase.json` uses codebase `backend`. Node 20 runtime.
- **Gotcha**: `functions/index.js` monkey-patches `firebase-functions/v2/https` and `v2/tasks` at module load time to auto-wrap every handler with Sentry. If you add new handler types, verify they are also wrapped.
- See `ArchilyaWebBackend/functions/AGENTS.md`.

### ArchilyaLauncher
- **Renderer entry**: `src/renderer/main.tsx`.
- **Main entry**: `electron/main.ts`.
- **Dev**: `npm run electron:dev` (builds main process via `tsc -p tsconfig.electron.json`, type-checks renderer via `tsc`, then launches Vite + Electron concurrently).
- **Build**: `npm run electron:build` (fetches `cloudflared.exe`, copies Epic `SignallingWebServer` from local UE install, compiles main, builds renderer, and packages with `electron-builder`).
- **Test**: `npm run test` (Vitest, **jsdom** env, globals enabled, setup file `./src/renderer/test/setup.ts`).
- **Lint**: `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` (flat config, ignores `dist/`).
- **Gotchas**:
  - `electron:build` will fail if `fetch:tunnel-tools` / `fetch:signalling` have not run or prerequisites are missing.
    - `fetch:tunnel-tools` downloads `cloudflared.exe`. Can use `CLOUDFLARED_DOWNLOAD_URL` env var.
    - `fetch:signalling` **copies from a local UE 5.x installation** (`Engine/Plugins/Media/PixelStreaming/Resources/WebServers/SignallingWebServer`), not a remote download. Requires `EPIC_GAMES_ROOT` or `UE_VERSION_PREFERRED` env vars if UE is not in default install paths.
  - `tsconfig.electron.json` builds main process to `dist-electron/` and **excludes** `src/main/main.ts`. The active main entry is `electron/main.ts`. It uses `module: NodeNext`.
  - NSIS installer config is inline in `package.json` with custom branding assets.
  - Auto-update publisher is configured (`publish.provider: github` in `package.json` build block).
- **Gotcha**: `.gitignore` does **not** include `.env` (only `*.local`). The file at `ArchilyaLauncher/.env` contains a live Google OAuth client secret and Firebase API key — it **will be committed** on `git add .`.

### ArchilyaAdminPanel
- **Entry**: `src/app/layout.tsx` (root layout with Montserrat/Cormorant fonts, globals.css).
- **Dev**: `npm run dev` → port 3000. Also `dev:turbo`, `dev:webpack`.
- **Build**: `npm run build`.
- **Lint**: `eslint` (flat config `.mjs` for Next.js 16).
- **Gotchas**:
  - **Migrated from Electron to Next.js 16** — older root `AGENTS.md` entries describing it as "Electron 28 / Vite 5" are stale. Current stack: Next.js 16.2.6, React 19.2.4, Tailwind v4, Supabase.
  - Same core stack as `ArchilyaWebPanel` but stripped down (no Sentry, no i18n, no CSP).
  - No test framework configured at all.
  - `eslint.config.mjs` exists and works (contrary to older root AGENTS.md claims).
  - `.gitignore` exists and properly excludes `.env`, `.env*.local`, `node_modules`, `.next/` (contrary to older claims).

## Cross-Cutting Gotchas
- **Tailwind version split**: WebPanel, Launcher, and AdminPanel use Tailwind v4 (`@tailwindcss/postcss`). WebSitesi and Mobil use Tailwind v3. Do not copy PostCSS configs between them.
- **No shared lint/prettier config** at root. Each project has its own ESLint flat config.
- **`src/` at repo root is orphaned** — it contains a single file (`renderer/components/FilePreviewContent.tsx`) and has no `package.json`. An identical, also-unreferenced copy exists at `ArchilyaLauncher/src/renderer/components/FilePreviewContent.tsx`. Both are dead code.
- **`Mimerra/` has been removed from the repo** (it previously contained 32 static HTML snapshots and exposed Firebase secrets/tracking tokens). No longer present on disk.
- **`.env` files exist in 4 projects** (WebPanel, Launcher, WebBackend/functions, Mobil).
  - **WebPanel, Mobil, WebBackend/functions** correctly gitignore `.env` files.
  - **🔴 CRITICAL — `ArchilyaLauncher/.env` is NOT gitignored** and contains a real Google OAuth client secret + Firebase API key. The `.gitignore` only has `*.local` (covers `.env.local`, not `.env`). This file will be committed on `git add .`.
  - **⚠️ `ArchilyaWebSitesi/.gitignore` only ignores `.vercel`** — does not ignore `.env`. No `.env` file exists there yet, but any future file would be at risk.
  - **⚠️ `ArchilyaAdminPanel/` has a `.gitignore`** (covers `.env`, `.env*.local`, `node_modules`, `.next/`) — earlier "no .gitignore" claim was stale.
  - **Root has a `.gitignore`** (covers node_modules, dist, build, .env) — earlier "no .gitignore" claim was stale.
- **No Docker** for the main apps. Only `ArchilyaLauncher/SignallingWebServer/` has a Dockerfile (Epic Pixel Streaming).
- **No repo-wide config files** (`.cursorrules`, `opencode.json`, `.github/copilot-instructions.md`). Only `ArchilyaWebPanel/CLAUDE.md` exists and it just references `@AGENTS.md`.

## Child Instruction Files
- `ArchilyaWebPanel/AGENTS.md` — Next.js 16 warnings
- `ArchilyaWebSitesi/AGENTS.md` — Vite SPA (JS/JSX, Tailwind v3)
- `ArchilyaMobil/AGENTS.md` — Full mobile KB
- `ArchilyaMobil/app/AGENTS.md` — Expo Router routes
- `ArchilyaMobil/src/AGENTS.md` — Hooks / services
- `ArchilyaMobil/android/AGENTS.md` — Native Android
- `ArchilyaLauncher/AGENTS.md` — Electron 40 launcher
- `ArchilyaWebBackend/AGENTS.md` — Firebase Functions overview
- `ArchilyaWebBackend/functions/AGENTS.md` — Cloud Functions runtime
- `ArchilyaAdminPanel/AGENTS.md` — Next.js 16 admin panel
