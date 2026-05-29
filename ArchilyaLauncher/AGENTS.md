# ArchilyaLauncher — Electron 40 Game Launcher

## OVERVIEW
Desktop game launcher with Pixel Streaming. Electron 40, React 19, Vite 7, Tailwind v4. Dual entry: Electron main process (`electron/main.ts`) + Vite-rendered React UI.

## STRUCTURE
```
├── electron/                 # Electron main process
│   ├── main.ts               # Entry: BrowserWindow, tray, auto-updater, IPC handlers
│   └── preload.ts            # 40+ IPC channels via contextBridge
├── src/
│   ├── renderer/             # Vite SPA React UI
│   │   ├── main.tsx          # createRoot + <App />
│   │   ├── views/            # Screen views
│   │   └── components/       # UI components
│   └── main/                 # Legacy (dead) — excluded from tsconfig
├── SignallingWebServer/      # Epic Pixel Streaming (has Dockerfile)
├── dist-electron/            # Compiled main process output
├── tsconfig*.json            # 4 separate TS configs (app, node, electron)
├── vite.config.ts            # Vite config: base `./`, outDir `dist`
├── vitest.config.ts          # Vitest: jsdom, globals, @testing-library/jest-dom
└── firebase.json             # Firestore rules only (unused — app uses Firestore REST via IPC)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Electron main | `electron/main.ts` | Window creation, tray, auto-updater, game download/manifests |
| IPC bridge | `electron/preload.ts` | 40+ channels: firestore, auth, r2, storage, dialogs |
| Renderer entry | `src/renderer/main.tsx` | React root |
| Dev workflow | `electron:dev` (npm script) | Builds main + type-checks + launches Vite + Electron concurrently |
| Production build | `electron:build` (npm script) | Fetches cloudflared, copies UE SignallingWebServer, builds + packages with electron-builder |
| Tests | `vitest.config.ts` | jsdom env, @testing-library/jest-dom |
| Lint | `eslint.config.js` | TS + React, max-warnings 0 |

## CONVENTIONS
- **Electron main**: TypeScript with `module: NodeNext`, compiled via `tsconfig.electron.json` to `dist-electron/`.
- **Renderer**: Standard Vite React SPA; `base: "./"` for file:// protocol in production.
- **Preload**: All IPC channels are centralized in `electron/preload.ts` via `contextBridge.exposeInMainWorld('api', ...)`.
- **Build requires** local UE 5.x installation for SignallingWebServer (or `EPIC_GAMES_ROOT`/`UE_VERSION_PREFERRED` env vars).
- **Auto-update**: GitHub publisher configured in `package.json` build block.

## ANTI-PATTERNS
- Do NOT use `src/main/main.ts` — it's dead code excluded from `tsconfig.electron.json`.
- Do NOT add new IPC channels without adding them to `electron/preload.ts` context bridge.
- Do NOT import renderer code in main process or vice versa (they are separate bundles).
- Do NOT add third empty catch blocks — the 3 existing ones in `electron/main.ts` should be fixed, not copied.

## GOTCHAS
- **🔴 CRITICAL**: `.gitignore` only ignores `*.local` — **does NOT ignore `.env`**. The file at `ArchilyaLauncher/.env` contains a live Google OAuth client secret and Firebase API key. It WILL be committed on `git add .`. Add `.env` to `.gitignore` immediately.
- `dist-electron/` is committed to the repo — compiled JS output alongside TypeScript source.
- `npm run electron:build` fails if `fetch:tunnel-tools` or `fetch:signalling` haven't been run or prerequisites are missing.
- NSIS installer config is inline in `package.json`.
- v4 TypeScript configs: `tsconfig.json` (references), `tsconfig.app.json` (renderer), `tsconfig.node.json` (Vite), `tsconfig.electron.json` (main process).

## COMMANDS
```bash
npm run dev              # Vite dev only (renderer)
npm run build:main       # Compile electron main process
npm run electron:dev     # Full dev: build main + check + Vite + Electron
npm run electron:build   # Production: fetch tools + build + package
npm run test             # Vitest unit tests
npm run lint             # ESLint (TS + React, max-warnings 0)
```
