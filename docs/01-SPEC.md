# 01 — Product Spec: CUT!

## 1. One-liner
Direct a cast of three animated AI actors with your voice. Interrupt them mid-line, give a note in any language, and watch them re-perform it in character.

## 2. Why this project (the story behind the choice)
Voice-AI demos are almost always one voice talking to one person in a void. Real conversation is multi-party, emotional, multilingual, and constantly interrupted. Theatre is the oldest medium where voice carries everything, and **directing is the art of interrupting performers to change their performance**. So we made interruption the *interface* instead of the failure case:
- Higgs Realtime's fast barge-in becomes the "Cut!" gesture.
- Higgs TTS 3's inline emotion / whisper / laughter / sigh / pitch / pause tags become the director's notes.
- Higgs Avatar gives each performer a face from one still image.
- Code-switching becomes a creative lever ("do the second half in Spanish").

**Who it's for (real users, not "AI tutor"):** screenwriters, game narrative designers, and localization leads who currently wait days for a table read and pay studio time to hear a scene in a different tone or language. CUT! gives them a table read in seconds, directable by voice. The demo is entertaining; the use case is real.

**Primary track:** Conversation as the Interface. **Secondary:** Put a Face to the Voice. (Agents That Act appears via tool calls but is not the pitch.)

## 3. Product principles
1. **Every Higgs feature is a visible plot beat** — a judge should be able to point at the screen and say "that's the model."
2. **No generic-TTS test passes:** if you swap Higgs for a plain TTS the demo must visibly fail (no sfx laughs, no 0.125 s stop, no cloning, no code-switch).
3. **Real or not shown.** Never mock Higgs output. Caching of *real* generated clips is allowed and disclosed in the README.
4. **The stage is the one place we spend boldness.** UI chrome stays quiet.
5. **Degrade, don't die.** Every risky component has a fallback (see architecture).

## 4. Characters (cast of three + a voice from the booth)
Full bible: `docs/03-CHARACTERS-AND-STORY.md`. Summary:
| Actor | Role | Voice (TTS preset, to be confirmed by ear in spike) | Signature tags |
|---|---|---|---|
| **Odile Marsh** | Weary lighthouse keeper | `eleanor` or `nora` | contentment, sadness, contemplation, `speed_slow`, long pauses |
| **Rocco Vega** | Charming smuggler, speaks Spanglish | `jake` | enthusiasm, amusement, `sfx:laughter`, `speed_fast` |
| **Pim** | Tiny anxious apprentice | `chloe` + `pitch_high` | fear, surprise, whispering, `sfx:sniff`, `sfx:sneeze` |
| **Wren (off-stage)** | Stage Manager in the Booth — Realtime voice, no face | Realtime voice (preset, e.g. `oliver`) | speaks short confirmations, runs tools |

## 5. Functional requirements
Priority: **P0** = must ship, **P1** = should ship, **P2** = stretch.

| ID | Requirement | Pri | Acceptance test |
|---|---|---|---|
| F-01 | Mic is open continuously; director speaks naturally (no push-to-talk needed). Space-bar push-to-talk exists as fallback. | P0 | Works with headset on Chrome desktop |
| F-02 | Booth (Higgs Realtime session) hears the director; on `input_audio_buffer.speech_started` all actor audio/video stops. | P0 | HUD shows measured ms from event to silence; target well under 300 ms (**target, not a claim**) |
| F-03 | Rolling a scene performs authored tagged lines for 3 actors with distinct voices and faces. | P0 | 3 actors, ≥6 lines, no overlap glitches |
| F-04 | Director notes via voice ("Odile, less angry, more heartbroken") re-perform the interrupted line with new tags. | P0 | Audible emotion change; tag diff shown in HUD |
| F-05 | Language switch mid-scene ("second half in Spanish; Pim stays English"). | P0 | Lines change language without restarting the scene |
| F-06 | Tool calls from Realtime drive the set (storm, lights, camera, props) **while Wren is still speaking**. | P0 | Visible 3D change timed with speech |
| F-07 | Live captions from word-level timestamps where available (en/zh/es), line-level otherwise. | P1 | Karaoke-style highlight in English |
| F-08 | Vocalized sfx (laugh, sigh, sniff, sneeze) used in performance. | P0 | At least 3 distinct sfx audible in demo |
| F-09 | Recast an actor's voice from a ≥5 s mic recording (consent gate) via custom voice. | P1 | New voice speaks next line |
| F-10 | **Guest Star:** upload one photo + short voice clip (consent) → 4th actor joins. | P2 | 4th actor speaks in cloned voice |
| F-11 | **Hot Seat:** one actor goes fully live over Realtime for open conversation. | P2 | Director converses; interruption works |
| F-12 | Higgs Inspector HUD: live event log (speech_started, tool calls, language, tag diffs, latencies, which model did what). | P0 | Visible toggle, readable in the video |
| F-13 | Judge Mode: public URL, rate-limited, cost-capped, pre-warmed scene. | P1 | Works without keys on judge's machine |
| F-14 | Degradation ladder (see architecture) toggled via feature flags and auto-fallback. | P0 | Kill avatar service → show falls back to still-image puppets with TTS |
| F-15 | Credit/cost guard on server. | P0 | Server refuses jobs past hourly caps |

## 6. Non-functional requirements
- **Security:** `BOSON_API_KEY` server-side only; browser uses short-lived ephemeral Realtime key; no key in git history; `.env` ignored.
- **Consent & safety:** voice/face cloning only after an explicit consent checkbox ("I own the rights or have permission"); docs warn "You must own the right to clone the voice." No cloning of public figures. Guest Star only with in-room consent.
- **Performance budget (targets, to be measured and reported honestly):** director-stop → actors silent < 300 ms; note → first audible redo < 3 s with pre-roll; 3D scene ≥ 45 fps on a 2021 laptop GPU; initial load < 6 s on broadband.
- **Reliability:** every external call has timeout, retry-with-backoff, typed errors; UI shows what failed in plain words.
- **Accessibility:** captions on by default; keyboard path for every voice command; `prefers-reduced-motion` honored; visible focus.
- **Observability:** structured logs (pino) with per-request IDs, video IDs from `X-Video-Id`, Realtime session IDs.
- **Docs:** judges read the repo — README, setup in ≤5 commands, examples in `/samples`, honest limitations.

## 7. Out of scope
Mobile-first layout (desktop Chrome is the target; mobile must not crash), accounts/login, persistence beyond local cache, any non-Higgs AI model unless verified allowed.

## 8. Success definition
A stranger watches the 2:30 video muted and still understands what's special (HUD + captions); watches it with sound and hears three things generic TTS cannot do; clones the repo and sees the stage running in ≤10 minutes.
