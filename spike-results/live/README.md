# Real feasibility artifacts

These are actual Boson outputs, not fixtures or simulated model responses.

- `tts-probe.wav`: `higgs-tts-3`, preset `jake`, PCM converted losslessly to 24 kHz / 16-bit / mono WAV. Input: `<|emotion:amusement|><|sfx:laughter|>Haha, the storm is coming. Count the waves with me.`
- `avatar-probe.mp4`: `higgs-avatar`, `480x640`, driven by that exact WAV and `content/characters/rocco/ref.png`. The reference is an original fictitious procedural portrait, not a real person's face.
- Matching JSON files contain sanitized measurements. First audio/stream byte timings are not end-to-end note-to-redo or speech-to-silence measurements.
- `realtime-initial.json` preserves the optional (`auto`) tool-selection result. `realtime-named.json` preserves the named-selection result. `realtime-probe.json` contains the most recent explicit diagnostic. These attempts are not silently treated as passes.
- `browser-media-review.json` records observed Chrome decoding/MSE compatibility from replay, without a further generation.

Review at `http://127.0.0.1:5173/spike` while `pnpm dev` runs. Replay uses the local files and costs no generation credits. Re-running `pnpm spike:live` is not part of ordinary development; one-time markers block repeated calls.
