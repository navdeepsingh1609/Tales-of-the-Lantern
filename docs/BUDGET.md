# API spending controls

## Current policy — provider controls only

The human explicitly requested removal of local spending limits because the Boson workspace cap is already configured. This supersedes the historical reservation policies below.

Application voice/avatar generation no longer reads or writes local reservation ledgers, applies a lifetime spend cap, or counts generated lines per hour. Realtime credentials have no local session-count quota or reconnect cooldown. Old ignored ledgers remain historical files and cannot block the app. Actual quota and rate-limit refusals from Boson are still reported accurately.

Generation still requires an explicit app action and enabled provider configuration. Local-origin checks, one active preparation, bounded text/media, request timeouts and two-minute microphone-session cleanup remain. These are request/lifecycle safeguards, not spending budgets. Ordinary tests and builds call no providers; saved replay generates no media.

The numeric settings retained for the disabled, one-time feasibility scripts are historical probe settings, not runtime application limits. Do not run those scripts again as health checks.

## Historical policies (superseded for application runtime)

Latest human instruction, 2026-10-24: total project budget **CA$30 maximum**. Preserve the majority for the final demo and make calls only when strictly required. This supersedes the earlier CA$100 ceiling.

## Rules

- CA$30 is the total project ceiling, not an allowance to spend automatically. Reserve at least CA$25 for the final demo; development/essential feasibility may use at most CA$5, preferably much less. These are allocations within the total, not extra budgets.
- `config/budget.json` records this policy with paid calls disabled. A standalone, offline-tested CAD-cent reservation guard now exists in `apps/server/src/guards/spend.ts`; it is not connected to live routes and resets on process restart. Provider-side limits and durable usage reconciliation remain necessary before paid execution.
- The human confirmed workspace monthly cap and warning are set. Paid execution was enabled for the explicit bounded spike, then disabled again after the Realtime blocker. Startup and ordinary checks remain offline. Check billing currency, leave room for conversion/taxes, and do not assume a USD/CAD rate.
- The successful key check is sufficient. Do not repeat the paid verifier as a health check. Use `pnpm verify:env --offline` for local configuration checks.
- No paid calls on app startup, install, build, CI, unit tests or browser reload. Explicit user actions and explicitly run spike scripts are the only intended generation triggers.
- Before a required paid spike batch, state the uncertainty it resolves, exact request count, input limits and list-price estimate in the source billing currency. Distinguish estimates from confirmed charges.
- Start with the smallest useful request and serial execution. Reuse its real output for downstream tests. Cache real generated performances by their inputs; disclose replay. Do not regenerate unchanged lines.
- Do not automatically rerun completed spikes. Retry only when the failure is transient and the retry answers a necessary question, with a strict attempt limit. Never retry billing refusals.
- Before live app generation, implement server-side input, duration, concurrency and spend-reservation limits. Include in-flight work; do not wait for a response to count a reservation. A local estimator is not a guarantee of provider billing.
- Reconcile estimates against workspace usage between paid batches. Warn before expected spend above the project's existing approximately $5-per-run threshold, keeping currency explicit.
- Stop paid work when the remaining budget cannot cover the next bounded run. Cut optional cloning, extra art variants and concurrency experiments before jeopardizing the core demo budget.
- The user's request permits coding subagents. Use small, bounded tasks with Luna for simple work; avoid redundant reviews. Do not assume coding-tool costs are covered by Boson credits.

## Latest provider usage report

On 2026-10-24 the human reported total Boson usage of **0.04**. The dashboard currency, credits versus cash, and billing window were not specified. This is user-reported provider usage, separate from the conservative CAD reservations below. Do not describe the CA$15 reservation ledger as CA$15 spent or increase the CA$30 ceiling based on this report. No reservation reset is needed for a layout-only change.

## Usage evidence

| Run               | Source                        | Calls | Result                             | Cost evidence                                                                                                                             |
| ----------------- | ----------------------------- | ----- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Initial key check | User-reported verifier output | 1 TTS | HTTP 200; 30,764 WAV bytes; 763 ms | Script estimated 0.000045 dollars at the published text rate; billing currency, actual debit and CAD conversion not independently checked |

The exact remaining budget is unknown until the human checks usage. Free credit and cash outlay should be tracked separately; free credit does not justify unnecessary calls.

