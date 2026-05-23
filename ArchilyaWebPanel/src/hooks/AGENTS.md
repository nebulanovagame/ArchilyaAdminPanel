# Hooks guidance

## General pattern

- Hooks in this directory are reusable client-side React hooks. Add `"use client"` when the hook uses React state/effects, Firebase client SDK, browser APIs, or context providers.
- Keep hooks focused on orchestration and subscription lifecycle; pure data mapping belongs in `src/lib/**`.
- Always unsubscribe Firestore listeners in cleanup and avoid creating listeners when required IDs/refs are missing.

## Firestore hooks

- Prefer `useFirestoreDoc`, `useFirestoreQuery`, or existing domain hooks before writing a new raw `onSnapshot` wrapper.
- `usePaginatedFirestoreQuery` is one-shot pagination, not realtime; choose realtime hooks when the UI must update live.
- Permission-denied retry behavior is centralized in `useFirestoreDoc`; do not duplicate ad-hoc retry loops without a reason.

## Render hooks

- `use-render-session.ts` persists route state to `renderSessions` through `src/lib/render/session-service.ts`; changes may require matching updates to `firestore.rules` and `firestore.indexes.json`.
- `use-render-job.ts` watches top-level `aiStudioJobs/{jobId}` and auto-unsubscribes on terminal states.
- Archilya Render's multi-scene pipeline also watches `users/{uid}/aiStudioJobs/{jobId}` from `pipeline-store.tsx`; keep this distinction clear when refactoring.

## Auth/workspace hooks

- Client code should use `useAuth()`, `useWorkspace()`, `useWorkspaceRole()`, and `useCredits()` rather than importing server-only auth/session modules.
- Mutation hooks should preserve existing `canMutate`/role/error-message patterns where present.
