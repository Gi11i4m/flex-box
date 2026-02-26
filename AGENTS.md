# Agent Notes

- Do not read environment variables directly with `Deno.env` outside `src/shared/env.ts`.
- Use `env(...)` for required env values.
- Use `envOptional(...)` for optional env values.
