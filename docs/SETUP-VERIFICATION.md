# Local setup verification — 2026-10-24

## Passed

- Initialized Git with branch `main`.
- `.env` exists with permissions `0600`; contents were not displayed.
- `git check-ignore` excludes `.env`, `.env.local`, `.env.production`, nested app `.env`, dependency/build paths and `.DS_Store`.
- An empty `.env.example` was initially tracked; it was later removed before submission. All environment files, including examples, are now ignored.
- TypeScript verifier syntax checked using Node's TypeScript stripping API in an isolated tool runtime.
- Eleven isolated verifier cases passed: missing key, placeholder, whitespace, offline/no request, authentication refusal, quota refusal, transient rate limit, untrusted error redaction, network exception redaction, invalid audio and valid WAV response.
- Test transport used synthetic fixtures, not Boson. No claim of working API access or generated audio is made.
- Human installed Node and pnpm; agent confirmed `node --version` = `v26.12.1` and `pnpm --version` = `12.15.0` in the project shell.
- Human ran `pnpm verify:env --offline` successfully, followed by a real `pnpm verify:env` call: **HTTP 200**, **30,764 WAV bytes**, **763 ms** total request/response time. This is a user-reported single sample, not a streaming or interruption latency measurement. Audio was not saved.

## Pending

- Workspace monthly cap and warning: human has now confirmed both are set. Latest total project budget is CA$30 maximum, preserving most for the final demo; see `BUDGET.md`. Remaining credit balance is not measured.
- Git author identity for the first commit; no identity will be invented. Human chose to keep the repo local and defer the first commit. No remote configured.
- Exact submission cutoff/time zone. The human confirmed entries are accepted and the deadline is in the morning.

The agent made no authenticated requests during bootstrap. The human subsequently made one successful tiny TTS verification call. Its list-price text estimate was $0.000045; actual billed usage was not retrieved. No repeat paid call is needed to establish setup success.
