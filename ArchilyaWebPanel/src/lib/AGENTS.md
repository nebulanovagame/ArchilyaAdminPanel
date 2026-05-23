# Shared library guidance

## Boundaries

- `src/lib/auth/session.ts` imports `server-only`; never import it from client components, hooks, stores, or client services.
- `src/lib/firebase/client.ts` owns Firebase client singletons. Do not initialize duplicate app/auth/firestore/functions instances in feature code.
- Server callable access belongs in `src/lib/firebase/callable-server.ts`; client callable wrappers belong in `src/services/` or domain-specific client modules.
- RBAC is split between pure permission helpers in `src/lib/rbac/permissions.ts` and Firestore-backed server checks in `src/lib/rbac/server.ts`.

## Module style

- Domain libraries usually use `types.ts`, `mapper.ts`, `service.ts`, and optional `index.ts` barrel exports.
- Only add a Firestore converter when the whole domain will consistently use it; many existing modules use explicit mapper functions instead.
- Keep pure model/proration/format helpers framework-free so they remain unit-testable.

## API helpers

- Zod request schemas shared across routes belong in `src/lib/api/validation.ts`.
- Keep `apiErrorResponse`/`mapApiError` as the central status mapping path; many Turkish keywords are intentionally classified there.
- Rate limiting should use `src/lib/api/rate-limit.ts` rather than per-route in-memory maps.

## Render and AI jobs

- `src/lib/ai-studio/render-pipeline.ts` handles top-level job callables/subscriptions; `src/lib/ai-studio/job-contract.ts` maps user-subcollection job documents.
- `src/lib/render/session-service.ts` is for `renderSessions` persistence, not AI job execution.
