# ARCHILYA WEB BACKEND

**Generated:** 2026-05-25
**Commit:** dce47d5
**Branch:** main

## OVERVIEW
Firebase Cloud Functions runtime (codebase `backend`) for Archilya's server-side operations — AI transforms, payments, credits, notifications, and storage workflows. Express 5 + Supabase PostgreSQL + Firestore dual-database architecture.

## STRUCTURE
```
ArchilyaWebBackend/
├── functions/          # Runtime codebase (Firebase Functions + Express)
├── firebase.json       # Codebase "backend", emulator config
├── .firebaserc         # Default project: nng-toma
├── .env                # Supabase credentials (gitignored)
├── supabase-migration.sql       # Full PostgreSQL schema (1016 lines)
├── supabase-runtime-hardening.sql   # RPCs + compatibility columns (289 lines)
└── package.json        # Orphaned — real deps in functions/
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Firebase entry + Sentry patch | `functions/index.js` | Barrel file wrapping 11 domains |
| Express standalone entry | `functions/server.js` | For local emulator |
| Express app + callable router | `functions/src/app.js` | Auth middleware, `/call/:functionName`, `/internal/process-ai-jobs` |
| Shared utilities (3083 lines) | `functions/src/shared/` | AI pipelines, R2 storage, credit ledger |
| AI job processor | `functions/src/ai-jobs/` | Gemini + Replicate + image storage |
| Payments (Iyzico) | `functions/src/payments/` | Subscription + credit top-up |
| Admin REST API | `functions/src/admin/` | Express router (different pattern) |
| Database schema | Root `.sql` files | Supabase PostgreSQL |
| Legacy migration tooling | `functions/_splitter.cjs`, `_detect-exports.cjs`, `_add-imports.cjs` | Reference different path — legacy |

## CONVENTIONS
- **CommonJS** — plain JS, no TypeScript, no build step
- **Turkish-first** error messages throughout
- **Sentry monkey-patch** at `functions/index.js` — auto-wraps every `onCall`/`onRequest`/`onTaskDispatched`
- **Secrets** via `defineSecret()` (Firebase Secret Manager), not `.env` in production
- **Dual entry**: `index.js` (Firebase) vs `server.js` (Express standalone)
- **Dual database**: Firestore (`db.collection(...)`) + Supabase PostgreSQL (`supabase.from(...)`)
- **Import from shared** — most modules do `const shared = require('../shared'); const { ... } = shared;`
- **Error codes** use Firebase-style: `invalid-argument`, `unauthenticated`, `permission-denied`, `not-found`, `failed-precondition`

## ANTI-PATTERNS (THIS PROJECT)
- Do NOT hardcode API keys in source — use `defineSecret()` only
- Do NOT add to the 3083-line `shared/index.js` without extraction plan
- Do NOT mix `firebase-functions/v2/https` and `../shared/http-callable` patterns — pick one per module
- Do NOT use `as any` or `@ts-ignore` (no TS, but the principle applies)
- Do NOT rely solely on `node --check` syntax validation — add proper tests

## COMMANDS
```bash
# functions/ subdirectory
npm run serve             # Express standalone on :8080
npm run check             # Syntax-check all source files
npm run migrate:storage   # Migrate file storage to Supabase
```

## NOTES
- Root `package.json` is orphaned — real dependencies live in `functions/package.json`
- `_splitter.cjs` / `_detect-exports.cjs` / `_add-imports.cjs` are legacy migration scripts that reference `C:/NNG/proje61/archilya-web/` (old path)
- The `functions/package.json` `main` points to `server.js` (Express), but Firebase deploys `index.js`
- Node 20 runtime, Express 5 (latest)
- The only active Firebase functions codebase is `backend` (this repo). The `ArchilyaWebPanel/functions/` codebase (`panel`) was removed; WebPanel is now Vercel-deployed with Supabase-only backend.