Live feasibility now produced one TTS clip and one Avatar clip, plus three short Realtime diagnostics. Actual billing remains unreconciled. A conservative CA$5 development reservation is held in ignored local state; the demo reserve remains CA$25. See `SPIKE-REPORT.md` for the exact request counts and outcomes. Further Realtime diagnostics are stopped after the unresolved P0 result.

Source for workspace controls: https://docs.boson.ai/account-billing/usage-and-limits.md

## Current application scope

The human approved cast playback and microphone interruption after the spike, with native voice tools gated. `castPreparationEnabled` and `microphoneEnabled` are separate from the disabled one-time probe flag. Explicit preparation now uses a durable ignored performance ledger (CA$20 reservation allocation; 24 uncached lines per hour); microphone credentials use a separate durable ledger (five CA$1 reservations), together with the prior CA$5 spike reservation. Reservations are conservative guards, not confirmed charges. Failed requests retain their reservations. Neither app startup nor replay creates generation calls.

Custom reviewed scripts share the same cast ledger and limits. Script drafting uses the optional Groq provider, at most one active request and six requests per hour per server process; its billing is separate from Boson. No additional provider calls were made by the agent for the cinematic redesign; the human performed a microphone check. Confirm actual usage in the provider workspace before expanding paid batches. Current runtime implementation supersedes older statements above that generation routes do not exist.

After the human approved the shared-room references, one Avatar-only motion check reused an existing WAV, then the final six-turn scene used six TTS and six Avatar requests, serially with no retries. Seven new CA$1 conservative reservations were added. The persistent performance ledger now holds CA$15 across all cast attempts; the development spike and microphone allocations remain separate within the overall ceiling. These amounts are reservation limits, not actual debits. The final 31.48-second scene is cached and should be replayed rather than regenerated. No Groq call was made for this authored draft.

## Three-chapter landscape expansion — 2026-10-24

The authorized expansion made one Avatar-only clarity probe, six Avatar-only lighthouse refreshes with cached audio, and eight new TTS + eight Avatar requests across the tavern and observatory. Calls were serial, without retries. No Groq or Realtime request was added. All 14 chapter clips are saved; testing and replay reuse them.

New reservations are 35 CAD cents for a line requiring TTS and Avatar, or 25 cents for an Avatar refresh with cached audio. These are conservative local estimates for the enforced 300-character/30-second limits, not measured charges. Historic reservations remain unchanged. The durable cast ledger totals **CA$19.55 reserved**, under its unchanged CA$20 allocation. The hourly line limit was expanded from eight to 24 to accommodate the explicit chapter batch; concurrency remains one. The overall CA$30 ceiling, separate microphone allocation, and provider controls remain unchanged. Only CA$0.45 remains in the cast reservation allocation; prefer replay. Actual billing must be checked in Boson Usage, whose reported 0.04 was not currency-qualified.

Latest human report for the judge-focused pass: **0.08 / 50 Boson credits used**, with permission to iterate more freely. This is the latest credit report, not a verified CAD debit. The CA$30 project ceiling and existing durable ledger remain intact. A single bounded directed-retake validation is planned (one TTS plus one Avatar request, no retries; 35 CAD-cent reservation). It reuses the current room reference and preserves the baseline scene.

The one directed-retake validation completed successfully (one TTS + one Avatar request; no retry). The cast ledger now reserves **CA$19.90**. A CA$1 allocation was moved from unused microphone capacity to cast retakes: cast lifetime cap CA$21, microphone four CA$1 sessions, prior spike allocation CA$5, still totaling CA$30. Existing ledger entries were retained. Two microphone sessions have been reserved locally, leaving two more within the updated limit. These are local guard allocations, not provider debits; actual credit usage is only the human-reported 0.08/50 above. No further live generation was run in this validation.

For interactive story sessions, new Realtime reservations are now **CA$0.25 per two-minute session**, still capped at **CA$4 lifetime** and at most 16 sessions. This is a conservative local estimate, not a measured provider debit. The prior three CA$1 entries were migrated intact to a versioned ledger; none were reset or refunded. Status reads do not write the ledger. The two-minute cooldown and session duration remain unchanged. Cast CA$21 + microphone CA$4 + prior spike CA$5 still equals the CA$30 project ceiling. Successive turns reuse their active Realtime connection; every newly rendered reply still reserves through the existing cast guard.
