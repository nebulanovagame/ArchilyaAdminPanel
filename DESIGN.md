# ArchilyaAdminPanel Design System

## 1. Atmosphere & Identity

Archilya AdminPanel is a quiet, high-contrast operational console for B2B administration. It should feel precise, restrained, and premium: dense enough for audit/admin work, but calm enough to make risky actions readable. The signature is dark luxury tooling — matte black surfaces, warm gold accents, serif emphasis for titles, and compact uppercase labels.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--color-background` | — | `#0f1115` | Page background |
| Surface/secondary | `--color-surface` | — | `#1a1c23` | Panels and secondary surfaces |
| Surface/sidebar | `--color-sidebar` | — | `#0a0c0f` | Admin navigation shell |
| Surface/header | `--color-header` | — | `#0a0c0f` | Header shell |
| Surface/card | `.glass-card` background | — | `#0d0f13` | Elevated data cards |
| Accent/primary | `--color-primary` | — | `#c6a87c` | Primary actions, active filters, highlights |
| Text/primary | `--color-text-main` | — | `#e2e2e2` | Headlines and body text |
| Text/muted | `--color-text-muted` | — | `#8f9299` | Secondary labels and hints |
| Border/subtle | `--color-border-subtle` | — | `rgba(255, 255, 255, 0.05)` | Hairline dividers and card outlines |
| Status/success | Tailwind semantic | — | `emerald-400` | Completed/healthy states |
| Status/warning | Tailwind semantic | — | `amber-400` | Credit/caution states |
| Status/error | Tailwind semantic | — | `red-400` | Failed/destructive states |
| Status/info | Tailwind semantic | — | `blue-400` | Informational states |

### Rules

- Primary gold is functional, not decorative: use it for CTAs, selected filters, links, and key status emphasis.
- Default surfaces stay near-black; depth comes from subtle tonal changes, low-opacity borders, and restrained shadows.
- New raw hex values must be added here first unless they are one-off inherited Tailwind semantic status colors.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Page title | `text-3xl` | 300-600 | Tailwind default | normal | Main admin page headings, usually serif italic |
| Section title | `text-xl` / `text-2xl` | 400-600 | Tailwind default | normal | Panel and section headings |
| Body/sm | `text-sm` | 400 | Tailwind default | normal | Main table/card text |
| Body/xs | `text-xs` | 400-500 | Tailwind default | normal | Metadata and secondary descriptions |
| Badge/overline | `text-[9px]`-`text-[10px]` | 600-700 | compact | uppercase, wide tracking | Labels, badges, filters |

### Font Stack

- Primary: Montserrat via `--font-montserrat`, fallback `sans-serif`.
- Serif: Cormorant Garamond via `--font-cormorant`, fallback `serif`.
- Mono: system monospace through Tailwind `font-mono` for IDs and technical labels.

### Rules

- Use Montserrat for operational content and Cormorant Garamond for premium page-level emphasis.
- Body text should not drop below `text-xs`; sub-10px text is reserved for uppercase metadata/badges only.
- Turkish UI copy is the default; keep labels concise to avoid awkward wrapping in narrow admin layouts.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a base of **4px**.

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--space-1` | 4px | `1` | Tight icon/text offsets |
| `--space-2` | 8px | `2` | Inline groups, filter gaps |
| `--space-3` | 12px | `3` | Compact card internals |
| `--space-4` | 16px | `4` | Standard card padding |
| `--space-6` | 24px | `6` | Page section spacing |
| `--space-8` | 32px | `8` | Larger groups and timeline days |

### Grid

- Admin content should use constrained widths for detail pages (`max-w-3xl`) and wider layouts only where tables demand it.
- Responsive behavior should preserve readable cards first; dense two-column media comparisons may collapse or remain compact only when content stays legible.
- Breakpoints follow Tailwind defaults.

### Rules

- Prefer Tailwind spacing tokens over arbitrary values.
- Arbitrary values are allowed for deliberate micro-typography or precise timeline alignment, but must remain multiples of 1px and be easy to explain.

## 5. Components

### Button

- **Structure**: `Button` primitive renders a native `button` with variants and sizes.
- **Variants**: `primary`, `secondary`, `ghost`, `danger`.
- **Spacing**: sizes map to compact admin controls (`sm`, `md`, `lg`).
- **States**: hover, disabled, and loading are supported.
- **Accessibility**: use real button semantics and visible text labels.
- **Motion**: `transition-all duration-300`; do not animate layout dimensions.

### Badge

- **Structure**: inline uppercase pill with border and semantic color.
- **Variants**: `default`, `success`, `warning`, `danger`, `info`, `neutral`.
- **Spacing**: compact `px-2 py-0.5`.
- **States**: static status marker; no interaction unless wrapped by an interactive control.
- **Accessibility**: badge text must be meaningful without relying only on color.

### Glass Card

- **Structure**: `.glass-card` utility for dark elevated panels.
- **Variants**: one dark card style.
- **Spacing**: inner padding is set by the caller, typically `p-4` or `p-6`.
- **States**: hover styles are added only when the card is interactive.
- **Accessibility**: do not make a card clickable unless it is a semantic link/button.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 100-150ms | ease-out | Filter toggles, icon color changes |
| Standard | 200-300ms | ease-in-out | Button hover, card hover |
| Emphasis | 400-600ms | cubic-bezier-like ease | Rare page-level reveal only |

### Rules

- Animate color, opacity, and transform; avoid layout-property animation.
- Interactive controls need hover and disabled/focus behavior.
- Keep admin interactions restrained; clarity beats flourish.

## 7. Depth & Surface

### Strategy

Depth strategy is **mixed but restrained**: tonal shifts are primary, subtle borders are secondary, and shadows are reserved for `.glass-card` elevation.

| Level | Value | Usage |
|-------|-------|-------|
| Subtle border | `1px solid rgba(255,255,255,0.05)` | Cards, dividers, image wells |
| Card shadow | `0 8px 32px rgba(0,0,0,0.4)` | `.glass-card` only |
| Tonal background | `#0a0c0f` → `#0d0f13` → `#1a1c23` | Shell, card, raised surface hierarchy |

### Rules

- Do not stack heavy shadows; one elevation cue is enough.
- Image preview wells use black/near-black backgrounds so transparent and varied-ratio assets remain inspectable.
