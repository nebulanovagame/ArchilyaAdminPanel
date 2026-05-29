# ArchilyaAdminPanel — Next.js 16 B2B Admin Panel

## OVERVIEW
B2B admin panel for Archilya. Next.js 16.2.6, React 19.2.4, Tailwind v4, Supabase. Migrated from Electron 28 (older AGENTS.md descriptions saying "Electron / Vite 5" are stale).

## STRUCTURE
```
src/
├── app/
│   ├── layout.tsx        # Root layout: Montserrat/Cormorant fonts, globals.css
│   ├── (admin)/          # Admin route group
│   └── (auth)/           # Auth route group
├── components/
└── ...
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Entry (root layout) | `src/app/layout.tsx` | Fonts + metadata + globals.css |
| Next config | `next.config.ts` | Minimal — no CSP, no i18n, no Sentry |
| Lint config | `eslint.config.mjs` | next/core-web-vitals + typescript |
| Tailwind | CSS-based (v4) | Uses `@import "tailwindcss"` in globals.css |
| PostCSS | `postcss.config.mjs` | @tailwindcss/postcss |

## CONVENTIONS
- Same core stack as `ArchilyaWebPanel` (Next.js 16, React 19, Tailwind v4) but stripped down.
- No i18n (Turkish-only), no Sentry, no CSP headers, no rate limiting.
- Auth via Supabase (same project as WebPanel).

## ANTI-PATTERNS
- Do NOT add Sentry without also planning for error monitoring infrastructure.
- Do NOT copy WebPanel's CSP/redirects config directly — AdminPanel has different hosting requirements.
- Do NOT assume `next.config.ts` has Sentry or i18n plugins (check before adding).

## GOTCHAS
- No test framework configured at all (no Vitest, Jest, Playwright).
- No CI pipeline.
- `.gitignore` exists and correctly excludes `.env`, `.env*.local`, `node_modules`, `.next/` (earlier claims to the contrary are stale).
- `eslint.config.mjs` exists and works.
- No package-lock.json for exact dependency tracking.

## COMMANDS
```bash
npm run dev         # Next.js dev server on port 3000
npm run dev:turbo   # Turbo mode dev
npm run build       # Production build
npm run lint        # ESLint (Next.js + TypeScript)
```
