# COMPONENT KNOWLEDGE BASE

## OVERVIEW
`src/components/` is the active UI component library for ArchilyaMobil. All new app-specific UI should go here, not root `components/` (which holds Expo starter leftovers).

## STRUCTURE
```text
src/components/
├── ai/                 # AI Studio component suite (11 files)
│   ├── AIStudioHeader, ToolSelector, StyleSelector, PromptSection
│   ├── PromptHistorySection, GenerationControls, SourceImageSection
│   ├── ImageResultSection, TextResultSection, SceneSettings
│   ├── StatusBanners
│   └── types.ts        # AI component type definitions
├── dashboard/          # Dashboard widgets (3 files)
│   ├── QuickActionsGrid.tsx
│   ├── StatsCards.tsx
│   └── RecentProjectsList.tsx
├── SearchModal.tsx      # Reusable search modal (309 lines)
├── ProjectCreateModal.tsx  # Project creation (99 lines)
├── AiSaveResultModal.tsx   # AI save/export (204 lines)
└── OfflineIndicator.tsx    # Connectivity status (31 lines)
```

## WHERE TO LOOK
| Task | File | Lines | Notes |
|------|------|-------|-------|
| Search across projects | `SearchModal.tsx` | 309 | Reusable, stateful |
| Create new project | `ProjectCreateModal.tsx` | 99 | Triggered from dashboard |
| AI result save flow | `AiSaveResultModal.tsx` | 204 | Export + naming |
| Offline status banner | `OfflineIndicator.tsx` | 31 | NetInfo-based |
| AI Studio scene settings | `ai/AIStudioSceneSettings.tsx` | 146 | Scene params |
| AI generation controls | `ai/AIStudioGenerationControls.tsx` | 63 | Start/stop/params |
| Dashboard quick actions | `dashboard/QuickActionsGrid.tsx` | 127 | Grid of action cards |

## CONVENTIONS
- All components use NativeWind dark palette (`bg-background`, `bg-surface`, `bg-primary`, `bg-secondary`).
- Tailwind content scan includes `./src/components/**/*.{js,jsx,ts,tsx}` — no scan gap.
- Modal components (ProjectCreate, AiSaveResult) are presented inline from tab screens, not via Expo Router modals.
- AI Studio components are tightly coupled to `src/services/aiStudioService.ts` — expect backend dependency.
- Component tests live in co-located `__tests__/` directories.

## ANTI-PATTERNS
- Do NOT add new app-specific UI to root `components/` (starter boilerplate, mostly dead code).
- Do NOT import from root `components/` in new code — use `src/components/` instead.
- Do NOT add business logic into components; use hooks from `src/hooks/` or services from `src/services/`.
