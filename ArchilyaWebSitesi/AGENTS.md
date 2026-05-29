# ArchilyaWebSitesi — Vite SPA Marketing Site

## OVERVIEW
Public marketing site for Archilya. Vite 7 SPA with React 19, Tailwind v3, pure JS/JSX (no TypeScript), Firebase JS SDK. Turkish-first content.

## STRUCTURE
```
src/
├── main.jsx          # React entry → createRoot + App
├── App.jsx           # Router setup (react-router-dom v7)
├── components/       # UI components
├── pages/            # Route pages
└── ...
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Entry point | `index.html` → `src/main.jsx` | createRoot + Sentry ErrorBoundary |
| Routing | `src/App.jsx` | react-router-dom v7 |
| Dev server | `vite.config.js` | Port 5174 |
| Build config | `vite.config.js`, `postcss.config.cjs`, `tailwind.config.js` | Tailwind v3 + autoprefixer |

## CONVENTIONS
- **Pure JS/JSX** — no TypeScript. Do not add `.ts`/`.tsx` files.
- **Tailwind v3** with PostCSS + autoprefixer. Do not use v4 `@import "tailwindcss"` syntax.
- **ESM project** (`"type": "module"` in package.json). `postcss.config.cjs` is intentionally CommonJS.
- Firebase SDK used in browser only (no Firebase Functions, no Admin SDK).

## ANTI-PATTERNS
- Do NOT add TypeScript — the project is intentionally JS-only.
- Do NOT copy Tailwind v4 config patterns from WebPanel or Launcher (they use `@tailwindcss/postcss`).
- Do NOT assume ESLint config exists for TS (it's JS flat config only).

## GOTCHAS
- **🔴 `.gitignore` only covers `.vercel`** — does NOT ignore `.env`, `node_modules`, or `dist/`. If an `.env` file is created, it will be committed. Fix: add `node_modules/`, `dist/`, `.env`, `*.log` to `.gitignore`.
- No test framework configured.
- No CI pipeline.
- No Sentry configuration (unlike WebPanel).

## COMMANDS
```bash
npm run dev       # Vite dev server on port 5174
npm run build     # Vite production build
npm run lint      # ESLint (JS/JSX + React Hooks/Refresh)
npm run preview   # Preview production build
```
