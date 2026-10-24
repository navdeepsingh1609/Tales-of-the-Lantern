# Cinematic performance

This document preserves implementation history and evidence alongside the current UI description. The fixed-alpha mask, 3D backdrop, and large speaker credits mentioned in older notes are not part of the current player. It uses complete native video frames, shared-room art and seated references. The master group shot remains a labeled still. See [SCENE-RESEARCH.md](SCENE-RESEARCH.md).

## Current UI

The player has compact location tabs and shows the selected story title separately. Cast labels use first names. The toolbar combines playback, **Direct**, **Join in**, typed reply, interruption listening, and settings. **Write a scene** is an upfront action marked by a quill; the original brass lantern is an interactive SVG. Directing a line offers a six-stop emoji mood slider.

After a spoken or typed human contribution, the cast delivers three turns in sequence, each advancing when its playback finishes. The player then offers **Continue story** explicitly to start another beat. It does not silently begin a fourth cast turn. The app also has nine individual muted idle clips: one per cast member per location. Visual review found subtle head/gaze motion in Odile and a blink in Pim; controlled gestures and reliable blinking across all clips are not verified. Details and limits are in [IDLE-REACTIONS.md](IDLE-REACTIONS.md).

The notes below describe prior implementation states and validation. Treat claims about three delivery presets, one reply per contribution, separate mode cards, local generation limits, and no idle video as historical unless they agree with the current UI description above.

## Playback and interruption

`CinematicStage` mounts the exact video element owned by `useCastPerformance`. It does not create a second player or audio source. The original transparent character reference masks the portrait background. This preserves the generated face but can crop movements outside the reference silhouette. It is composition, not a claim of 3D facial retargeting.

The primary controls are Play scene, Cut, Reset, and Enable interruption. With the microphone listening, Higgs speech-start detection pauses the same media element immediately, retains its current frame, and presents Retake line. Retake starts the interrupted saved line again without generation. Notes appear as transcription; they do not yet automatically change the performance. No invented spoken reaction is shown. Native tool execution remains gated.

The human tested microphone interruption and reported: “It freezes and shows Retake line.” This is a user-observed functional check, not an independently measured speech-onset-to-silence result. The Inspector labels its timing as speech-event-to-pause-call only.

## Historical: script preparation

The former improv path used browser speech on a fixed timer and silently fell back on failures. Those behaviors were removed.

1. Draft dialogue through the configured script provider, with explicit action and bounded requests. No configured key produces an unavailable state, not a mock.
2. Review and edit up to six lines, each at most 220 characters, total at most 1,000 text characters.
3. Prepare performance explicitly. Custom lines enter the same Higgs TTS → Avatar pipeline, actor voice mapping and cache as the authored scene. Emotion names map to supported tags; custom tag lists and rendered input lengths are bounded. Earlier notes about durable local reservation limits describe a prior state; spending is now controlled in the Boson workspace.
4. Play only after preparation. Clips with no avatar video show an explicit audio-only/still-portrait label.

Script requests have one active request, a 15-second provider timeout, no retries/redirects, and a six-per-hour process limit. The process limit resets on restart. Boson generation retains its existing durable ledger and provider controls; it is not an exact billing meter.

## Verification

Chrome showed real saved Higgs facial video in the new composition, including Odile's expressive talking face, and speaker changes across cached clips. The human confirmed microphone freeze/retake behavior. No new Boson generation or script-provider request was made by the agent for this redesign; tests use stubbed responses. New custom generation is validated with offline pipeline/cache tests, not a paid end-to-end run.

In the historical version described by this section, the UI used plain action labels, visible preparation progress, explicit errors, real media duration, and no emoji, simulated voice, or automatic script fallback. Portrait preview and audio-only modes were labeled. Old procedural figure files remain unused references and are not mounted in the current view.

