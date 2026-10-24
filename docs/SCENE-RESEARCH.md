# Scene research and implementation decision

Research and implementation pass, 2026-10-24. Goal: a coherent conversation with real facial performance, a simpler site, and no moving-background artifacts.

## Findings

The immediate defect was local: `CinematicStage` placed the moving video behind the alpha silhouette of a still PNG. That silhouette has no motion information. Hair, heads and shoulders move relative to it, so it clips the subject or reveals original background. More feathering cannot correct a geometrically wrong mask.

| Technique                | What it does                                                                                       | Suitability here                                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chroma key               | Compares pixels with a designated background color, feathers boundaries and suppresses color spill | Poor fit for existing footage: Rocco's coat and the backdrop both contain teal. It can remove clothing. A future shoot would need controlled contrast.                                                                                    |
| Semantic segmentation    | Estimates a person/background mask from each video frame                                           | MediaPipe supports confidence masks and video inference. Quality on these stylized characters needs verification; it should run in a worker to avoid blocking controls. It is an experiment, not an automatic quality upgrade.            |
| Temporal video matting   | Estimates foreground and alpha while using information from earlier frames                         | RVM uses recurrent temporal memory. Better suited to motion than a fixed silhouette, but brings an inference runtime, model weights and licensing obligations. Its published hardware speed is not evidence of speed on this Mac/browser. |
| Native-frame scene shots | Includes the intended room in the input image and keeps the generated frame intact                 | Selected. No background extraction, no mask lag, preserves the facial output. Needs consistent reference art and a motion-quality check.                                                                                                  |
| Rigged 3D                | Animates a mesh using a skeleton, clips and facial blend shapes                                    | Appropriate for controllable walking, reaching and interacting. Requires authored assets and a separate facial/animation pipeline; it is not supplied by our current video response.                                                      |

