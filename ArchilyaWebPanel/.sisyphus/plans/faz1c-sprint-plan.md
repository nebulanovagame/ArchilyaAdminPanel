# FAZ1C BETA MONETIZATION READY SPRINT — IMPLEMENTATION PLAN

## Sprint Goal
Take AI Studio from current state (~50% FAZ1C complete) to PRIVATE BETA + FIRST REVENUE readiness.

## SAFE REFACTOR RULES (MUST NOT CHANGE)
- ❌ Backend contracts (tool IDs, API paths, callable names)
- ❌ Billing backend (Iyzico flow, subscription mutation)
- ❌ Queue/Provider/AI logic/prompt system
- ❌ Tool engines (generation architecture)
- ❌ New AI capabilities
- ✅ Frontend-only changes: UI components, microcopy, messaging, presentation

---

## WORK UNIT 1: CREDIT / PRICING VISIBILITY

### 1a. Credit/TL Value Display in Settings Panel
- **File**: `ai-studio/components/ai-studio-settings-panel.tsx`
- **Change**: In the tool header section (line 337-350), add the TL equivalent value using the existing i18n key `creditValue` → `~₺{price} değerinde`
- **CREDIT_TO_TL_RATE**: Use `0.7` (already exists in tool-rail.tsx) — extract to constants.ts

### 1b. Low Credit Threshold Warning
- **File**: `components/dashboard/credit-pills.tsx`
- **Change**: Add visual warning (border color change + "Düşük" label) when credits < threshold (e.g., 50 or 20% of plan max). Keep sparkles icon pulsing on low credits.

### 1c. Pricing Summary Link in AI Studio
- **File**: `ai-studio/components/ai-studio-welcome-state.tsx`
- **Change**: Add a subtle "Plan karşılaştırması" link/footer in the welcome state that links to `/abonelik`

### 1d. Add Credit Context to Welcome State
- **File**: `ai-studio/components/ai-studio-welcome-state.tsx`
- **Change**: Show current plan name, remaining credits, and a low-key upgrade CTA (if on free plan) in the welcome footer

---

## WORK UNIT 2: ONBOARDING & FIRST-VISIT EXPERIENCE

### 2a. Enhanced Welcome State Value Proposition
- **File**: `ai-studio/components/ai-studio-welcome-state.tsx`
- **Change**: 
  - Replace static welcome with more compelling value prop
  - Add hero section: "Sketchup görselinizi → AI Render → Revize → Analiz → Sunum" workflow visualization
  - Keep existing onboarding steps + suggestion cards but enhance copy
  - Add a sample/demo suggestion: "Örnek görselle dene"

### 2b. Contextual Hints (no popups/tooltips)
- **File**: `ai-studio/page.tsx` (canvas state management)
- **Change**: When tool is selected but no image uploaded (canvasState=upload), add subtle inline hint text below upload zone: "Bir görsel yükleyerek başlayın → Ayarları yapın → Generate'e basın"

### 2c. First-Visit Detection (localStorage)
- **File**: `ai-studio/page.tsx`
- **Change**: Check localStorage for `archilya:ai-studio:first-visit` on mount. If not found, set it and show a subtle welcome banner (dismissible, non-tour) in the welcome state that highlights "İlk adım: Bir araç seçin"

### 2d. Empty State Per Tool Guidance
- **File**: `ai-studio/components/reference-uploader.tsx`
- **Change**: Add contextual guidance text above upload zone based on selected tool (e.g., "Sketchup ekran görüntünüzü yükleyin" for img2img, "Kat planı görselinizi yükleyin" for plancolor)

---

## WORK UNIT 3: TRUST SIGNALS

### 3a. Inline Retry on Job Failure
- **File**: `ai-studio/components/job-status-panel.tsx`
- **Change**: When job fails, add a "Tekrar Dene" button that calls `onRetry()` callback alongside the error message

