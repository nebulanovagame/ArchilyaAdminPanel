# Store guidance

## Pattern

- Stores here are React Context providers (`createContext`, provider component, guarded `use{Name}Context` hook), not Zustand/Redux.
- Provider files are `.tsx`; tests usually render small harness components with Testing Library.
- Most render stores persist drafts to `localStorage` and restore them on mount with `startTransition`.

## Persistence rules

- Storage keys use `archilya-render-{domain}-draft`.
- Never persist browser `File` objects or large blob/data preview fields unless the existing tests and storage-size implications are addressed.
- Reset actions should clear both in-memory state and the matching localStorage key.

## Pipeline caution

- `pipeline-store.tsx` coordinates credits, auth, AI Studio job snapshots, stage approvals, revisions, timeouts, and final output URLs.
- For pipeline changes, update `pipeline-store.test.ts` first or alongside the change; it covers multi-scene queuing, timeout handling, revision flow, and persisted resume behavior.
