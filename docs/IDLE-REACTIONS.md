# Idle reaction clips

## Probe results

The Higgs Avatar silence probe produced nine individual clips: Odile, Rocco, and Pim in the lighthouse (`gull-point`), tavern, and observatory scenes. The clips are checked in under `apps/web/public/scenes/`; their generation metadata is in [the manifest](../content/idle/manifest.json). Each individual request used a three-second, 24 kHz mono silent PCM WAV and returned HTTP 200. No TTS was requested and no retries were made.

The lighthouse group probe also returned HTTP 200, but its result is effectively static and was rejected for product use. That is a quality decision, not a request failure. Use the individual clips; do not enable the group clip.

Visual review found subtle head and gaze movement in Odile's clip. Pim's clip shows a closed-eye frame around 0 seconds and open eyes around 2.1 seconds, which verifies a blink in that clip. These observations do not establish explicit blink control. Nod timing, reliable blinking across other clips, and body gestures were not verified; the API does not expose controls for those actions. Do not describe every clip as visibly animated based only on successful generation.

The local sanitized evidence is under ignored `.cache/idle/{scene}/{actor}/evidence.json`. An offline integrity audit confirmed that all nine checked-in MP4s match their manifest byte counts and SHA-256 hashes and begin with an `ftyp` box. All ten local probe WAVs contain exactly three seconds of silent 24 kHz mono PCM audio. This verifies file integrity and input format, not decoded visual quality for every clip.

## Playback guidance

Use an individual scene-and-actor clip only while preparing a story reply, and mute it. Keep the existing wide group listening illustration static while users speak. Character motion initially follows the system reduced-motion preference, using the existing static image when reduced motion is requested. Scene settings lets the user explicitly enable or disable character motion and select an actor for a free cached preview. Hidden tabs pause idle video decoding; returning to the tab resumes playback safely. When playback ends, return to the scene still.

For implementation, play one video at a time and loop it with a canvas crossfade. Clean up the video, animation frame, and canvas resources when playback stops or the scene changes. Avoid warping a still face with CSS; it cannot create coherent body motion.

## Probe procedure

The original one-request probe script can still print a plan without making a request:

```sh
node --experimental-strip-types scripts/avatar-idle.ts --actor odile --scene lighthouse
```

Actor values are `group`, `odile`, `rocco`, and `pim`; scene values are `lighthouse`, `tavern`, and `observatory`. A request requires `--run` and reads the ignored local `.env`. Do not rerun the completed probe as part of ordinary development, tests, installation, or startup. Each streamed video request is billable.

References:

- [Higgs Avatar overview](https://docs.boson.ai/models/higgs-avatar/overview)
- [Higgs Avatar inputs and limits](https://docs.boson.ai/models/higgs-avatar/input-options)
- [Create a video (streaming) API reference](https://docs.boson.ai/api-reference/videos/create-a-video-streaming)
- [Create a video API reference](https://docs.boson.ai/api-reference/videos/create-a-video)
