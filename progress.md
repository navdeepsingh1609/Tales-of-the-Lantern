# CUT! — Project progress

Last updated: 2026-10-24 (America/Toronto).

This is the current project status and handoff log. Update it after each meaningful implementation or verification milestone. Mark work complete only when the stated evidence exists; keep browser checks separate from automated checks. Never include credentials or raw provider responses here.

## Current milestone

Polishing the cinematic storytelling experience and verifying the complete interaction before the demo. The latest UI and three-turn story flow are implemented. A real typed contribution has now completed a three-turn beat in Chrome and returned to Continue story. Final spoken rehearsal and a focused visual check of reaction cutaways remain open.

## Completed

| Area                   | Current result                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local setup            | Git repository initialized; Node/pnpm project configured; all environment files ignored; credential names are documented in README.md. Repository initialized, committed and connected to GitHub.                                                                                                      |
| Provider access        | Real Boson TTS and Avatar access verified. Realtime input and text response paths integrated. Native Realtime function tools remain gated after unsuccessful feasibility checks.                                                                                                                       |
| Saved chapters         | Lighthouse, tavern and observatory stories with 14 cached speaking performances. Selecting and replaying saved chapters does not generate new media.                                                                                                                                                   |
| Cinematic presentation | Scene-matched landscape speaking shots, shared room references, forest-green styling, ambient video glow and a larger player. Outgoing frames dissolve into the next speaking shot.                                                                                                                    |
| Shared controls        | Direct and Join in share the player toolbar. Compact location navigation, upfront Write a scene, settings disclosure and no Inspector. Chapter title appears separately from location tabs.                                                                                                            |
| Director               | Edit a held line, choose a mood on a six-stop emoji slider, prepare a take, and compare original/new recordings without replacing the saved chapter.                                                                                                                                                   |
| Participation          | Spoken or typed contributions enter story context. Microphone animation follows actual input level; a group illustration faces the participant while listening.                                                                                                                                        |
| Story continuation     | Three distinct cast turns follow a contribution, advancing after each playback finishes. Explicit Continue starts another beat. Stop, mode changes and chapter changes cancel pending continuation. Automated coverage and a real typed three-turn Chrome check passed; spoken rehearsal remains open. |
| Interruption           | Human previously confirmed that speaking over playback freezes it and exposes Retake. Session cleanup and cancellation are covered by tests.                                                                                                                                                           |
| Character reactions    | Nine muted, scene-specific Avatar idle clips integrated, with a loop dissolve, background-tab pause, cleanup and reduced-motion fallback. Scene settings offers direct actor previews and a Character motion toggle initialized from system preferences. One group probe was rejected as too static.   |
| Visual details         | Original brass hurricane-lantern SVG with pointer movement, hover glow and keyboard interaction; quill Write a scene icon; first-name cast labels.                                                                                                                                                     |
| Story structure        | Each chapter supplies an objective, stakes and a player role; recent dialogue informs replies. A small Your part disclosure explains the situation.                                                                                                                                                    |
| Documentation          | Setup, demo script, submission draft, story direction, asset provenance and capability limits documented. Submission details still need final public links/team information.                                                                                                                           |

## Verification and evidence

- Latest full automated run on 2026-10-24: **148 tests across 26 files passed**, including review disclosures, delivery metadata, typed starters and the earlier latency/cancellation checks.
- Latest ESLint and full workspace/script TypeScript checks passed on 2026-10-24.
- Full workspace production build and formatting checks passed. Secret scan passed across 224 Git-eligible files and browser build output. These checks made no provider calls.
- Chrome verification: one typed lantern/harbour plan produced three new speech/video pairs (27.40 seconds of WAV audio). Rocco’s first response used the plan; the third, Odile, advanced it and offered a choice. An extracted frame confirms Pim in the second clip. The UI returned to Continue story, with no automatic fourth generation. Baseline snapshots remain 6/4/4 lines.
- The mood slider changed from Resolve to Relief in Chrome, and the lantern toggled from Light to Dim. Location tabs and a single chapter title were visible. Browser accessibility snapshots sometimes lagged; switching tabs refreshed them. Reaction cutaway playback still needs focused visual verification: subsequent browser captures returned blank frames, preventing an honest visual sign-off. Direct actor previews and the motion setting have automated coverage.
- Earlier browser checks verified landscape playback, Cut/Retake, a directed-take comparison and the enlarged player; the human previously verified microphone interruption.
- Idle asset audit checked all nine public MP4 hashes and byte counts against the manifest. All ten probe inputs were exactly three seconds of silent mono PCM audio; all ten generation requests returned HTTP 200. No TTS or retry was used for these probes.
- Decoded frame review found subtle head/gaze motion in Odile and a blink in Pim. This does **not** verify controlled nodding, body gestures or reliable blinking in every clip.
- Detailed evidence: [scene rehearsals](spike-results/scene-rehearsal.md), [idle reactions](docs/IDLE-REACTIONS.md), [idle manifest](content/idle/manifest.json), [story direction](docs/STORY-DIRECTION.md).

## Next steps

- [x] Complete one real typed browser contribution → three cast turns → return-of-control check, with no automatic fourth generation.
- [ ] Visually verify reaction cutaways during preparation, including their loop transition.
- [x] Check the mood selection, lantern toggle, location navigation and typed contribution in Chrome.
- [ ] Rehearse a fresh spoken contribution through all three cast turns.
- [x] Finish current test/build/secret-scan run and record the outcome here.
- [x] Reconcile the README and cinematic/rehearsal notes with the latest behavior; preserve older evidence as historical observations.
- [ ] Rehearse the complete demo, including interruption, directed comparison and a story contribution.
- [ ] Fill submission placeholders and confirm required public repository/video links before submission.

