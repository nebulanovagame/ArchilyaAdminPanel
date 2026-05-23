# Archilya Render guidance

## Domain model

- Route: `/archilya-render` with `?stage=intake|markup|spatial|pipeline`; the entire wizard is in `page.tsx`.
- Provider order is intentional: `IntakeProvider > AuditProvider > MarkupProvider > SpatialProvider > PipelineProvider`.
- Stage flow is intake/audit -> markup -> spatial lock -> pipeline output. Do not skip audit/spatial guards without updating tests.
- Components live in `src/components/dashboard/archilya-render/{intake,auditor,markup,spatial,pipeline,shared}`.
- Render session persistence is part of this route: `RenderSessionSync` in `page.tsx` uses `useRenderSession()` and `src/lib/render/session-service.ts` to write `renderSessions` documents.

## State and persistence

- Render stores are React Context + `useState`, not Zustand/Redux.
- Drafts persist to `localStorage` keys named `archilya-render-*-draft`; `FinalOutputViewer` also uses `archilya-render-saved-outputs`.
- File/blob fields such as `imageFile` and `imagePreview` are intentionally stripped from persisted drafts. Refresh restores metadata, not browser `File` objects.
- Restores use `startTransition`; do not assume persisted data is synchronously available on first render.

## Pipeline/job gotchas

- The visible Agent Council pipeline queues one `enhance` AI Studio job per renderable scene through `queueAiStudioJob()` in `src/services/nano-banana-service.ts`.
- Pipeline status watches `users/{uid}/aiStudioJobs/{jobId}` snapshots and maps them into the shared pipeline job shape.
- Top-level `aiStudioJobs/{jobId}` watchers still exist for render/depth/consistency flows through `src/lib/ai-studio/render-pipeline.ts` and `useRenderJob()`; do not collapse these with the user-subcollection watcher without a migration.
- There are two critical timeout classes: 90s job-discovery timeout when no Firestore doc appears, and 10min progress timeout when status/progress/stage stalls.
- Timed-out job IDs are blacklisted; late snapshots must remain ignored or the UI can resurrect failed runs.
- Revision requests create a new job linked by `parentJobId`; the previous active job should stop driving UI state.

## Verification

- For pipeline/store changes, run focused Vitest tests such as `npm run test -- src/stores/pipeline-store.test.ts` plus related store or i18n tests.
- If changing render session persistence, update `src/lib/render/session-service.ts`, `firestore.rules`, and `firestore.indexes.json` together and run the related render/session tests.
- E2E coverage lives in `e2e/archilya-render.spec.ts`; it seeds localStorage and mocks Firebase callable traffic.
- Update both `messages/tr.json` and `messages/en.json` for every render UI key.
