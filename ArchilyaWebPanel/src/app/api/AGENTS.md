# API route guidance

## Handler pattern

- API routes are App Router route handlers under `src/app/api/**/route.ts`.
- Keep the usual order: validate input with Zod helpers from `@/lib/api/validation`, require the panel session, verify the Firebase ID token, then call backend services.
- Sensitive routes normally accept `idToken` in the request body or form data; do not silently switch to `Authorization` headers unless all callers and tests are updated.
- Wrap mutating or expensive handlers with `withRateLimit` from `@/lib/api/rate-limit`.
- Return failures through `apiErrorResponse` from `@/lib/api/errors` so status mapping stays consistent.

## Auth and RBAC

- `requireSessionUser()` comes from `@/lib/auth/session` and is server-only. Never import it into client components.
- Use `requireVerifiedFirebaseIdentity(sessionUser, idToken)` before trusting caller-provided user IDs.
- Workspace-sensitive operations should call RBAC helpers from `@/lib/rbac/server` where applicable.

## Local conventions

- Shared route logic can live in `_shared.ts` next to sibling routes, as in `subscription/_shared.ts`.
- Keep user-facing error text Turkish unless the surrounding route already delegates translation elsewhere.
- If adding schemas, prefer central schemas in `@/lib/api/validation` when more than one route will use them.
