# AI Studio guidance

## Local shape

- This route has its own `components/`, `hooks/`, `constants.ts`, `types.ts`, and `utils.ts` under `src/app/(dashboard)/ai-studio/`.
- Tool definitions and credit costs are centralized in `constants.ts`; update that source before branching logic elsewhere.
- The main state hook is large and high-coupling. Prefer extracting small pure helpers over adding more inline branching.

## Jobs and services

- Client-side image/PDF preparation and callable queuing live in `src/services/nano-banana-service.ts`.
- Job documents may be observed in `users/{uid}/aiStudioJobs/{jobId}` using `src/lib/ai-studio/job-contract.ts` helpers.
- Keep fallback callable-name behavior in `nano-banana-service.ts` unless backend deployment has been updated and tests prove the old names are no longer needed.

## UI/i18n

- Keep user-facing strings in next-intl messages where surrounding UI already uses translations.
- When adding a new tool, update constants, types, service request mapping, i18n labels, credit display, and tests together.