### 3b. Enhanced Completion Transition
- **File**: `ai-studio/page.tsx` (lines 56-77)
- **Change**: After the 900ms hold, add a brief scale-in + fade-in animation on the result content for a more premium feel

### 3c. Upload Progress Feedback
- **File**: `ai-studio/page.tsx` and `ai-studio/components/reference-uploader.tsx`
- **Change**: When file is being processed (between drop and preview state), show a brief processing indicator

### 3d. Remaining Credit After Generation
- **File**: `ai-studio/components/image-result-viewer.tsx`
- **Change**: Already exists (creditRemaining badge) — verify it shows correct updated balance. Add text below credit badge: "{credits} kalan işleminiz var"

---

## WORK UNIT 4: PREMIUM PRODUCT POLISH

### 4a. Upgrade Wording Refinement
- **File**: `ai-studio/components/ai-studio-generate-bar.tsx`
- **Change**: When on free plan and selecting a paid tool, soften the upgrade CTA from "Plan Yükselt" to "Solo plana geçerek 1000 işlem kazanın" (value-first, feature-based messaging)

### 4b. CTA Hierarchy Refinement
- **File**: `ai-studio/components/ai-studio-generate-bar.tsx`
- **Change**: Make generate button even more prominent with a subtle glow/shadow. When canGenerate is true, use a bolder gradient accent.

### 4c. Microcopy Audit
- **Files**: `messages/tr.json` (aiStudio section), `messages/en.json`
- **Change**: Review and polish key microcopy points:
  - Generate button: "Üret · {credit} Kredi" should feel premium
  - Credit section: Use "İşlem Hakkı" instead of "kredi" in some key spots
  - Empty states: More inviting language

### 4d. Tool Benefit Microcopy Enhancement
- **File**: `messages/tr.json` (toolBenefits keys)
- **Change**: Polish all tool benefit descriptions to be more compelling and value-oriented

---

## WORK UNIT 5: CONVERSION READINESS

### 5a. Improved Dashboard AI Studio Quick Action
- **File**: `src/app/(dashboard)/page.tsx`
- **Change**: Enhance the "AI Stüdyo" quick action card with a more compelling value proposition subtitle

### 5b. Add "View Pricing" Link in AI Studio
- **File**: `ai-studio/components/ai-studio-tool-rail.tsx` or settings panel
- **Change**: Add subtle "Fiyatlandırmayı görüntüle" link in the tool rail or settings panel header

### 5c. Signature Tool Upgrade Suggestion
- **File**: `ai-studio/page.tsx` (when tool selected) or tool-card
- **Change**: When user selects a signature tool (sceneedit, multi-angle) and has free plan, show a subtle upgrade suggestion in the settings panel (not a blocking gate, just awareness)

---

---

## PER-TASK QA SCENARIOS

### Work Unit 1: Credit/Pricing Visibility
| Task | QA Tool | Steps | Expected |
|------|---------|-------|----------|
| 1a. TL Value Display | Browser | 1. Open AI Studio 2. Select any render tool 3. Check right panel header | Credit cost shows both "20 Kredi" and "~₺14 değerinde" |
| 1b. Low Credit Warning | Browser | 1. Navigate to settings with credits < 50 2. Check header credit pills | Credit pills show amber/red border + "Düşük" text indication |
| 1c. Pricing Link | Browser | 1. Open AI Studio with no tool selected 2. Look at welcome state footer | "Fiyatlandırmayı görüntüle" link visible, links to /abonelik |
| 1d. Plan Context | Browser | 1. Open AI Studio welcome state 2. Check footer | Shows current plan name + remaining credits |

