# Baseline verification — 2026-10-24

## Implemented

- pnpm workspace with `@cut/web`, `@cut/server` and `@cut/shared`, plus a generated lockfile.
- Static React startup screen, responsive theatre styling and error boundary. R3F/Three dependencies are installed; the performance scene is not implemented.
- Fastify health endpoint with generation disabled and redacted logging. Dev processes bind to loopback.
- Zod scene validation against the actual eight-line lighthouse fixture, documented-only tags and malformed-token rejection.
- Strict TypeScript, ESLint, Prettier, Vitest, GitHub Actions checks and a secret-pattern scanner covering Git-eligible files and browser builds.
- Budget policy: CA$30 maximum, at least CA$25 reserved for the demo, at most CA$5 for essential development. Paid calls disabled in the policy; no generation routes exist.

## Verified locally

- `pnpm install --frozen-lockfile` succeeds, including the explicitly permitted esbuild build step.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
- Both the direct server and Vite-proxied `/api/health` return HTTP 200 with `{ "status": "ok", "service": "cut-server", "generationEnabled": false }`.
- The web root returns HTTP 200. This is a serving check, not proof of browser rendering.
- `pnpm check:secrets` passes the common-format scan, including browser build outputs; `.env` remains ignored. This scanner cannot prove absence of every possible secret format.
- `pnpm spike` reports NOT RUN without making requests. It is not a completed probe suite.

## Verification limits and next gate

- Browser screenshot/layout QA could not run: the computer-use tool lists no connected browsers. Open the local URL manually after `pnpm dev` to review the startup screen.
- The only live Boson evidence is the user's earlier successful key check. **No paid API calls were made in this phase.**
- CI is configured but has not run remotely. Checks passed on the local Node 26 environment; the workflow targets Node 22.
- Repo remains local with no commits, per the user's choice to defer author identity.
- Workspace spend-cap/warning setup, minimal paid feasibility probes, reference art and the post-spike approval remain pending. All Boson performance capabilities remain unverified.
