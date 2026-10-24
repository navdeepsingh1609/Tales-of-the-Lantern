# Decisions

## 2026-10-24 — first live spike and P0 tool blocker

- Human confirmed provider spend controls. Ran one reusable TTS clip and one Avatar stream with original procedural portrait input, then verified saved fMP4 through Chrome MSE at 480×640.
- Realtime authentication worked, but optional selection returned text, named selection emitted an error, and required selection after config acknowledgment timed out. Preserve all three outcomes; stop diagnostics rather than spend on repeated guesses.
- Plan A is viable for the media shape, with pre-roll and labeled fallbacks still required. Native tool direction is a P0 blocker; do not claim the full architecture has passed.
- Proposed continuation is cast playback and mic interruption with keyboard direction available, while native tools stay gated. Await the human's post-spike go/no-go per AGENT_PROMPT section 4.

## 2026-10-24 — offline visual feasibility and guarded probe preparation

- Human requested an interactive, polished 3D experience and approved procedural stand-ins. Build a clearly labeled visual feasibility harness before paid integration: pleated retracting curtains, a built lighthouse set, real lights/shadows, click-to-frame paper marionettes, storm cues and motion freeze.
- Keep keyboard alternatives and reduced motion. Sample render FPS with wall time; no invented voice/Avatar telemetry. Lazy-load the Three/R3F stage so the UI can appear while the renderer loads.
- Higgs remains the only planned model provider. No Qwen key is required for the existing architecture. Organizer permission is still required before adding a third-party product model.
- `pnpm spike` remains offline; it now prepares a concrete small batch and can save local preflight evidence. Live probes are disabled, not silently skipped as successful.
- Added a process-local CAD-cent reservation guard, with tests for concurrent reservations, protected demo funds, billing overruns, invalid amounts and mutable configuration. It is groundwork, not a deployed spending guarantee.
- Three Luna subagents handled the isolated renderer, offline probe plan and budget guard. The lead integrated controls and reviewed animation correctness, accounting edge cases and diagnostics.

## 2026-10-24 — local baseline before paid feasibility

- User reduced the total ceiling to CA$30 and asked to preserve calls for the final demo. Reserve CA$25 for demo work and at most CA$5 for necessary development probes; prefer spending less. No paid calls in this phase.
- User explicitly requested Luna subagents. Three bounded tasks covered server health, shared validation and web startup; the lead integrated tooling and reviewed all changes.
- Keep the repository local and defer the first commit until author identity is supplied. Do not invent author metadata.
- Use React/Vite/TypeScript/R3F dependencies, Fastify and shared zod schemas, per the existing architecture. R3F is installed but no 3D performance scene has been implemented before feasibility approval.
- The server exposes health only, binds to loopback and does not load credentials. The browser's startup screen is static, with no mic or generation side effects. Vite's default app-local environment directory keeps root `.env` outside its configuration.
- Root scripts provide formatting, lint, typecheck, unit tests, build and secret-pattern checks. CI has no Boson key. `pnpm spike` is explicitly a pending-status reporter until minimal paid probes are prepared.
- pnpm 12 uses `allowBuilds`, not the removed `onlyBuiltDependencies` setting. Allow only esbuild's required install step.
- Keep API feasibility unverified until measured. The user's one successful key check is sufficient for authentication setup and is not repeated.
