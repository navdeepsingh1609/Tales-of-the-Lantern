# Feasibility report — media viable, Realtime tool gate failed

Date: 2026-10-24. Budget: **CA$30 maximum**, at least CA$25 reserved for the demo. The human confirmed workspace cap and warning are now set. The reduced test scope preserves credits; untested capabilities are not marked as passes.

## Decision

**Choose Plan A for the media pipeline**, conditional on resolving Realtime direction/tool behavior. One Realtime booth plus per-line TTS → supported WAV → Avatar fMP4 is the verified request shape. Avatar/MSE works with an approved procedural portrait. No LiveKit or third-party AI key is required for this path.

**P0 blocker: V-32 failed.** Three bounded Realtime attempts established ephemeral authentication but did not complete a client function call. `auto` returned text; named selection emitted an error; `required`, after configuration acknowledgment, timed out at 45 seconds. Do not claim native direction tools work or start further paid probes automatically.

Proposed next gate: human approval to build cast playback and microphone interruption with keyboard controls explicitly labeled as the available direction path, while keeping native voice tools gated. This is a scoped continuation, not proof that all P0 requirements have passed.

## Measured evidence

| Observation       | Result                                                                      | Evidence                                          |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| Streaming TTS     | HTTP 200; first audio 1,079 ms; total 3,029 ms; 4.12 s audio                | `spike-results/live/tts-probe.json`, real WAV     |
| Avatar stream     | HTTP 200; first byte 1,551 ms; total 4,853 ms; 741,317 bytes                | `spike-results/live/avatar-probe.json`, real fMP4 |
| Chrome MSE        | PASS; playback decoded at 480×640                                           | `spike-results/live/browser-media-review.json`    |
| Realtime auto     | Auth/connect succeeded; text response, no validated client call             | `spike-results/live/realtime-initial.json`        |
| Realtime named    | Session/response created, then server error event                           | `spike-results/live/realtime-named.json`          |
| Realtime required | Configuration echoed 1 tool and required selection; timeout 45,186 ms total | `spike-results/live/realtime-probe.json`          |
| Offline 3D stage  | Chrome spot samples 59–60 fps with stage controls                           | `spike-results/visual-rehearsal.md`               |

First-byte measurements are not first-frame or note-to-redo measurements. Serial TTS completion plus Avatar startup may exceed the 3-second redo target; pre-roll and labeled audio/still fallback remain important hypotheses. Voice-onset-to-silence has not been measured.

## Verification table

PARTIAL below includes explicitly deferred checks; the explanation distinguishes implementation/document review from actual runtime evidence.

| ID   | Status  | Evidence / limitation                                                                                                 |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| V-00 | PARTIAL | Human confirmed morning deadline and accepted entries; exact cutoff/time zone still unrecorded                        |
| V-01 | PARTIAL | Coding subagents authorized; no third-party product model used; organizer permission for any additional model unknown |
| V-02 | PARTIAL | Eligibility/team/license rules not confirmed                                                                          |
| V-03 | PARTIAL | Key and live paid endpoints work; spend controls confirmed by human; actual remaining balance not retrieved           |
| V-20 | PARTIAL | PCM streaming and timing measured on one short reusable line; exact 120-character benchmark not run                   |
| V-21 | PARTIAL | Amusement/laughter included in real Jake clip; other tag families and listening judgment pending                      |
| V-22 | PARTIAL | Jake generated successfully; three-way voice audition deferred to real cast asset generation                          |
| V-23 | PARTIAL | Cloning deferred to preserve budget; presets suffice for core build; consent still required if added                  |
| V-24 | PARTIAL | Timestamp constraints documented; separate timestamp calls deferred; line captions planned                            |
| V-25 | PARTIAL | Multilingual tag audition deferred; authored Spanish variants exist but are not runtime verified                      |
| V-10 | PARTIAL | One procedural portrait produced a decodable Avatar clip; human lip-sync judgment and other actors pending            |
| V-11 | PARTIAL | First byte measured 1,551 ms for a 4.12-second clip; live first-frame latency not measured                            |
| V-12 | PARTIAL | Chose verified TTS → WAV input; nested TTS tags/custom voice not tested                                               |
| V-13 | PASS    | Saved real fMP4 decoded through Chrome MediaSource at 480×640, via local server proxy                                 |
| V-14 | PARTIAL | Parallel Avatar jobs intentionally deferred; serialize/pre-roll first                                                 |
| V-15 | PARTIAL | Preset listing/custom-session ownership deferred; `/videos/stream` accepts supplied portrait                          |
| V-30 | PARTIAL | Three ephemeral credential/Node WS connections worked; actual browser WS session not yet tested                       |
| V-31 | PARTIAL | Mic/short-command VAD, echo and silence timing require the next phase and a headset test                              |
| V-32 | FAIL    | Client tools did not complete in three bounded configurations; preserved evidence above                               |
| V-33 | PARTIAL | Code-switched tool direction not tested because V-32 is blocked                                                       |
| V-34 | PARTIAL | Concurrency intentionally deferred; Plan A needs one session                                                          |
| V-35 | PARTIAL | Custom/preset Realtime voice audition deferred; use default booth voice initially                                     |
| V-36 | PARTIAL | Mid-session voice switching deferred; not required for the core architecture                                          |
| V-37 | PARTIAL | Text output observed in auto probe; rewriting/translation quality not tested; authored variants preferred             |
| V-38 | PARTIAL | Exact-text control not tested; Wren should use short acknowledgments                                                  |
| V-39 | PARTIAL | Input transcription not tested without microphone session                                                             |
| V-40 | PARTIAL | Procedural stage spot checks 59–60 fps; three real video textures/postprocessing not benchmarked                      |
| V-41 | PARTIAL | One MSE clip works; concurrent media and WS audio not yet tested                                                      |
| V-42 | PARTIAL | Chrome rendering/MSE checked; Safari/Firefox unverified                                                               |

## Art, palette and scope

- Art: original procedural front-facing portraits approved by the human, paired with the 3D paper theatre. No real likeness or third-party image generator used. Final visual quality remains subject to clip review.
- Provisional cast: Eleanor/Nora for Odile, Jake for Rocco, Chloe for Pim. Only Jake is runtime-auditioned so far; these are not final listening-approved choices.
- Runtime probe palette: documented `emotion:amusement` and `sfx:laughter`; no assertion that all other documented tags are audible or suitable yet.
- Cut/defer: LiveKit, custom cloning, Guest Star, Hot Seat, concurrency experiments, broad art-style matrices, repeated voice auditions and word timestamps. Keep authored language variants and line captions for the core.

## Request and budget accounting

This phase made **1 TTS request, 1 Avatar request, 3 credential requests and 3 bounded WS sessions**. The earlier user key-verification request is separate. There were no automatic retries. Two explicit Realtime follow-ups tested documented controls; after the third failed, live diagnostics stopped.

The text/audio/video list-price estimate is far below the CA$5 development allocation, but **actual billed usage and CAD conversion are not reconciled**. `spike-results/private/batch-reservations.json` conservatively holds CA$5 for this batch; it is a reservation, not a claim that CA$5 was charged. Reconcile workspace usage before releasing that reservation. Each probe has a one-time marker preventing accidental repeats.

No long-lived key, ephemeral secret, raw authorization header or raw upstream error prose is saved in the evidence. Real outputs can be replayed at `http://127.0.0.1:5173/spike` without new generation.
