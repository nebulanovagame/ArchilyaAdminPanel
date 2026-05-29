# FAZ1B — AI Studio Productization Sprint

## Sprint Goal
Transform AI Studio from "powerful technical demo" to "premium productized beta" — no new features, no backend changes, purely UX productization.

---

## PHASE 0: FOUNDATION — Safe Component Refactors

### Task 0.1: Extract `AiStudioFieldRenderer` (shared field renderer)
**Files:**
- NEW: `src/app/(dashboard)/ai-studio/components/ai-studio-field-renderer.tsx`
- MODIFY: `ai-studio-settings-panel.tsx` → use FieldRenderer
- MODIFY: `ai-studio-mobile-settings.tsx` → use FieldRenderer

**What:** Extract the 15+ `field.type` switch cases duplicated across desktop settings panel (lines 249-673) and mobile settings (lines 68-404). Create a single `AiStudioFieldRenderer` that takes `{ field, settings, ...callbacks }`.

**Impact:** ~400 lines duplication eliminated.

### Task 0.2: Extract `AiStudioBeforeAfterSlider`
**File:** NEW + MODIFY `image-result-viewer.tsx`
**What:** Extract lines 153-231 (before/after comparison slider) into own component.
**Props:** `refImagePreview, resultImage, compareSplit, setCompareSplit, t`

### Task 0.3: Extract `AiStudioQuickRevisionSection`
**File:** NEW + MODIFY `image-result-viewer.tsx`
**What:** Extract lines 280-375 (quick revision chips + client note textarea).
**Props:** `onReviseWithType, onReviseWithNote, generating, t`

### Task 0.4: Extract `AiStudioResultActionsRow`
**File:** NEW + MODIFY `image-result-viewer.tsx`
**What:** Extract lines 429-513 (action buttons + feedback row).
**Props:** `result, saving, sharing, feedback` + all callbacks.

---

## PHASE 1: TOOL PRODUCTIZATION

### Task 1.1: Welcome State — "What would you like to do?"
**File:** MODIFY `ai-studio-welcome-state.tsx`

**Changes:**
- Change heading to "Ne yapmak istersiniz?" (What would you like to do?)
- Better card labels:
  - "Yeni Render Oluştur" (Create New Render)
  - "Mevcut Render'ı Revize Et" (Revise Existing Render)
  - "Kat Planı Hazırla" (Prepare Floor Plan)
  - "Tasarımı Analiz Ettir" (Analyze Design)
- Add role-based or use-case descriptions under each card
- Subtle visual refinement: larger icons, cleaner cards

### Task 1.2: Tool Rail — Cleaner Categories
**File:** MODIFY `ai-studio-tool-rail.tsx`, `ai-studio-tool-card.tsx`, `ai-studio-category-section.tsx`

**Changes:**
- Add category subtitles: "Render Üret" → "Fotorealistik görselleştirme"
- Hide credit cost from tool cards (show only on hover/selection)
- Reduce visual noise: simpler borders, fewer decorative elements
- Signature tools get a subtle "Öne Çıkan" badge but less visually aggressive
- Better empty state when no tool selected

### Task 1.3: Add Tool Search / Quick Filter
**File:** MODIFY `ai-studio-tool-rail.tsx`

**Changes:**
- Add a simple "Araç Ara..." (Search Tool) input at top of tool rail
- Filter tools by name/description as user types
- Quick category filter chips (All / Render / Analyze / Present)

---

## PHASE 2: WORKFLOW PRESENTATION

### Task 2.1: Smart Next-Step Suggestions
**File:** MODIFY `ai-studio-workflow-actions.tsx`, `image-result-viewer.tsx`

**Changes:**
- After result generation, show contextual "Sıradaki Adım" (Next Step) callout
- Smart suggestions based on what tool was used:
  - img2img → "Bu render'ı revize et" / "Farklı açı dene"
  - sceneedit → "Yeni revizyon ekle" / "Tasarımı analiz et"
  - multi-angle → "Tasarımı analiz et" / "Başka açı ekle"
  - analysis → "Render üretmeye başla"
