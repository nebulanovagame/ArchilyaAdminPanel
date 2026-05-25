# Shared library guidance

## Boundaries

- `src/lib/auth/session.ts` imports `server-only`; never import it from client components, hooks, stores, or client services.
- Auth and database access uses Supabase singletons from `src/lib/supabase/`. Do not initialize duplicate clients.
- Server callable access belongs in `src/lib/supabase/callable.ts`; client callable wrappers belong in `src/services/` or domain-specific client modules.
- RBAC is split between pure permission helpers in `src/lib/rbac/permissions.ts` and Supabase-backed server checks in `src/lib/rbac/server.ts`.

## Module style

- Domain libraries usually use `types.ts`, `mapper.ts`, `service.ts`, and optional `index.ts` barrel exports.
- Legacy Firestore converter patterns were removed; use explicit mapper functions instead.
- Keep pure model/proration/format helpers framework-free so they remain unit-testable.

## API helpers

- Zod request schemas shared across routes belong in `src/lib/api/validation.ts`.
- Keep `apiErrorResponse`/`mapApiError` as the central status mapping path; many Turkish keywords are intentionally classified there.
- Rate limiting should use `src/lib/api/rate-limit.ts` rather than per-route in-memory maps.

## AI jobs

- `src/lib/ai-studio/job-contract.ts` maps user-subcollection AI Studio job documents.
