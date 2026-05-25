# FUNCTIONS BACKEND — CLOUD FUNCTIONS RUNTIME

**Scope:** `functions/` — 42 files, 13 domain modules, ~10k+ lines

## OVERVIEW
Firebase Cloud Functions runtime (codebase `backend`) for AI transforms, payments, credits, workspaces, notifications, R2 storage, contact forms, and legacy migration. Express 5 + Supabase PostgreSQL + Firestore dual-database architecture.

## STRUCTURE
```text
functions/
├── index.js                  # Firebase Functions barrel (Sentry init + monkey-patch + 11 re-exports)
├── server.js                 # Express standalone entry (for emulator/dev)
├── package.json              # Node 20, Express 5, Sentry, Supabase, Replicate, Resend
├── _detect-exports.cjs       # Legacy: detect export ranges from old monolithic index.js
├── _add-imports.cjs          # Legacy: auto-add shared imports to domain modules
├── scripts/
│   └── migrate-storage-to-supabase.js
└── src/
    ├── app.js                # Express app: auth middleware, /call/:functionName, /admin, /internal
    ├── _splitter.cjs         # Legacy: split monolithic index.js into domain modules
    ├── shared/               # 6 files — shared utilities (index.js = 3083 lines!)
    ├── admin/                # Express REST router for AdminPanel (525 lines)
    ├── ai-jobs/              # AI Studio job pipeline (5 files: index, express, processor, gemini, storage)
    ├── ai-legacy/            # Legacy AI prompts (index.js + helpers.js)
    ├── contact/              # Contact form submission + Resend emails
    ├── credits/              # Credit deduction/refund via Supabase RPCs
    ├── legacy/               # Account deletion, user profile migration
    ├── notifications/        # Push token registration, notification read tracking
    ├── payments/             # Iyzico payments, subscription management, RevenueCat catalog
    ├── projects/             # Project CRUD + file management (index.js + express.js)
    ├── r2-admin/             # R2 presigned URLs for AdminPanel product uploads
    ├── r2-user/              # R2 presigned URLs for user project uploads
    └── workspaces/           # Workspace creation + membership management
```

## DOMAIN MODULE PATTERNS

| Pattern | Modules | Import Style |
|---|---|---|
| **Firebase v2 direct** | projects, payments, ai-jobs, contact, notifications, ai-legacy, r2-admin, r2-user, legacy | `const { onCall } = require('firebase-functions/v2/https')` |
| **Local http-callable wrapper** | workspaces, credits | `const { onCall } = require('../shared/http-callable')` |
| **Express router** | admin | `const router = express.Router()` |

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Firebase entry + Sentry patch | `index.js` | Wraps every handler automatically |
| Express standalone mode | `server.js` → `src/app.js` | `/call/:functionName` generic router |
| Shared monolith (3083 lines) | `src/shared/index.js` | AI pipelines, R2, Resend, Gemini, Replicate |
| AI job processing queue | `src/ai-jobs/` | 5 files: processor, gemini, storage, express, index |
| Payment integration (Iyzico) | `src/payments/index.js` | Subscription, credit top-up, RevenueCat catalog |
| Admin REST API | `src/admin/index.js` | Express router, service_role Supabase client |
| R2 storage presigned URLs | `src/r2-user/`, `src/r2-admin/` | Cloudflare R2 with project/product scoping |

## CONVENTIONS
- **CommonJS** — plain JS, no TypeScript, no build step
- **Turkish-first** error messages (`'Giris yapmaniz gerekiyor.'`, `'Proje adi zorunludur.'`)
- **Sentry monkey-patch** in `index.js` wraps all `onCall`/`onRequest`/`onTaskDispatched` at import time
- **Secrets** via `defineSecret()` from `firebase-functions/params` — not `.env` in production
- **Dual entry**: `index.js` for Firebase Functions, `server.js` for Express standalone
- **Dual database**: Firestore (`db.collection()`) + Supabase PostgreSQL (`supabase.from()`)
- **Error codes**: Firebase-style (`invalid-argument`, `unauthenticated`, `permission-denied`, `not-found`, `failed-precondition`)
- **Auth**: `requireAuth(request)` pattern — checks `request.auth?.uid`
- **Sentry user tagging**: `Sentry.setUser({ id: req.auth.uid })` inside wrapped handlers
- **Global function options**: `europe-west1`, `512MiB`, concurrency 80, min 1 instance

## ANTI-PATTERNS (THIS PROJECT)
- Do NOT hardcode API keys — use `defineSecret()` only
- Do NOT extend the 3083-line `src/shared/index.js` — extract into separate modules
- Do NOT introduce a third `onCall`/`HttpsError` import pattern — stick to one of the two existing
- Do NOT add Express routes to non-admin modules unless they follow the `/call/:functionName` pattern
- Do NOT rely solely on `node --check` — no test framework catches runtime errors
- Do NOT reference the legacy path `C:/NNG/proje61/archilya-web/` in new code (migration tools use it)

## COMMANDS
```bash
npm run serve             # Express standalone on port 8080
npm run start             # Same as serve
npm run check             # Syntax-check all source files via node --check
npm run migrate:storage   # Migrate file storage to Supabase
```

## NOTES
- `package.json` `main` points to `server.js` (Express), but Firebase discovers `index.js` for deployment
- Migration scripts `_detect-exports.cjs`, `_add-imports.cjs`, `src/_splitter.cjs` reference old path — legacy only
- This is codebase `backend` — a separate functions codebase `panel` exists in `ArchilyaWebPanel/functions/`
- No `.editorconfig`, no ESLint, no Prettier, no test framework configured
- Node 20 runtime with Express 5 (bleeding edge)
