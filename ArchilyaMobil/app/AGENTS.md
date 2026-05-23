# APP ROUTE KNOWLEDGE BASE

## OVERVIEW
`app/` is the Expo Router surface: bootstrap, auth gating, route groups, modal routes, and project/detail screens.

## STRUCTURE
```text
app/
├── _layout.tsx         # global providers + redirects
├── (auth)/            # login/register/forgot-password
├── (tabs)/            # main authenticated shell
├── project/[id].tsx   # project detail route
├── modal.tsx          # modal route
├── +html.tsx          # web HTML override
└── +not-found.tsx     # not-found screen
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Auth redirect bug | `_layout.tsx` | `useSegments`, `useRouter`, `useAuth` |
| Push-notification routing | `_layout.tsx` | Redirects to project/workspace/inbox |
| Tab navigation | `(tabs)/_layout.tsx` | Badge counts aggregate notifications + invites |
| Dashboard behavior | `(tabs)/index.tsx` | Quick actions and modal launch |
| AI Studio behavior | `(tabs)/ai.tsx` | Large route with AI workflow and save/export paths |
| Projects tab | `(tabs)/two.tsx` | Search, create, trash handoff |
| Auth forms | `(auth)/*.tsx` | Login/register/forgot-password |
| Project detail | `project/[id].tsx` | Typed route param |
| Stack modal route | `modal.tsx` | Registered modal screen, but not the main project-create flow |

## CONVENTIONS
- `_layout.tsx` files own navigation structure; screens should stay relatively thin when possible, though a few existing screens are still logic-heavy.
- Auth access control is centralized in root layout, not duplicated per route.
- `(auth)` and `(tabs)` are route groups; group names do not become URL segments.
- Root-level feature screens (`workspace.tsx`, `subscription.tsx`, `trash.tsx`, etc.) sit outside tabs but inside the same Stack.
- Route params are typed where needed (`useLocalSearchParams<{ id: string }>()`).

## ANTI-PATTERNS
- Do not move business logic into route files if an existing hook/service already owns it.
- Do not rename route files casually; filenames are part of navigation contract.
- Do not add another auth gate inside child screens unless the route truly needs extra policy beyond the root layout.
- Do not assume `two.tsx` is disposable starter code; it is the live Projects screen despite the legacy filename.

## NOTES
- `modal.tsx` is registered from the root Stack with `presentation: 'modal'`, but current project-creation UX uses inline `src/components/ProjectCreateModal` from tab screens.
- `+html.tsx` and `+not-found.tsx` are active Expo Router special files.
- Tabs currently cover dashboard, projects, inbox, and AI Studio only; other product areas are separate stack screens.
- Push-notification routing in `_layout.tsx` can send users to a project, workspace, inbox, or `/ai-history`.
