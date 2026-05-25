# AI Studio guidance

## Local shape

- This route has its own `components/`, `hooks/`, `constants.ts`, `types.ts`, and `utils.ts` under `src/app/(dashboard)/ai-studio/`.
- Tool definitions and credit costs are centralized in `constants.ts`; update that source before branching logic elsewhere.
- The main state hook is large and high-coupling. Prefer extracting small pure helpers over adding more inline branching.

## Jobs and services

- Client-side image/PDF preparation and callable queuing live in `src/services/nano-banana-service.ts`.
- Job documents live in Supabase `ai_studio_jobs` table; use `src/hooks/use-ai-studio-job.ts` which wraps `useRealtimeDoc` for realtime observation.
- Keep callable-name behavior in `nano-banana-service.ts` aligned with WebBackend endpoints.

## UI/i18n

- Keep user-facing strings in next-intl messages where surrounding UI already uses translations.
- When adding a new tool, update constants, types, service request mapping, i18n labels, credit display, and tests together.
