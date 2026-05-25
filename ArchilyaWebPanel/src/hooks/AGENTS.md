# Hooks guidance

## General pattern

- Hooks in this directory are reusable client-side React hooks. Add `"use client"` when the hook uses React state/effects, Supabase client SDK, browser APIs, or context providers.
- Keep hooks focused on orchestration and subscription lifecycle; pure data mapping belongs in `src/lib/**`.
- Always unsubscribe Supabase Realtime listeners in cleanup and avoid creating listeners when required IDs/refs are missing.

## Realtime hooks

- Prefer `useRealtimeDoc`, `useRealtimeQuery`, or existing domain hooks before writing a new raw polling wrapper.
- `usePaginatedQuery` is one-shot pagination, not realtime; choose realtime hooks when the UI must update live.
- Permission-denied retry behavior is centralized in `useFirestoreDoc`; do not duplicate ad-hoc retry loops without a reason.

## Auth/workspace hooks

- Client code should use `useAuth()`, `useWorkspace()`, and `useCredits()` rather than importing server-only auth/session modules.
- Mutation hooks should preserve existing `canMutate`/role/error-message patterns where present.
