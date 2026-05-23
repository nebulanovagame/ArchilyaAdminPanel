# Archilya Render component guidance

## Scope

- Components here implement the `/archilya-render` wizard stages: `intake`, `auditor`, `markup`, `spatial`, `pipeline`, and `shared`.
- The route-level guide at `src/app/(dashboard)/archilya-render/AGENTS.md` also applies. Read it before changing job flow, persistence, or stage navigation.

## Component boundaries

- Keep stage components thin where possible; shared state belongs in `src/stores/`, Firestore/session logic in hooks or `src/lib/render/`, and AI job queuing in services/lib modules.
- Do not duplicate render job watchers or localStorage draft logic inside components. Use existing store contexts and hooks.
- Mark components with `"use client"` only when they use hooks, browser APIs, canvas/File APIs, or local UI state that requires it.

## Stage-specific cautions

- Markup components use canvas/Fabric-style interactions and undo/redo state from `MarkupProvider`; preserve coordinate/constraint mapping tests when changing tools.
- Spatial components may use depth/consistency jobs that watch top-level `aiStudioJobs/{jobId}` through `useRenderJob()`.
- Pipeline components render multi-scene Agent Council state from `PipelineProvider`; do not bypass timeout, blacklist, approval, or revision state from the store.

## Verification

- For component changes, run the matching store/integration tests plus `src/app/(dashboard)/archilya-render/i18n.test.ts` when labels or stage names change.
- E2E coverage for the full stage flow lives in `e2e/archilya-render.spec.ts`.
