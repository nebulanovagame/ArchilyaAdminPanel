# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-13
**Commit:** unborn
**Branch:** master

## OVERVIEW
Expo Router mobile app for Archilya. Core stack: Expo 55, React Native, expo-router, NativeWind, Firebase Auth/Firestore/Storage/Functions, EAS builds.

## STRUCTURE
```text
./
├── app/                # Route tree, auth gating, tabs, modal + detail screens
├── src/                # Firebase-backed logic: context, hooks, services, utils
├── android/            # Native Android project plus generated/build noise
├── docs/               # Delivery plan, parity roadmap, store checklist
├── components/         # Likely Expo starter leftovers + shared helpers
├── constants/          # Shared tokens such as Colors.ts
└── assets/             # Icons, fonts, splash assets
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| App bootstrap | `app/_layout.tsx` | Auth redirect, push routing, Stack registration |
| Main tabs | `app/(tabs)/_layout.tsx` | Panel, projects, inbox, AI Studio |
| Auth screens | `app/(auth)/` | login/register/forgot-password |
| Project detail route | `app/project/[id].tsx` | Typed route param |
| Auth state | `src/context/AuthContext.js` | Firebase auth + profile hydration |
| Realtime data hooks | `src/hooks/` | Projects, notifications, workspace, invites, credits |
| Secure backend calls | `src/services/entitlementService.js` | Callable-function gateway |
| Firebase wiring | `src/config/firebase.js` | app/auth/db/storage setup |
| AI flows | `src/services/ai*` + `src/hooks/useAiHistory.js` | Studio + history logic |
| Native release config | `eas.json` + `android/` | Internal dev/preview builds |
| Planning docs | `docs/` | Product and release process |

## CODE MAP
| Symbol/File | Type | Location | Role |
|-------------|------|----------|------|
| `RootLayout` | route layout | `app/_layout.tsx` | Global providers, fonts, splash, route tree |
| `InitialLayout` | route guard | `app/_layout.tsx` | Redirects auth vs tabs; routes push notifications |
| `TabLayout` | route layout | `app/(tabs)/_layout.tsx` | Bottom tabs and inbox badge aggregation |
| `AuthProvider` / `useAuth` | context | `src/context/AuthContext.js` | Session state + user profile sync |
| `useProjects` | hook | `src/hooks/useProjects.js` | Project list, caching, secure mutations |
| `useNotifications` | hook | `src/hooks/useNotifications.js` | Notification stream + read state |
| `useWorkspace` | hook | `src/hooks/useWorkspace.js` | Workspace and invite coordination |
| `entitlementService` helpers | service | `src/services/entitlementService.js` | Cloud Function wrappers |
| `firebase.js` exports | config | `src/config/firebase.js` | Firebase singleton setup |

## CONVENTIONS
- Route-first UI: screens live in `app/`; logic lives in `src/`.
- Auth gating happens in `app/_layout.tsx`, not inside individual screens.
- Firebase access is centralized: config in `src/config/firebase.js`, auth in `src/context/AuthContext.js`, realtime reads in hooks, secure writes in service wrappers.
- Hooks own domain state and Firestore subscriptions; services own callable/storage integrations.
- Styling is NativeWind-first with a dark palette (`background`, `surface`, `primary`, `secondary`) defined in `tailwind.config.js`.
- Expo Router special files are active here: `_layout.tsx`, `+html.tsx`, `+not-found.tsx`, route groups, and dynamic `[id].tsx`.

## ANTI-PATTERNS (THIS PROJECT)
- Do not treat `.expo/`, `dist/`, `android/app/.cxx/`, `android/build/`, `tmp-build.*`, or top-level APK/AAB files as source. They are build output/noise.
- Do not assume root `components/` is the active component library. Current app-specific modals live in `src/components/`.
- Do not add sensitive or mutation-heavy client logic directly into screens when an existing hook/service boundary already exists.
- Do not rely on in-repo CI/test conventions: there is no test framework or GitHub workflow configured yet.

## UNIQUE STYLES
- Product copy is predominantly Turkish.
- Dark UI palette is hard-coded across screens: `#0f1115`, `#1a1c23`, `#2a2d36`, `#c6a87c`.
- Tabs and route names are product-facing, but some file names still reflect starter naming (`two.tsx`, root `components/`).
- The repo mixes TypeScript route/components with many `.js` Firebase hooks/services.

## COMMANDS
```bash
npm start
npm run android
npm run ios
npm run web
eas build --profile development
eas build --profile preview
```

## NOTES
- `tailwind.config.js` scans `app/` and root `components/`, but not `src/components/`; that is an important styling gotcha because active modals live under `src/components/`.
- `eas.json` has internal `development` and `preview` profiles; `production`/`submit.production` are still empty.
- This repo is an unborn git branch right now (`master` with no commit history).
- Root `components/` appears to contain Expo starter helpers (`Themed`, `StyledText`, `EditScreenInfo`, etc.). Verify usage before expanding it.
- `docs/` is small and specific; keep roadmap/checklist material there instead of duplicating it in child AGENTS files.
