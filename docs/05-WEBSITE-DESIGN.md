# 05 — Website & 3D Experience Design

Goal: the first five seconds must feel like a real miniature theatre you could reach into — then the voice makes it alive. **Spend boldness on the stage; keep every other surface quiet.** (Principle from the design skill: one memorable thing.)

## Subject grounding
Subject: a voice-directed puppet theatre. Audience: judges, screenwriters, game narrative folks. Primary job: let someone direct three actors with their voice within 10 seconds of arriving. Vernacular to draw from: playbills, proscenium arches, cue sheets, stage-manager call scripts, paper theatre toys. Not: SaaS dashboard, chat UI, neon "AI" gradients.

## Design tokens
**Color (named, hex)**
| Name | Hex | Use |
|---|---|---|
| Backstage | `#101826` | page + stage void |
| Tungsten | `#FFB547` | key spotlight, active-speaker ring, primary action |
| Oxblood Velvet | `#7A1F2B` | curtains, set dressing |
| Gull Grey | `#AEB9C7` | secondary text, inactive UI |
| Storm Teal | `#3FC1B0` | storm effect, HUD "model event" accents |
| Playbill Paper | `#EFE6CF` | captions panel, cutout puppets' paper edge |
Dark-only stage; UI text on Backstage must pass 4.5:1. Do not use a cream page background or a single acid accent as the whole identity.

**Type**
- Display / title cards / actor nameplates: **Bricolage Grotesque** (variable, use width + weight axes expressively; large, tight).
- Captions & scene text: **Newsreader** (serif; slightly looser line-height; ≤70 characters per line).
- HUD numerals only: tabular figures of the display face (no monospace-for-everything).
Self-host fonts (or Google Fonts if allowed by the final hosting); always include fallbacks.

**Shape & motion**
- Corners: curtains and puppets are cut paper (irregular, small radius); UI panels are squared with one clipped corner like a ticket stub — not uniformly rounded cards.
- Motion: one orchestrated opening — curtain rises, lights come up, puppets settle. After that motion is **responsive to the director**: camera pushes on whoever speaks; storm builds on cue; actors freeze on "Cut!". No decorative fade-ups on UI sections.
- `prefers-reduced-motion`: replace camera moves with cuts, disable particles.

## Layout concept
```
┌──────────────────────────────────────────────────────────────┐
│  CUT!                         [mic ● live]   [HUD] [Judge Mode] │  ← slim top bar, 40px
│                                                              │
│            ╔════════ 3D PROSCENIUM (full-bleed) ═══════╗      │
│            ║  curtain   ODILE     ROCCO      PIM  curtain ║      │
│            ║           (video    (video    (video         ║      │
│            ║            on paper  on paper  on paper)     ║      │
│            ╚══════════ footlights + stage floor ══════════╝      │
│  ┌─ caption strip (Playbill Paper) ──────────────────────┐   │
│  │ ODILE: The glass has been dark since March…           │   │
│  └───────────────────────────────────────────────────────┘   │
│  Cue sheet (left, collapsible)        Higgs Inspector (right)  │
└──────────────────────────────────────────────────────────────┘
```
Alignment: stage centered; captions centered under the speaker; HUD and cue sheet left/right aligned, collapsible, default collapsed on narrow screens.

## The 3D stage (R3F)
- **Proscenium:** arch geometry with PBR materials (painted wood, aged gilt), soft shadows, subtle bloom on the spotlight cone, light dust particles in the beam.
- **Curtains:** vertex-shader cloth (sine-wave folds + wind uniform), rise/part animations on scene start/end; Oxblood Velvet.
- **Puppets:** each actor = a paper cutout body (thickness via slight extrusion, drop shadow on a backdrop plane) with the **Avatar video mapped as a `VideoTexture` onto the face plane**; idle = still `ref.png` crop crossfaded to video when speaking so there is never a black frame. Puppets hang on visible rods and sway on a spring when they speak or react.
- **Camera rig:** default wide; slow push-in on speaker; whip pan on actor change; shake on thunder; "Cut!" = hard freeze + 150 ms desaturate flash (directorial gesture).
- **Weather & set cues (tool-call driven):** `storm` (rain particles, lightning point-light flicker, thunder rumble synthesized locally — NOT a Higgs claim), `lights` (color-grade, warm/cool), `props` (lantern swing), `camera` (shot types).
- **Speaker ring:** Tungsten ring + footlight raise under the active actor.
- **Quality ladder:** `high` (postprocessing) → `medium` → `low` (no shadows, no particles) by measured FPS.
- **Fallback if WebGL fails:** 2D layered parallax stage using the same assets.

## Higgs Inspector HUD (research judges will love this; make it beautiful and honest)
Live rows, newest on top, each tagged with the model that produced it:
- `Realtime  speech_started → actors silent  142 ms` (measured client-side; label as measured)
- `Realtime  tool_call give_note {actor: odile, emotion: sadness}` + the resulting tag diff: `anger → sadness + sniff`
- `Realtime  language heard: es / en (code-switched)` (if surfaced via transcription/tool args; else omit)
- `TTS 3     voice: odile / eleanor · tags: emotion:sadness prosody:speed_slow sfx:sniff`
- `Avatar    stream started · video id <X-Video-Id> · first frame 1.9 s`
- Degradation level indicator (L0–L4) and credit-guard counters.
A one-key toggle (`H`). Default ON in the demo video, tidy but not noisy.

## Interaction map
| Input | Result |
|---|---|
| Voice: "Roll scene" / "Action" | Wren: "Rolling." Curtain opens, scene starts |
| Voice: "Cut!" | Actors freeze ≤ budget; HUD logs ms |
| Voice: note / language / set change | Tool calls → actor re-performance / world change |
| Click actor | Spotlight + open "voice & face" drawer (palette, cloning consent flow) |
| Space (hold) | Push-to-talk fallback |
| `H` | Toggle HUD · `C` captions · `M` mute booth · `R` reset scene |

## Landing / intro (single screen, not a marketing page)
- Opens straight on the dark stage with the curtain closed and one line on the curtain: "Say *Roll scene.*" Mic permission prompt is framed as "Stage manager needs your voice" with a headset recommendation.
- Judge Mode link: `/judge` pre-warms the scene and shows 3 suggested notes.

## Copy rules
Plain verbs, sentence case, no jokes in errors. Examples: "Mic blocked. Allow microphone access in the address bar, then press Space to try again." / "Avatar service is busy. Showing stills with voice (level 3)."

## Accessibility & quality floor
Captions on by default; every voice command has a keyboard equivalent; focus visible; contrast checked; reduced-motion respected; no autoplay audio before a user gesture; mobile shows a "best on desktop" notice but must not crash.

## Asset checklist
Character art ×3 (+ cutouts), proscenium/curtain/floor textures (CC0 or self-made, license noted), fonts, thunder/rain ambience (self-recorded or CC0, license noted), favicon, OG image.
