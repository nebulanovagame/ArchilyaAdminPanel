# Firebase Functions guidance

## Package boundary

- `functions/` is a separate Node 20 TypeScript package excluded from the root `tsconfig.json`.
- Run commands through the subpackage: `npm --prefix functions run build`, `npm --prefix functions run test`, `npm --prefix functions run deploy`.
- Build output goes to ignored `functions/lib/`; never edit generated files there.

## Runtime conventions

- Functions use `firebase-functions/v2` and Firebase Admin SDK.
- Default region is `europe-west1` unless a function explicitly says otherwise.
- Payload validation uses the Functions package's own dependencies; note this package currently uses Zod v3 while the root app uses Zod v4.
- This package does not contain every callable used by the web app. Workspace CRUD, Iyzico, credit, and AI tool callable names may be provided by another Firebase codebase/deployment.

## Render pipeline functions

- `src/render-pipeline.ts` owns `startRenderPipeline`, `estimateDepth`, `compareScenes`, and `requestRevision`.
- Credit-sensitive functions deduct credits transactionally before job creation and refund on creation failure.
- Keep rate limits aligned with client expectations: render starts are limited per user per minute and per workspace per hour.
- Job documents, revision links, and credit transaction records are part of the user-visible pipeline contract; update web tests/docs when changing them.

## Cleanup

- `cleanupDeletedProjectData` enforces trash retention and deletes associated Storage files. Treat Firestore rules/indexes and Storage paths as production data contracts.