- Subtle gradient highlight around suggested action
- Non-intrusive — doesn't block, just guides

### Task 2.2: Workflow State Indicator
**File:** MODIFY `ai-studio-canvas.tsx`

**Changes:**
- Add breadcrumb-style workflow indicator at top of canvas:
  "Render → Revizyon → Analiz" showing current position in workflow
- Shows completed steps vs current step
- Collapsible on mobile

---

## PHASE 3: RESULT EXPERIENCE

### Task 3.1: Result Hierarchy — Tier 1/2/3
**File:** MODIFY `image-result-viewer.tsx`

**Restructure result surface:**
```
TIER 1: PRIMARY RESULT
  - Full-size image (dominant, ~70% of viewport)
  - Close action (subtle)

TIER 2: QUICK ACTIONS
  - Simple icon row: Download | Save | Share | Regenerate
  - Minimal, clean, equal emphasis

TIER 3: WORKFLOW CONTINUATION
  - "Continue" section with:
    - Revise (primary CTA)
    - Multi-Angle (primary CTA)  
    - Analyze (secondary)
    - Variation (secondary)
```

### Task 3.2: Clean Up Result Surface
**File:** MODIFY `image-result-viewer.tsx`

**Changes:**
- Remove the "Multi-Angle Hero Section" from result viewer (it's already in WorkflowActions)
- Move before/after slider to a collapsible "Karşılaştır" toggle
- Feedback row: thinner, less prominent
- Overall: reduce from 7 zones to 4 zones

---

## PHASE 4: SESSION / HISTORY VISIBILITY

### Task 4.1: Collapsible Session Panel
**File:** NEW `ai-studio-session-panel.tsx` + MODIFY `page.tsx`

**Changes:**
- Add a collapsible "session" section below tool rail on desktop
- Shows:
  - "Son İş" (Last Job) — last completed output with thumbnail
  - "Prompt Geçmişi" (Prompt History) — last 3-4 entries
  - "Devam Et" (Continue) — restore last session
- Minimal: expands on click, shows preview in collapsed state
- Uses localStorage restore pattern (already exists)

### Task 4.2: Prompt History in Canvas
**File:** MODIFY `ai-studio-canvas.tsx`

**Changes:**
- Show recent prompt history as small chips below the upload area
- Click to restore settings (already exists in `applyPromptHistory`)
- Visual label: "Geçmiş Prompt'lar" (Past Prompts)

---

## PHASE 5: TOOL SWITCHING UX

### Task 5.1: Smart Context Preservation
**File:** MODIFY `use-ai-studio-tool-selection.ts`, `page.tsx`

**Changes:**
- When switching tools, if there's existing context (image, settings):
  - Show lightweight confirmation: "Mevcut ayarlar kaybolacak, devam etmek istiyor musunuz?"
  - If user has result, offer: "Sonucu koruyarak aracı değiştir"
- If no context exists → switch freely (current behavior)
- Single toast-style confirmation, not blocking modal

---

## PHASE 6: MOBILE PRODUCTIZATION

### Task 6.1: Mobile Tool Discovery
**File:** MODIFY `page.tsx` (mobile tool chips area)

**Changes:**
- Better horizontal tool chips: icons + labels visible without scroll
- Show 4-5 tools at once, scroll for more
- Active tool more prominent (larger, accent background)

### Task 6.2: Mobile Result Experience
**File:** MODIFY `image-result-viewer.tsx`, `ai-studio-canvas.tsx`

**Changes:**
- Result image takes full viewport height on mobile
- Action buttons stacked vertically on mobile
- Workflow actions compact: icon-only with labels on tap
- Settings sheet: smoother animation, better touch targets

### Task 6.3: Mobile Workflow Visibility
**File:** MODIFY `ai-studio-mobile-settings.tsx`, `page.tsx`

**Changes:**
- Session indicator on mobile: thin bar showing "Son İş: Premium Render"
- Quick workflow status in bottom bar
- Settings count badge on trigger button

---

## PHASE 7: PREMIUM UX POLISH

### Task 7.1: Visual Hierarchy Refresh
**Files:** Across all components

**Changes:**
- Consistent section spacing: 12px between related items, 20px between sections
- Button emphasis: only 1-2 primary actions per section
- Enable/disable states: clearer disabled opacity (0.35 → 0.3)
- Section titles: all `text-[9px] uppercase tracking-wider font-bold text-gray-500`
- Bottom padding consistency: pb-container pattern

### Task 7.2: Microcopy Polish
**Files:** `messages/tr.json`, `messages/en.json`

**Changes:**
- Review all Turkish strings for tone consistency
- Add helpful section descriptions
- Tool descriptions: more benefit-focused, less technical
- Action labels: shorter, punchier where appropriate

### Task 7.3: Empty States
**Files:** `ai-studio-canvas.tsx`, `ai-studio-welcome-state.tsx`

**Changes:**
- Better empty states for each canvas condition
- Welcome: "Henüz bir araç seçmediniz" → " Size nasıl yardımcı olabilirim?"
- Upload: clearer supported format display
- No results: clean white space, no confusing messages

### Task 7.4: Loading & Transition Feel
**Files:** `ai-studio-processing-state.tsx`

**Changes:**
- Smoother step transitions
- Estimated time remaining (hardcoded per tool type for now)
- Premium loading spinner: Archilya-branded instead of generic

---

## EXECUTION PLAN

### Parallel Workstreams

```
WEEK 1 (This sprint):
├── Stream A: Foundation Refactors (Tasks 0.1-0.4)
│   ├── Agent A1: Extract AiStudioFieldRenderer
│   └── Agent A2: Extract sub-components from ImageResultViewer
│
├── Stream B: Tool Productization (Tasks 1.1-1.3)
│   ├── Agent B1: Welcome state + tool rail
│   └── Agent B2: Search/filter
│
├── Stream C: Workflow + Result (Tasks 2.1-3.2)
│   ├── Agent C1: Smart next-steps + workflow indicator
│   └── Agent C2: Result hierarchy cleanup
│
├── Stream D: Session + Mobile (Tasks 4.1-6.3)
│   ├── Agent D1: Session panel + history
│   └── Agent D2: Mobile improvements
│
└── Stream E: Polish (Tasks 7.1-7.4)
    └── Agent E1: Visual hierarchy, microcopy, empty states
```

### Execution Order

1. Phase 0 (Foundation) MUST run first — other changes depend on clean components
2. Phases 1-3 can run in parallel after Phase 0
3. Phases 4-6 can run in parallel with 1-3
4. Phase 7 runs last (polish on top of all changes)

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Component extraction breaks existing functionality | Each extraction: old file unchanged until new component verified |
| Mobile/desktop divergence | Shared field renderer ensures parity |
| Style drift | Use Tailwind utility classes consistently, reuse animation-variants |
| Over-polishing | Limit to spacing/hierarchy/microcopy — no layout rewrites |
| Test failures | Run `npm run test` after each phase |

### Safe Boundaries (DO NOT TOUCH)

- `services/nano-banana-service.ts`
- `lib/ai-studio/job-contract.ts`
- `lib/ai-studio/tools.ts`
- `hooks/use-ai-studio-job.ts` (shared hook)
- `hooks/use-ai-studio-job-lifecycle.ts` (core logic)
- `hooks/use-ai-studio-job-terminal.ts` (terminal handling)
- `hooks/use-ai-studio-result.ts` (result state)
- `hooks/use-ai-studio-state.ts` (facade)
- Any API routes
- Any backend logic
- Tool IDs, credit costs, backend contracts
