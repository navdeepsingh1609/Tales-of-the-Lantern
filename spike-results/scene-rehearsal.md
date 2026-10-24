# Scene-native rehearsal — 2026-10-24

The human approved the shared lighthouse scene references. Local generation completed one Avatar-only motion check with cached audio, then six TTS + six Avatar calls for the reviewed six-turn scene. All six returned real Avatar clips. No retries or Groq call were made. Audio WAV duration totals 31.48 seconds; billed duration and actual debits were not independently retrieved.

Media is stored in ignored `.cache/performance/` and the validated `latest-scene.json` snapshot restores the final scene on reload. Replay makes no generation request. Do not remove the cache before the demo.

Chrome showed the new room-reference Odile video with a seated body, letter and complete room background. The face animates and tends to turn toward the viewer. This is a qualitative spot check, not a guarantee of fixed eyelines or stable hands across arbitrary inputs. No static silhouette is applied. The provider's baked disclosure remains visible.

The restored app played the new opening line (“You crossed that sea…”). The six-turn playback returned to Ready. Cut on cached playback was observed retaining the current frame and exposing Retake. The earlier human microphone check confirmed speech interruption. No additional Realtime session was started for this visual pass.

Limits: master scene is a labeled illustration; speaking shots are video. Full-body choreography, automated reaction footage, and precise gaze control remain unimplemented. All six generated media entries exist locally, but subjective voice/performance quality still benefits from a human rehearsal.

## Landscape chapters and visual pass

A single Avatar-only clarity probe was followed by six cached-audio lighthouse refreshes, then four TTS + four Avatar calls for each new chapter (tavern, observatory), serially without retries. Final scoped snapshots are `latest-scene-lighthouse.json`, `latest-scene-tavern.json` and `latest-scene-observatory.json`. All 14 audio/video pairs exist. WAV durations total 31.48s, 27.84s and 26.96s respectively (86.28s combined); these are not billing measurements.

Native Chrome inspection showed the landscape tavern speaking shot filling the default player without side bars, with a visible matching reflection. The tavern’s four-line playback returned to Ready. Observatory selection restored its own four saved lines, played its own opening text, and Cut held the frame at 0:03/0:06 and showed Retake. This pass used saved media and did not open another microphone session. The model still tends to face the viewer; this is edited conversation coverage rather than continuous full-body staging.

Final offline verification for the chapter expansion: 63 tests across 15 files passed. Type checking, ESLint, production build, Prettier and secret scan passed. The scan covered 181 Git-eligible files plus browser build output. `.env` and the media/budget cache remain ignored. Tests cover per-chapter snapshot isolation, audio reuse across new references, landscape output dimensions, stale fetch/playback cleanup, Cut/Retake replay and reflection callback cleanup. These checks do not establish subjective quality for every generated frame or mobile-browser playback quality.

## Judge-focused direction pass

The official hackathon page was fetched and compared again: tracks, weights and submission items match the stored brief. The primary track is Put a Face to the Voice. The studio now restores forest green and warm text and uses a blurred ambient surround instead of a mirrored strip.

A single real directed-retake job (`bd60bcdc-4d44-4773-947d-368ba78a56d8`) returned ready with one Avatar clip. It used one TTS plus one Avatar request; no retries. Re-selecting the exact line/tags in the browser reused the cache, leaving the performance ledger at CA$19.90 reserved. The original six-line snapshot was checked unchanged. Four curated sample file hashes passed verification; audio durations are 4.92s original and 3.76s directed.

Native Chrome showed Cut revealing the delivery choices, completion revealing Play original / Play new take, the directed clip playing with six scene lines retained, and the original clip remaining playable. Final automated checks: 68 tests in 16 files passed; type checking, lint, production build, formatting and secret scan passed (189 Git-eligible files plus browser build). No additional agent-created microphone session or Groq request was used in this pass. This is not a ten-run rehearsal or a subjective quality approval for all generated frames.

## Two-role interaction pass