Final local checks: 52 tests passed; typecheck, lint, format check, production build and secret-pattern scan passed. The production build retains the existing advisory about the Three.js bundle size. The script provider's existing model and JSON-object format were checked against [Groq's supported models](https://console.groq.com/docs/models) and [structured output reference](https://console.groq.com/docs/structured-outputs). No provider request was made for that documentation check.

## Close-up framing update

Speaking coverage now defaults to `object-fit: cover` in a 16:9 player, with actor-specific vertical focal points. This removes portrait pillarboxing and enlarges the face while preserving the generated room background. Full frame remains an explicit option for the uncropped composition. The player displays a generated-performance label in close-up mode as the original baked disclosure may fall outside the crop. The stored media is unchanged.

This improves presentation and legibility; it does not add eye detail to a low-resolution source or correct a model-generated pupil. Browser inspection showed the default speaking frame filled without side bars. No new media was generated. Future source-quality improvements should use tighter, near-frontal references and a matching landscape output, tested once before replacing the cached cast.

## Current chapter player

Three chapters now use separate scene IDs and cache snapshots: lighthouse (six lines), tavern (four) and observatory (four). Landscape references request native 640×480 Avatar output. The default cover framing fills the stage; Full frame preserves the original frame at the cost of empty edges on wider screens. Actor still fallbacks and previews now use the selected chapter’s room reference. Selecting a chapter stops old playback and clears held/transcript state; stale requests cannot replace the new chapter’s data.

The ambient surround draws the existing video into a 320×180 canvas at about 12fps. It never creates another video or audio source. Callbacks and listeners are removed on change/unmount, drawing skips hidden documents, and reduced motion/transparency disables the animated surround. Local Cinzel font and its OFL license are in `apps/web/public/fonts`.

The ambient layer is positioned behind the player and extends beyond all four edges. A broad blur and elliptical alpha fade blend it into the green page background without a separate reflection strip. It samples frames in their original orientation. The video’s decorative outline was removed. Reduced transparency hides the surround; reduced motion retains only static chapter artwork.

## Historical: directed line comparison

Earlier versions of Cut opened a three-option delivery selector: quiet tension, resolve, or relief. The current version presents six emoji mood stops. The retained sample and validation evidence below refer to the earlier directed take and remain historical. Preparing a take sends one reviewed line; the original stays available for audition. Partial, error, or cancelled results preserve the prior selection; a chapter switch cancels in-flight work. Auditions stop at the selected line’s end and do not advance the chapter.

The local preparation API accepts `persistSnapshot: false` only for exactly one custom line, keeping experiments out of the baseline chapter snapshot. The client never interprets a spoken note as a tool command: transcripts are shown and the director chooses a preset. This is bounded delivery direction, not semantic dialogue rewriting.

One real lighthouse-opening retake completed with determination plus high expressiveness (one TTS and one Avatar request, no retries). Its WAV lasts 3.76s versus 4.92s for the original. Both output pairs and their hashes are in `samples/directed-retake`. The browser restored the cached comparison, played the directed take and original, and retained six scene lines. Generated emotion remains a model response; the direction does not guarantee a specific facial pose.

## Historical: two roles in the story

**Direct** exposes an editable spoken line alongside the delivery choices. Only that line is generated; the original/new comparison and baseline snapshot protection remain in place.

**Join the story** places the user as a fourth participant. A microphone session captures real PCM levels for the microphone rings, uses Higgs STT and turn detection, and receives bounded text replies from Higgs Realtime. The supplied chapter and recent turns form context. The response is rendered through real TTS and Avatar and played without overwriting the authored chapter. The current experience continues with two additional cast turns after the initial reply, then awaits explicit Continue.

The group looking toward the viewer is a labeled listening illustration. It is shown while connecting, listening, thinking and rendering; the selected character’s real generated video replaces it for the answer. The desktop microphone sits next to the film so the listener shot stays visible. Input is muted during response preparation/playback to avoid actor feedback. End session and mode/chapter changes release capture. Typing uses the same story response path without requesting microphone access.

Realtime is configured for text output and no tools. Plain bounded spoken dialogue is accepted; strict JSON and a single JSON code fence remain supported for compatibility. Empty, overlong, malformed or unsafe markup responses are rejected. No tool execution, invented JSON response mode, or external language model is required. Spoken turns wait for both transcription and a complete model response before media generation. Stale replies are ignored after cancellation/chapter changes.

Sources: [Realtime sessions](https://docs.boson.ai/models/higgs-realtime/guides/connections-and-sessions), [client events](https://docs.boson.ai/api-reference/realtime/client-events), [server events](https://docs.boson.ai/api-reference/realtime/server-events).

## Spending control update

At the human’s request, runtime local reservation, spend, hourly-line and session-count limits were removed. Boson workspace controls govern usage. Bounded requests, one active preparation, origin validation and session/resource cleanup remain. New responses still consume provider credits, while saved playback does not.

## Film-first layout and transitions

An earlier layout centered a larger video with compact chapter navigation. The present toolbar retains playback/reset, Direct, Join in, typed reply, interruption listening, and a settings popover. The writing workspace opens from **Write a scene**. The masthead uses the original brass SVG lantern; the quill icon identifies scene writing.

A bounded offscreen canvas samples the current video at up to 10fps and holds its last frame until the incoming video has decoded data. The held image then dissolves over 220ms. This uses the existing video/audio element, cleans up callbacks, clears stale frames on chapter/reset/still selection, and skips sampling/dissolves for reduced motion. Static scene art has only subtle camera drift; the app does not present that as facial or body animation.

The idle clips are prepared videos; they do not provide controlled gesture timing. Boson’s documented request has no direct gesture/expression/body-action field. The observed head/gaze motion and Pim blink are described above and in [IDLE-REACTIONS.md](IDLE-REACTIONS.md). [Documented Avatar request](https://docs.boson.ai/api-reference/videos/create-a-video), [input behavior](https://docs.boson.ai/models/higgs-avatar/input-options).

## Overlapped story preparation

Story beats now keep one next line in preparation while the current actor speaks. The Realtime continuation starts after the current reply begins; TTS and Avatar preparation use a separate background path that leaves the current media element, audio, playback token and visible preparation status alone. Prepared video is preloaded without playing. Only the natural completion counter releases the queued line. A slow provider can still leave a residual gap; the first response still requires generation. No measured latency reduction is claimed yet.

The queue is limited to one unplayed line, and the three-turn beat budget is unchanged. Speculative dialogue enters conversation history only when playback starts. New human input uses a new connection epoch, discards queued work and disconnects the old Realtime response stream. Cut, Reset, chapter changes and Direct invalidate pending preparation. A late POST acknowledgement is cancelled using its returned job ID; foreground generation waits for background cancellation to settle. Already submitted provider work may have consumed credits even when its result is discarded.

Directing an improvised line now retains its actor and text rather than selecting a baseline chapter line. Original/new comparisons preserve the authored chapter. Applying a direction clears superseded conversational context; the next story input includes the revised current line. Tests cover this behavior, speculative overlap, late acknowledgements, queued-history exclusion, cancellation and the absence of an automatic fourth turn.

Desktop layout caps the player according to viewport height with room reserved for header, navigation, heading and toolbar. Controls use bottom sticky positioning and wrap according to available container width. Mobile retains natural scrolling. Final visual checks of this sizing and a live latency benchmark remain open because native browser automation returned stale views and blank captures during this pass.
