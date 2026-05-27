# SRC LOGIC KNOWLEDGE BASE

## OVERVIEW
`src/` holds app logic and integrations: Firebase setup, auth context, domain hooks, callable-function services, reusable modals, and utilities.

## STRUCTURE
```text
src/
├── config/            # Firebase bootstrap
├── context/           # Auth context
├── hooks/             # Realtime domain hooks (10 files)
├── services/          # Callable/storage/AI integrations (13 files — largest in project)
├── components/        # Active shared app components (19 files, see src/components/AGENTS.md)
│   ├── ai/            # AI Studio component suite (11 files)
│   └── dashboard/     # Dashboard widgets (3 files)
├── utils/             # File helpers and small utilities
├── types/             # App-specific type definitions
├── @types/            # Third-party module augmentations
├── constants/         # Subscription catalog
├── i18n/ + locales/   # Internationalization setup + Turkish/English locales
└── schemas/           # Form validation schemas (Zod)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Firebase bootstrap | `config/firebase.ts` | app/auth/db/storage exports |
| Session/profile bugs | `context/AuthContext.tsx` | onAuthStateChanged + profile sync |
| Project data flow | `hooks/useProjects.ts` | Realtime list + secure mutations |
| Workspace/invite issues | `hooks/useWorkspace.ts`, `hooks/useInvitations.ts` | Firestore + callable mix |
| Notification logic | `hooks/useNotifications.ts`, `hooks/usePushNotifications.ts` | Badge data and push handling |
| Credits state | `hooks/useCredits.ts` | Balance + history |
| Secure writes | `services/entitlementService.ts` | Callable gateway |
| Storage / uploads | `hooks/useFileUpload.ts`, `services/r2StorageService.ts` | Firebase Storage + R2 helpers |
| AI tooling | `services/aiStudioService.ts`, `services/aiTransformService.ts`, `services/aiService.ts` | Prompt and transform flows |
| Shared modals | `components/ProjectCreateModal.tsx`, `components/AiSaveResultModal.tsx` | Active component library |

## CONVENTIONS
- Firebase reads are usually hook-owned; secure mutations are usually service-owned.
- `AuthContext.tsx` is the root dependency for user/session state across the app.
- Some hooks combine Firestore listeners with AsyncStorage caching for resilience, especially `useProjects.ts` and `useNotifications.ts`.
- Service names are domain-specific and mostly callable-function wrappers.
- New shared UI should prefer `src/components/` over root `components/` unless intentionally reusing starter helpers.

## ANTI-PATTERNS
- Do not bypass `entitlementService.ts` for sensitive writes when a secure wrapper already exists.
- Do not duplicate Firestore subscription logic across screens; push it into hooks.
- Do not expand root `components/` with new app-specific UI until the starter-vs-active split is resolved.
- Do not add sensitive or mutation-heavy logic directly into screens when an existing hook/service boundary already exists.

## NOTES
- The codebase has fully migrated from JS to TS; all files are now `.ts`/`.tsx` (previous AGENTS.md references to `.js` files are stale).
- `src/context/` has only `AuthContext.tsx`; auth concerns are intentionally centralized.
- `src/hooks/` and `src/services/` are the main growth areas. Services contain the 3 largest files: `aiStudioService.ts` (952 lines), `projectUploadQueue.ts` (502 lines), `entitlementService.ts` (347 lines).
- Root `components/` is not fully unused: `app/+not-found.tsx` still imports `@/components/Themed`.
- Type declarations are split across `src/types/index.ts` (app types), `src/@types/` (third-party module augmentations), and `src/components/ai/types.ts` (AI component types).