Direct now permits editing the held spoken line as well as changing delivery. Join the story uses the existing Higgs Realtime/STT path for input and a complete text response, then one real TTS/Avatar reply, with a typed alternative that never requests microphone access. All three chapters have a matching group listening illustration facing the viewer; these are labeled stills, not animated head turns. The microphone visualization follows measured PCM RMS with reduced-motion support.

A real typed lighthouse turn proposed taking a spare lantern to the harbour. The app generated and played Rocco’s response about the fierce wind, keeping the user safe and managing the light. The baseline still reported six saved lines. The initial spoken attempt observed in the user’s tab failed strict reply-format validation; parsing was broadened to accept bounded plain dialogue, and tests now cover strict/fenced JSON and malformed output. The typed reply addressed the user as “Rocco,” so character-identity instructions were strengthened afterward. This prompt change is tested on the outgoing protocol; a new human spoken quality check is pending. Do not call the wording issue empirically eliminated.

Automated verification after integration: **96 tests across 19 files passed**, including STT/model arrival order, session reuse with prior-turn context, cancel/chapter stale-result rejection, no audio permission in typed mode, no pre-ack PCM backlog, VAD mute without erasing pending speech, editable-line generation, one-line replay and video failure preserving the authored chapter. Type checking, ESLint, web/server production builds, formatting and secret scan passed (201 Git-eligible files plus browser build). No ten-run spoken rehearsal is claimed.

The visible cast reservation ledger was CA$20.60 and Realtime ledger CA$3.50 at the end of the automated pass, including runtime attempts. These are local conservative reservations, not provider spend. The CA$30 project ceiling remains unchanged.

## Film-first page and handoff pass

Removed Inspector, separate mode cards and the large participation sidebar. The same compact toolbar exposes icon playback/reset, Direct, the PCM-reactive Join in ember, typed reply, interruption listening and scene settings. Write a scene opens from the compact chapter/navigation row. The enlarged masthead includes an original SVG/CSS lantern with hover glow, pointer perspective and keyboard toggle; it does not create a WebGL renderer.

Cached playback was observed with the larger film viewport and shared toolbar. The outgoing video frame is now sampled at at most 10fps, held until the next video has data, and dissolved over 220ms. Tests check callback cleanup, held still selection, chapter/reset clearing, reduced motion and the absence of duplicate media elements. Direct can hold an existing line without fetching or playing it. No new provider generation was needed for this layout pass.

The remaining idle facial/body question is an asset/model capability issue: current idle changes are gentle camera drift over labeled illustrations. No actual blink, nod or breathing clip has been generated or claimed. See the documented options and limitations in `docs/CINEMATIC-PERFORMANCE.md`.

## Three-turn continuation and reaction pass

A real typed Chrome contribution proposed carrying a lantern to the harbour while Pim counted flashes. One story connection generated three cast responses and three new TTS/Avatar pairs, serially without retries. New WAV durations are 11.04s, 10.80s and 5.56s (27.40s total); these are media durations, not billing measurements. Rocco's opening response used the proposed plan. A decoded local frame identifies Pim in the second clip. Odile's final displayed response said the boat was turning toward the harbour and asked whether to open the letter now or wait. The UI returned to Continue story; no automatic fourth clip appeared. Saved chapter snapshots still contain 6/4/4 lines. This validates one typed beat, not a spoken endurance rehearsal or subjective quality of every generated frame.

Chrome showed the six-stop mood slider and changing Resolve to Relief updated its value and caption without generation. The brass SVG lantern toggled from Light to Dim. Compact Lighthouse/Tavern/Observatory tabs sit above a single story title. Browser accessibility snapshots sometimes lagged behind actual playback; switching tabs refreshed the final state.

Nine scene-specific individual idle videos are now integrated, superseding the earlier no-reaction-assets statement. See `docs/IDLE-REACTIONS.md` for verified movement and limitations. The group probe was too static for product use. A focused browser review of preparation cutaways and loop seams is still pending; this pass does not claim controlled nods or body gestures. Background tabs now pause idle video decoding and resume safely, with lifecycle regression coverage.
