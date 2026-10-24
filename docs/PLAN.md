# CUT! implementation plan

Created 2026-10-24. Work proceeds in order, with verification at each gate.

## Current state — scene-native revision

The human approved the shared lighthouse scene and seated-body references on 2026-10-24. The fixed PNG/video mask was removed. The page now opens on a labeled shared scene illustration, then plays complete native Higgs frames; it no longer renders a 3D room behind cutout faces. Settings and writing start collapsed.

One Avatar-only motion check reused saved audio. Six reviewed dialogue turns were then rendered with TTS and Avatar, serially without retries, cached, and restored after reload. Their saved WAVs total 31.48 seconds. This pass added CA$7 in conservative reservations, not measured charges; the cast ledger totals CA$15. Microphone interruption remains on the shared playback path and was previously confirmed by the human. Native tool execution and automatic spoken-note revisions remain gated/unimplemented.

Validation: 53 offline tests, typecheck, lint, formatting, production build, and secret scan passed. Browser checks showed the native room clip, new dialogue restoration and held-frame Retake behavior. Gaze and coordinated body movement remain model limitations; the group master is a still. See [SCENE-RESEARCH.md](SCENE-RESEARCH.md). Historical sections below retain earlier milestones and superseded states.

Budget: **CA$30 total maximum**, superseding CA$100; reserve at least CA$25 for the final demo, with at most CA$5 for necessary development tests. Follow [BUDGET.md](BUDGET.md). The key check already passed; do not repeat it. Continue local preparation while workspace cap/warning setup is pending.

## 0. Repository and credentials — API access verified; cap confirmation pending

- Initialize a local Git repository on `main`; preserve the supplied specifications.
- Ignore local environment files, credentials, dependency folders, builds, logs, and caches.
- Keep all environment files, including examples, out of version control. Create `.env` with owner-only permissions and enter the key directly in an editor.
- Add a dependency-free TypeScript verifier: local validation, then one documented tiny TTS request, no retries, no raw errors or credential logging.
- Verify ignore rules and scan tracked/staged content before committing.
- Human: install Node/pnpm, enter the key, configure Boson monthly cap/warning, then run the verifier. Entries/deadline-in-the-morning confirmed in chat; exact cutoff/time zone still to record.
- Gate: key validation succeeds, Git excludes secrets, cap/credit and deadline are confirmed. A successful TTS call proves endpoint access, not remaining balance or cap settings.

## 1. Professional baseline — implemented; local checks passed

- Follow `04-ARCHITECTURE.md`: pnpm workspaces, React/Vite/TypeScript/R3F web app, Fastify server, shared zod schemas, spike scripts and evidence folders.
- Add strict TypeScript, lint/format, Vitest, structured redacted logging, and network-free CI.
- Verify install, lint, typecheck, tests and build. Keep the README aligned with commands that actually exist.
- Implemented the static web startup screen, health-only server, scene/tag validation, root tooling and CI. No feature engine or paid probe has run. Browser visual QA is pending because no browser is connected to the automation tool.

## 2. Feasibility spike — approval gate

- Resolve V-00/V-01/V-02 logistics with organizer evidence. The user's request authorizes coding subagents; permission to include third-party AI in the product/assets remains unverified.
- Run V-03, then TTS V-20–25, Avatar V-10–15, Realtime V-30–39, frontend V-40–42. Record all outcomes, including failures and unrun tests.
- Test Avatar with non-streaming nested `input_tts`, or completed TTS audio in a documented supported container. Nested TTS streaming is unsupported; raw streaming PCM is not a documented Avatar file input.
- Test custom client-tool timing rather than assuming it executes during spoken acknowledgements. Test LiveKit Cloud avatar-session capacity separately before considering Plan B.
- Use real outputs; disclose replay. Ask for listening judgments, art and microphone checks when needed. No cloning without consent.
- Tell the human before runs expected to exceed about $5. Start serially and measure cost before parallel paid tests.
- Minimize paid test calls: reuse real outputs across checks, bound each batch, disclose its purpose/count/estimate first, and track estimated versus confirmed charges. Do not run the entire matrix repeatedly or spend on optional features before P0 feasibility is established.
- Deliver `SPIKE-REPORT.md`: evidence, latency measurements, architecture A/B/C/D, art/voice/tag choices and cuts. Stop for the human's go-ahead before feature code, as required by `AGENT_PROMPT.md` section 4.

## 3. Core demo — P0 only

1. Mic → ephemeral Realtime session → interrupt actor playback; measure event-to-silence separately from speech-onset-to-silence.
2. Three actors perform at least six authored lines, with distinct voices/faces, sound effects, abort and pre-roll.
3. Voice notes re-perform the interrupted line; authored language variants switch in place; tools drive the set. Validate arguments and executor ownership.
4. Build the miniature theatre, readable Inspector/captions, keyboard access and reduced motion.
5. Verify every P0 acceptance criterion, cost refusal and labeled service fallbacks. Target: interruption under 300 ms, redo under 3 s, stage at least 45 fps; report measured results only.

Record decisions and a demo check after each step. Independent small tasks may use Luna subagents, with integration and security review by the lead agent.

## 4. Optional features

Only after all P0 demo beats work: consent-gated recasting, word timestamps, rate/cost-capped Judge Mode. Guest Star and Hot Seat remain stretch goals. Cut features that threaten the core demo.

## 5. Rehearsal and submission

- Ten consecutive golden-path rehearsals, with honest evidence and limitations.
- Fresh-clone setup check; sample real inputs/outputs; final setup/build/security checks.
- Public demo video and repository, team details, measured submission write-ups, pinned `submission-v1` SHA/tag.
- Publish or submit only when the user authorizes those external actions.

## Current verification status

- Local specifications read; official hackathon HTML fetched and compared with `00`.
- Official API pages reviewed, including parallel read-only review of Realtime/Avatar references by a Luna subagent.
- Human entered the key privately and reported one successful TTS verification: HTTP 200, 30,764 WAV bytes in 763 ms. No repeat paid request is necessary. Remaining balance and billing settings are not inferred from this result.
- Node `v26.12.1` and pnpm `12.15.0` are now available in the project shell.
- Human confirmed monthly cap/warning. The bounded live spike ran; TTS/Avatar/MSE passed their limited checks, but Realtime native tools remain a P0 blocker. Further paid probes are disabled.
- Offline visual feasibility now includes a procedural 3D stage with curtain, actor, weather and motion controls. Chrome spot checks showed 59–60 fps; actual media integration remains unverified. See `spike-results/visual-rehearsal.md`.
- `pnpm spike --check` writes local-only evidence. Explicit live probes now save real artifacts with one-time invocation markers and a conservative CA$5 batch reservation. No application generation routes are built yet.
- Human chose a local repository; first commit is deferred until an author identity is provided. Do not invent an author identity.

## Current product direction — three chapters

This supersedes the older procedural theatre milestones above. The approved cinematic player now has lighthouse, tavern and observatory chapters, each with its own shared illustration, landscape actor references, reviewed dialogue and separately restored cache. All 14 speaking clips are saved. The room background remains part of each generated video; no still-image separation mask is used. Close-up cover framing removes default pillar bars; Full frame remains an explicit alternative.

The current look uses locally hosted Cinzel headings, restrained gold and ivory, translucent controls and a low-resolution reflection of the same playing video. Reduced motion/transparency and keyboard controls remain supported. The automated suite covers chapter contracts, media-cache isolation, stale requests, chapter switches, Cut/Retake and reflection cleanup. Native Realtime tools, automatic note-driven rewrites and choreographed full-body action remain outside the completed scope.