Sources: [MediaPipe segmentation](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter), [web integration and worker recommendation](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js), [RVM author repository](https://github.com/PeterL1n/RobustVideoMatting), [Three.js animation](https://threejs.org/manual/pages/animation-system.html).

Boson's documented request takes a reference image plus audio or TTS input. It describes audio-driven lip-sync/movement and fixed output aspect ratios. It does not document director-controlled full-body actions, a shared multi-character simulation, or a rig export. A full-body image can establish a seated pose, but we must not promise choreographed body animation from it. Match the reference aspect ratio to the output to avoid cropping. [Higgs inputs and limits](https://docs.boson.ai/models/higgs-avatar/input-options).

## Why the exchange felt disconnected

The art was composed as isolated front-facing portraits. Adding a house behind them did not establish where anyone sat, whom they looked at, or what they wanted. These are continuity and staging problems as well as rendering problems.

The new master places Odile on the left with a letter, Rocco on the right addressing her, and Pim between them tending the lantern. Shared light, props, seat positions and opposing eyelines establish one event. The room references preserve this arrangement. Their exact head angles still need an Avatar motion check; the image generator did not reliably keep every face within the requested shallow turn.

Use the master as an establishing shot, then speaker coverage with matched framing. Keep cameras on one side of the conversation axis. Listener reaction shots are a later editorial feature and should come from suitable listening footage, not a speaking clip mislabeled as a reaction. Sources: [reverse-angle coverage](https://www.studiobinder.com/blog/what-is-a-reverse-angle-shot-definition/), [eyeline matching](https://www.studiobinder.com/blog/what-is-an-eyeline-match/).

A six-line authored draft now gives the scene a concrete objective: open a returned letter while keeping the harbour light visible. It is reviewable in the writing panel and has not been rendered. This gives the visible props a reason to exist.

## How the web implementation should work

A video-first experience does not need a continuously rendered 3D room behind the footage. The current player uses the browser's video decoder and CSS layout, with one media element owning both picture and sound. The fixed mask and active Three.js room were removed from the player; this also removed the approximately 890 KB Three.js chunk from this entry's production output.

If dynamic matting is tested later, process each decoded frame with `requestVideoFrameCallback`, run segmentation off the main thread, and composite foreground plus alpha in canvas/WebGL. Reset temporal state between clips and seeks, cancel work on unmount, and avoid queueing stale frames. Never wait for matting before honoring Cut. [Browser video-frame API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback), [MediaPipe web execution notes](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js).

For future 3D scenes, use an asset pipeline (modeled environment, textures, rigged GLB cast, authored clips) and animation blending. A collection of spheres and boxes is useful for blocking, but it is not a substitute for character art direction. Geometry/material count also affects runtime cost. [Three.js animation](https://threejs.org/manual/pages/animation-system.html), [object optimization](https://threejs.org/manual/pages/optimize-lots-of-objects.html).

## Implemented now

- Removed the fixed mask. Existing talking clips display their complete original frames, preserving their baked background and provider disclosure.
- Added a shared master scene and three complete-frame, seated-body reference images. Previews are static and labeled accordingly.
- Reduced the default page to title, player, Play/Cut/Reset and microphone interruption. Scene settings and writing start collapsed. Removed cast cards, giant speaker credits, decorative room rendering and the ineffective weather control.
- Added explicit `referenceSet` selection for preparation. Portrait remains the default, so changing the art does not silently regenerate all saved clips. Scene-reference generation uses the new images, retains audio hashes, shares the same durable guard, and restores cached scene clips when available.
- Kept generation explicit, replay free of generation, one audio source, frozen-frame Cut and saved-line Retake.

## Remaining verification and next gate

The new references are concept/reference art, not proof of successful scene animation. Next, render one short scene-reference clip using saved audio; assess mouth movement, face angle, hand/background stability and framing. If it works, prepare only the required demo turns. If it fails, adjust only the reference causing the failure. Do not regenerate the whole cast to discover this.

During the initial research/art pass, no Boson or Groq request was made. After human approval, the bounded calls below were made. Existing local performance reservations remain intact, including the eight-per-hour gate. Actual billing is still unreconciled. The human subsequently approved these references; see the validation record below.

## Validation after reference approval

The human selected “Yes—use these scene references.” One bounded request rendered authored line `l1` with Odile's room reference and its existing saved WAV. It returned a real Avatar video; the local ledger added one CA$1 reservation. Browser replay showed the complete seated pose, letter, chair and room with facial movement and no fixed-mask artifact. It also showed a limitation: the model turns the face toward the viewer, so opposing eyelines are not reliably locked by the reference image. This is not a controllable body/gaze rig. No retry or new TTS was used for that test.

The six-line reviewed scene was then prepared serially as the reusable demo performance: six TTS requests and six Avatar requests, all six returned real video. No retries and no script-provider calls were made. WAV durations total **31.48 seconds** (4.92, 4.88, 5.76, 4.48, 5.80, 5.64). These are local WAV measurements, not confirmed billed video duration. A further CA$6 was reserved, not charged as a measured cost. The total persistent performance reservation ledger is now CA$15; exact billing and conversion remain unverified.

The completed custom scene is saved in ignored `latest-scene.json`; the app restores it on reload without generation. Cached videos remain in the private performance cache. Existing original performances are preserved. Browser playback after reload showed the new opening line, confirming restoration uses the new scene. Cut was separately observed retaining a frame with the Retake action. The earlier human microphone check remains applicable to the shared playback path; no new microphone test was purchased.

This completes a small scene-native demo, not continuous multi-character full-body animation. The establishing master remains a labeled still; the real speaking turns are generated video. The next quality improvements are landscape-native shot coverage and intentional listening/reaction footage, subject to budget and a clear benefit. Do not regenerate this completed performance just to rehearse it.

## Storybook materials and landscape implementation

The current studio takes a restrained materials direction: translucent playback controls, gold edge highlights, dark ink surfaces and a soft reflection below the player. Glass is concentrated in controls, with opaque fallbacks for reduced transparency and strong text contrast. This applies material principles rather than attempting an exact OS reproduction. [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials).

Locally hosted Cinzel supplies the chapter headings and Roman numerals; readable serif body copy and sans-serif controls carry the longer text. The bundled font includes its OFL license. [Official Cinzel source](https://github.com/google/fonts/tree/main/ofl/cinzel).

The player requests native 640×480 landscape clips from landscape scene references, then uses cover framing for the cinematic viewport. An explicit Full frame toggle preserves the complete source. This trades a modest vertical crop for removing default side bars; output remains limited to the provider’s generated resolution. The closer references improve face readability, but do not guarantee perfect eyes or consistent gaze. No enhancement filter is presented as additional generated detail.

The low-resolution reflection samples the same decoded video using the browser video-frame callback, with a frame-rate limit and cleanup. Reduced motion/transparency suppresses it. Tests verify that this feature creates no second media element or audio source. [Video-frame callback reference](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).
