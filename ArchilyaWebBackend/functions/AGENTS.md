# FUNCTIONS BACKEND GUIDE

## OVERVIEW
`functions/` hosts Firebase Cloud Functions runtime for server-side AI operations, entitlements, mail, and storage-related workflows.

## STRUCTURE
```text
functions/
├── index.js        # Main Cloud Functions entry (very large)
└── package.json    # Emulator/deploy/log scripts, Node 20 runtime
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Runtime entry + handlers | `index.js` | Core callable handlers and orchestration |
| Secret declarations | `index.js` | `defineSecret(...)` usage |
| Deploy/emulator commands | `package.json` | `serve`, `deploy`, `logs`, etc. |

## CONVENTIONS
- Keep secrets in Firebase Secret Manager; consume via `defineSecret`.
- Use callable/function wrappers consistently for frontend service compatibility.
- Maintain Node runtime alignment with `package.json` engines.

## ANTI-PATTERNS
- Do not hardcode provider/API keys in source.
- Do not add unrelated features directly into monolithic sections without extraction plan.
- Do not edit `functions/node_modules/`.

## COMMANDS
```bash
npm run serve
npm run shell
npm run deploy
npm run logs
```
