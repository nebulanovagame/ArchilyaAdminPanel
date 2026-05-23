# SRC LOGIC KNOWLEDGE BASE

## OVERVIEW
`src/` holds app logic and integrations: Firebase setup, auth context, domain hooks, callable-function services, reusable modals, and utilities.

## STRUCTURE
```text
src/
├── config/            # Firebase bootstrap
├── context/           # Auth context
├── hooks/             # Realtime domain hooks
├── services/          # Callable/storage/AI integrations
├── components/        # Active shared app components
└── utils/             # File helpers and small utilities
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Firebase bootstrap | `config/firebase.js` | app/auth/db/storage exports |
| Session/profile bugs | `context/AuthContext.js` | onAuthStateChanged + profile sync |
| Project data flow | `hooks/useProjects.js` | Realtime list + secure mutations |
| Workspace/invite issues | `hooks/useWorkspace.js`, `hooks/useInvitations.js` | Firestore + callable mix |
| Notification logic | `hooks/useNotifications.js`, `hooks/usePushNotifications.js` | Badge data and push handling |
| Credits state | `hooks/useCredits.js` | Balance + history |
| Secure writes | `services/entitlementService.js` | Callable gateway |
| Storage / uploads | `hooks/useFileUpload.js`, `services/r2StorageService.js` | Firebase Storage + R2 helpers |
| AI tooling | `services/aiStudioService.js`, `services/aiTransformService.js`, `services/aiService.js` | Prompt and transform flows |
| Shared modals | `components/ProjectCreateModal.tsx`, `components/AiSaveResultModal.tsx` | Active component library |

## CONVENTIONS
- Firebase reads are usually hook-owned; secure mutations are usually service-owned.
- `AuthContext.js` is the root dependency for user/session state across the app.
- Some hooks combine Firestore listeners with AsyncStorage caching for resilience, especially `useProjects.js` and `useNotifications.js`.
- Service names are domain-specific and mostly callable-function wrappers.
- New shared UI should prefer `src/components/` over root `components/` unless intentionally reusing starter helpers.

## ANTI-PATTERNS
- Do not bypass `entitlementService.js` for sensitive writes when a secure wrapper already exists.
- Do not duplicate Firestore subscription logic across screens; push it into hooks.
- Do not expand root `components/` with new app-specific UI until the starter-vs-active split is resolved.
- Do not forget the Tailwind scan gap: `src/components/` is active, but `tailwind.config.js` does not currently include it.

## NOTES
- The codebase is mixed TS/JS here; route files are mostly TSX while Firebase logic is largely `.js`.
- `src/context/` has only `AuthContext.js`; auth concerns are intentionally centralized.
- `src/hooks/` and `src/services/` are the main growth areas and deserve most contributor attention.
- Root `components/` is not fully unused: `app/+not-found.tsx` still imports `@/components/Themed`.
