# SHARED UTILITIES

**Scope:** `functions/src/shared/` — 6 files, ~3,600 lines

## OVERVIEW
Central utility module consumed by all domain modules. Contains AI pipelines (Replicate, Gemini), R2/S3 storage, credit ledger RPCs, Supabase client, auth helpers, and error handling.

## FILES

| File | Lines | Role |
|---|---|---|
| **`index.js`** | 3083 | AI transforms, R2 storage, Resend email, prompt builders, Gemini model config — **needs splitting** |
| **`supabase.js`** | 46 | Supabase client init with local `.env` fallback |
| **`supabase-helpers.js`** | 248 | Auth helpers (`requireAuth`), workspace plan config, normalization functions |
| **`http-callable.js`** | 46 | Local `onCall` / `HttpsError` wrapper (alternative to Firebase v2) |
| **`constants.js`** | 179 | Prompt builders, image validators, scene edit parts builder, AI tool config |
| **`credit-ledger.js`** | 44 | Credit charge/refund RPC wrappers |

## INVOCATION PATTERNS

Modules import `shared` in two ways:

```js
// Pattern A: Destructure all from shared (most modules)
const shared = require('../shared');
const { FieldValue, requireAuth, ... } = shared;

// Pattern B: Import specific sub-modules (workspaces, credits, ai-jobs/processor)
const { onCall, HttpsError } = require('../shared/http-callable');
const { requireAuth } = require('../shared/supabase-helpers');
```

## CONVENTIONS
- `shared/index.js` is the main barrel — all exports from other shared files are re-exported through it
- Secret declarations (`defineSecret()`) live in `shared/index.js` — all domains reference them through the shared barrel
- `HttpsError` is defined both in `http-callable.js` and by `firebase-functions/v2/https` — use consistently per domain
- Turkish error messages in all user-facing validation (`'Gecerli bir gorsel zorunludur.'`)

## ANTI-PATTERNS
- Do NOT grow `index.js` beyond 3083 lines — extract new functionality into dedicated files
- Do NOT import from `shared/index.js` in sub-modules that already directly require `http-callable.js` — avoid circular dependencies
- Do NOT add secrets directly — use `defineSecret()` pattern
