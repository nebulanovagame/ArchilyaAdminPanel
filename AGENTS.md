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
| `ArchilyaAdminPanel/` | Electron 28 | React 18, Vite 5, Tailwind 3 | B2B admin panel (legacy stack) |
| `Mimerra/` | Static HTML | — | AI prototype outputs, not source code |
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

## Firebase Architecture (3 configs, 2 codebases)
All target project `nng-toma` (see `.firebaserc` in WebPanel and WebBackend).

| Config Location | Codebase | What it deploys |
|---|---|---|
| `ArchilyaWebPanel/firebase.json` | `panel` | Hosting (root `.`), Functions (`functions/`), Firestore rules/indexes, emulators |
| `ArchilyaWebBackend/firebase.json` | `backend` | Functions (`functions/`), emulators |
| `ArchilyaLauncher/firebase.json` | *(none)* | Firestore rules only |

- `ArchilyaWebPanel/functions/` is a **small standalone TypeScript sub-project** (compiles `src/` → `lib/`, single scheduled cleanup function). It has its own `package.json` and `tsconfig.json`.
- `ArchilyaWebBackend/functions/` is the **large functions runtime** with 11 domain modules (`src/ai-jobs`, `src/credits`, `src/workspaces`, `src/projects`, `src/payments`, `src/notifications`, `src/ai-legacy`, `src/r2-admin`, `src/r2-user`, `src/contact`, `src/legacy`). It monkey-patches `firebase-functions/v2/https` and `v2/tasks` at startup to wrap every handler with Sentry.
- WebPanel's root `tsconfig.json` explicitly `"exclude": ["functions"]` so the sub-project is type-checked separately.

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
- **Functions sub-project**: `cd functions && npm run build` compiles TS to `lib/`. `npm run test` runs Vitest inside `functions/`.
- **Gotcha**: Runs **Next.js 16.2.4**, which has breaking API changes vs. standard training data. Read `node_modules/next/dist/docs/` and heed deprecation notices before writing code. Also see `ArchilyaWebPanel/AGENTS.md`.
- **Gotcha**: `next.config.ts` defines **CSP headers** and **redirects** (`/ai-studyo` → `/ai-studio`, `/gizlilik-politikasi` → `/gizlilik`). Adding new external domains or image sources requires updating the CSP `connect-src`/`img-src` directives and `images.remotePatterns`.

### ArchilyaWebSitesi
- **Entry**: `src/main.jsx`.
- **Dev**: `npm run dev` → port 5174.
- **Build**: `npm run build`.
- **Lint**: `npm run lint` (flat config for JS/JSX + React Hooks/Refresh; ignores `dist/`).
- **Gotcha**: Pure JS/JSX (no TypeScript). Tailwind 3 with PostCSS + autoprefixer. Uses `react-router-dom` v7. No project-level AGENTS.md exists.
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
- **Entry**: `src/renderer/main.tsx` / `electron/main.ts`.
- **Dev**: `npm run dev` (3 concurrent processes: Vite HMR + `tsc -w` for electron main + `wait-on` then Electron launch).
- **Build**: `npm run dist` (runs `tsc` renderer type-check → `vite build` → `tsc -p electron/tsconfig.json` main compile → `electron-builder`).
- **Lint**: `npm run lint` runs `eslint .`, but **no ESLint config file exists** at the project root. It may fail or fall back to defaults.
- **Gotchas**:
  - Older stack than Launcher (React 18, Electron 28, Firebase 10).
  - No test framework configured at all.
  - No auto-update publisher configured.
  - **No `.gitignore` exists at all** — any file added here is at risk of accidental staging.
  - Electron main process uses CommonJS (`module: commonjs` in `electron/tsconfig.json`), unlike Launcher's NodeNext.

## Cross-Cutting Gotchas
- **Tailwind version split**: WebPanel and Launcher use Tailwind v4 (`@tailwindcss/postcss`). WebSitesi, Mobil, and AdminPanel use Tailwind v3. Do not copy PostCSS configs between them.
- **No shared lint/prettier config** at root. Each project has its own ESLint flat config.
- **`src/` at repo root is orphaned** — it contains a single file (`renderer/components/FilePreviewContent.tsx`) and has no `package.json`. An identical, also-unreferenced copy exists at `ArchilyaLauncher/src/renderer/components/FilePreviewContent.tsx`. Both are dead code.
- **`Mimerra/` is not source code** — it contains static HTML prototype reports and their assets (e.g., `İç Mekan Render Üret Mimerra.html`). Do not attempt to build or lint it.
- **`.env` files exist in 4 projects** (WebPanel, Launcher, WebBackend/functions, Mobil).
  - **WebPanel, Mobil, WebBackend/functions** correctly gitignore `.env` files.
  - **🔴 CRITICAL — `ArchilyaLauncher/.env` is NOT gitignored** and contains a real Google OAuth client secret + Firebase API key. The `.gitignore` only has `*.local` (covers `.env.local`, not `.env`). This file will be committed on `git add .`.
  - **⚠️ `ArchilyaWebSitesi/.gitignore` only ignores `.vercel`** — does not ignore `.env`. No `.env` file exists there yet, but any future file would be at risk.
  - **⚠️ `ArchilyaAdminPanel/` has no `.gitignore` at all** — nothing is protected from accidental staging.
  - **Root has no `.gitignore`** either, though no source code lives there.
- **No Docker** for the main apps. Only `ArchilyaLauncher/SignallingWebServer/` has a Dockerfile (Epic Pixel Streaming).
- **No repo-wide config files** (`.cursorrules`, `opencode.json`, `.github/copilot-instructions.md`). Only `ArchilyaWebPanel/CLAUDE.md` exists and it just references `@AGENTS.md`.

## Child Instruction Files
- `ArchilyaWebPanel/AGENTS.md` — Next.js 16 warnings
- `ArchilyaMobil/AGENTS.md` — Full mobile KB (note: its tailwind `src/components/` claim is stale)
- `ArchilyaMobil/app/AGENTS.md` — Expo Router routes
- `ArchilyaMobil/src/AGENTS.md` — Hooks / services
- `ArchilyaMobil/android/AGENTS.md` — Native Android
- `ArchilyaWebBackend/functions/AGENTS.md` — Cloud Functions
