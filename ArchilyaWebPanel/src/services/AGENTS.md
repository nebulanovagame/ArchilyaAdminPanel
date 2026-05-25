# Client service guidance

## Runtime boundary

- Files in this directory are client-side service wrappers. Keep `"use client"` when browser APIs, Supabase Auth, canvas, File, or pdf.js are used.
- Do not import server-only modules such as `@/lib/auth/session` here.
- Fetch or callable wrappers must attach the current Supabase access token when the corresponding API route expects `accessToken`.

## Existing services

- `entitlement-service.ts` centralizes workspace, credits, subscription, invite, branding, and secure backend operations.
- `nano-banana-service.ts` centralizes AI Studio image/PDF preparation, optimization, and job callable queuing. Avoid duplicating image base64/PDF/canvas logic in components.
- Several callable names used here are not implemented in this repo's `functions/src/`; they may come from another deployed codebase. Preserve names and payload contracts unless the backend deployment is changed too.

## Change rules

- Preserve callable fallback chains unless backend deployment and tests are updated together.
- Keep large image processing paths defensive: validate MIME/type, handle PDF rasterization failures, and avoid unbounded canvas sizes.
- Add tests around request payload shape when changing credit-sensitive service calls.