## Known limits

- The wide group listening shot is a labeled illustration; characters do not physically turn toward the participant in continuous 3D space.
- Speaking shots and idle reactions are generated videos, with no rigged full-body choreography or precise gaze/gesture controls.
- Idle motion is subtle and varies by clip. Reduced-motion users receive still artwork.
- Recent conversational context is retained; persistent quest flags, branching endings and scene-version export are future work.
- Voice-note transcription does not automatically rewrite a line. Native Realtime function execution is not presented as working.
- No full mobile-browser quality review or repeated spoken endurance rehearsal has been completed.

## Spending and credentials

Provider workspace spend controls are the active spending boundary. The user explicitly removed local spending and session-count quotas; do not reinstate them. Keep development checks offline and reuse saved media. Make new provider calls only for purposeful generation or a specific remaining validation, without automatic retries.

Never commit `.env`, credentials or private cache output. Historical reservation ledgers are not actual Boson charges. The user's latest reported usage was approximately 0.13 of the 50 budget, with explicit authorization to use more for worthwhile quality improvements. This is user-reported information, not a live account reading.

## Milestone log

| Date       | Milestone                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-24 | Local provider setup and initial feasibility checks completed; microphone interruption confirmed by the user.                                |
| 2026-10-24 | Scene-native landscape chapters and directed-take comparison verified.                                                                       |
| 2026-10-24 | Director and participant interactions consolidated into the cinematic player.                                                                |
| 2026-10-24 | Mood slider, brass lantern, three-turn continuation and nine idle clips implemented; documentation refreshed.                                |
| 2026-10-24 | Added this living progress file; final browser flow and demo rehearsal remain open.                                                          |
| 2026-10-24 | Real typed three-character beat completed; mood selection and lantern toggle checked in Chrome. Idle decoding now pauses in background tabs. |

## Latency and viewport fit — implemented, visual benchmark pending

- Background story preparation is now separate from visible playback: one next response is generated and its video preloaded while the current actor speaks. Playback still waits for the current line to end.
- Queue invalidation covers new human input, Cut, Reset, chapter changes and entering Direct. A directed rewrite also clears superseded conversation context.
- Speculative dialogue is not added to heard history before it starts playing. The exchange remains bounded to three cast turns; this does not create an unbounded generation loop.
- Desktop player sizing now reserves viewport space for the header, story heading and toolbar. The toolbar stays near the bottom of the viewport and wraps when its container is narrow. Mobile retains its natural layout.
- Regression checks passed: 134 tests across 23 files. Lint, full workspace/script typechecks, web production build, formatting and secret scan passed (224 Git-eligible files plus browser build). Browser control continued returning stale state, blank captures and fields without frames; no new agent-created paid latency probe was submitted. Real latency reduction and viewport fit remain pending visual sign-off for this change.

Directing an improvised reply now edits that actual reply and supports original/new comparison without changing the saved chapter. The next contribution receives the revised line in context, with superseded conversation history cleared. A reset while foreground preparation is waiting for an old speculative job to cancel prevents that foreground request from starting.

## Hackathon review pass — 2026-10-24

- Added three contextual conversation starters per chapter inside the existing typed-reply popover. These use explicit user activation and preserve cancellation behavior; no microphone is requested.
- Added readable delivery labels with on-demand exact Higgs tags. Server output now preserves tag metadata. Verified all 14 older chapter recordings by their audio request hashes without regeneration; unmatched metadata is omitted.
- Added a footer How CUT! works native dialog describing the actual Realtime → story scheduler → TTS → Avatar → cached playback pipeline, the director path and current limitations.
- Preserved the shared Direct/Join toolbar, with clearer hover descriptions. Fixed-latency badges and unvalidated multilingual controls were not introduced. See [review decisions](docs/REVIEW-DECISIONS.md).
- Full typechecks, lint, production builds, formatting and secret scan passed. Latest full run: 148 tests across 26 files passed, including the chapter-starter integration check. Final secret scan covered 233 Git-eligible files plus browser build output.
- Chrome showed the architecture dialog opening and closing, all three lighthouse starter suggestions, and a verified Reflective delivery label on Odile’s held recording. No starter was submitted during this browser check. Full mobile visual review and raw-tag popover expansion remain open. No new paid provider calls were made for this pass.

## Public repository preparation — 2026-10-24

- Replaced the long README with concise setup, Mermaid architecture/workflow diagrams, links to samples and implementation notes, and a marked video-demo placeholder. The user will add a public Google Drive link later.
- Extended ignored credential paths and local tool directories; retained runtime artwork, fonts, sanitized feasibility evidence and curated sample performances.
- Added optional GROQ_API_KEY to the empty environment template. No credential values were read or copied.
- Strengthened publication checks for Groq, AWS, Google and Slack token formats, credential file extensions, and nonempty secret variables in environment examples. Five isolated scanner fixtures and 15 ignore/allow checks passed. The private environment file remains mode 0600.
- Application code, runtime configuration and product behavior were not changed in this pass. Git remains unstaged, with no commit or remote configured; the user will run the final identity/commit/remote/push commands.
- README/demo placeholder and .gitignore are ready for review. Final lint, formatting and secret scan passed; the demo URL and Git author identity remain user-supplied items.

## Public demo link — 2026-10-24

Added the user-provided Google Drive walkthrough link to README.md and docs/DEMO.md. No application code changed. Video access permissions were not changed or independently verified.

## Environment-file removal — 2026-10-24

Removed the tracked empty environment example at the user’s request and now ignore all environment files, including examples. The real private .env was never tracked and remains local. Updated setup instructions to create a private file directly. No application functionality changed; this update will be committed locally for the user to push.