### Work Unit 2: Onboarding & First-Visit
| Task | QA Tool | Steps | Expected |
|------|---------|-------|----------|
| 2a. Enhanced Welcome | Browser | 1. Open AI Studio with no tool selected 2. Read hero text | Clear value prop: "Sketchup → Render → Revize → Analiz" workflow shown |
| 2b. Context Hints | Browser | 1. Select any tool 2. See upload zone | Inline hint: "Bir görsel yükleyerek başlayın → Ayarları yapın → Generate'e basın" |
| 2c. First-Visit Banner | Browser/DevTools | 1. Clear localStorage 2. Reload AI Studio | Subtle welcome banner appears. On reload, banner does NOT reappear |
| 2d. Tool Guidance | Browser | 1. Select img2img tool 2. See upload zone | Contextual text: "Sketchup ekran görüntünüzü yükleyin" |

### Work Unit 3: Trust Signals
| Task | QA Tool | Steps | Expected |
|------|---------|-------|----------|
| 3a. Inline Retry | Unit test + Browser | 1. Trigger job failure (mock API) 2. Check JobStatusPanel | "Tekrar Dene" button visible in failed state panel |
| 3b. Completion Anim | Browser | 1. Generate image 2. Watch completion transition | Result appears with subtle scale-in animation (not abrupt) |
| 3c. Upload Progress | Browser | 1. Select large image file 2. Drop onto upload zone | Brief "İşleniyor..." indicator during file processing |
| 3d. Credit After Gen | Browser | 1. Generate image 2. Check result header | "Kalan: X kredi" badge shows updated balance |

### Work Unit 4: Premium Polish
| Task | QA Tool | Steps | Expected |
|------|---------|-------|----------|
| 4a. Upgrade Wording | Browser | 1. Free plan user 2. Select paid tool 3. Check generate area | Upgrade CTA uses value-first language, not just "Plan Yükselt" |
| 4b. Button Prominence | Browser | 1. Upload image + configure tool 2. Check generate button | Button has subtle glow/shadow, visually prominent |
| 4c. Microcopy Audit | Code review | 1. Check messages/tr.json aiStudio section 2. Check messages/en.json | All Turkish keys reviewed, consistent premium tone |

### Work Unit 5: Conversion Readiness
| Task | QA Tool | Steps | Expected |
|------|---------|-------|----------|
| 5a. Dashboard Card | Browser | 1. Open dashboard 2. Check AI Studio quick action | Enhanced subtitle explaining value proposition |
| 5b. Pricing Link | Browser | 1. Open AI Studio 2. Check settings panel or tool rail | "Fiyatlandırmayı görüntüle" link visible |
| 5c. Signature Tool Suggestion | Browser | 1. Free plan user 2. Select sceneedit tool 3. Check settings panel | Subtle upgrade suggestion in settings panel |

### System-Wide QA (MUST PASS)
| Check | Command/Tool | Expected |
|-------|-------------|----------|
| Build | `npm run build` | Exit code 0 |
| Lint | `npm run lint` | Exit code 0 |
| LSP Diagnostics | `lsp_diagnostics` on changed files | Zero errors |
| Unit Tests | `npm run test -- src/app/(dashboard)/ai-studio/` | All pass |

---

## EXECUTION ORDER

```
Phase 1 (Parallel — independent)
├── Work Unit 1: Credit/Pricing Visibility
├── Work Unit 2: Onboarding & First-Visit
├── Work Unit 3: Trust Signals
├── Work Unit 4: Premium Polish
└── Work Unit 5: Conversion Readiness

Phase 2 (Integration & Verify)
├── LSP diagnostics on all changed files
├── Build verification
└── Final validation checks
```

## VALIDATION CHECKLIST

After implementation:
- [ ] NEW USER TEST: First-time user understands product in <5 min
- [ ] MONETIZATION TEST: User sees credit balance, cost, upgrade path
- [ ] PRICE CONSISTENCY: Frontend tool costs match (check constants.ts)
- [ ] NO REGRESSION: All existing flows still work
- [ ] BUILD PASSES: `npm run build` exits 0
- [ ] LINT PASSES: `npm run lint` exits 0
