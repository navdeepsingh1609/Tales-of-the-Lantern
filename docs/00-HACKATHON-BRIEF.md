# 00 — Hackathon Brief (verified facts only)

Sources, fetched 24 Oct 2026:
- Event page: https://www.boson.ai/hackathon
- Docs index: https://docs.boson.ai/llms.txt (use it to discover every page)

## Live recheck — 24 Oct 2026

The official event HTML was fetched again for the judge-focused pass, and current TTS tags and Avatar input documentation were rechecked. Tracks, judging weights and submission items still match this document. The primary track is Put a Face to the Voice. The human now reports 0.08 used out of 50 Boson credits; this does not change the CA$30 cash ceiling or establish a credit-to-CAD conversion. The human confirmed entries are accepted and the deadline is in the morning; an exact cutoff/time zone is still unrecorded.

- Credit distinction: the event advertises $100 for hackathon participants; the general pricing docs describe $10 for a new account's standard trial. Confirm the actual credited balance in the workspace rather than assuming either amount.
- Latency figures below are vendor claims, not CUT! measurements. Realtime's VAD `min_speech_duration: 0.125` is a detection setting; it does not establish our end-to-end stop latency.
- Avatar's nested `input_tts` does not support `stream: true`. The spike must compare integrated non-streaming TTS → streaming Avatar against generating supported audio first; raw PCM is not a documented Avatar audio-file format.
- Current TTS delivery tags replace the entire previous delivery group. Build the tag mapper accordingly; do not assume a later emotion tag preserves earlier pace/style tags.
- Client function calls are completed in `response.done`. Whether our custom client tools produce the desired mid-speech stage effect remains a spike question, even though the event advertises tools while talking.

Sources: [pricing](https://docs.boson.ai/pricing.md), [Avatar input limits](https://docs.boson.ai/models/higgs-avatar/input-options.md), [turn detection](https://docs.boson.ai/models/higgs-realtime/guides/turn-detection-and-interruptions.md), [tool calling](https://docs.boson.ai/models/higgs-realtime/guides/tool-calling.md), [TTS tags](https://docs.boson.ai/models/higgs-tts/tags.md).

The agent MUST re-fetch both and diff against this file before coding. If anything differs, the live page wins; update this file and say so.

## Event
- Page header shows **Friday, October 23**. The page does **not** state a submission deadline ("by the submission deadline"). **UNVERIFIED — confirm the deadline, time zone, and whether late entries are accepted before spending a single credit.** (Today, when this was written, is Saturday 24 Oct 2026.)
- Rule stated on page: *"Higgs Audio should be a meaningful part of the experience, not simply the final TTS output layer."*
- Participants get free Higgs Audio credits; Realtime page says **$100 in free credits**.
- The page does **not** say whether third-party models/tools are allowed. **UNVERIFIED.** Treat every third-party AI model/API as forbidden until a rule says otherwise. Open-source libraries (React, three.js, etc.) are ordinary dependencies.

## Tracks (pick closest; name a primary)
1. Put a Face to the Voice
2. Conversation as the Interface — natural turn-taking, graceful interruptions, languages that change mid-sentence
3. Agents That Act — voice that gets things done via tools/APIs

## Judging (each 1–10, weighted)
| Criterion | Weight | What the page says |
|---|---|---|
| Use of Higgs Audio | 30% | Build around code-switching, expressive delivery, real-time turn-taking, interruption handling, tool calling. "If it'd work the same with any generic TTS engine, this is the section to strengthen." |
| User Experience | 25% | "Usable, responsive, and pleasant to actually talk to. A rough prototype that feels good beats a polished one that doesn't." |
| Innovation | 25% | New idea or old idea done differently; bonus for solving something people want solved |
| Technical Execution | 20% | "Works reliably, reads cleanly." Judges read the repo; clear setup and honest notes on what's unfinished help |

## Submission form requires
1. Project name, track, one-sentence showcase description, write-up ≤200 words (problem, who for, how it works)
2. Demo video 2–3 min, **public link, no access request**; must show the project actually working, not slides; optional live URL
3. Public GitHub repo, setup instructions, a few example inputs/outputs, **exact commit SHA or tag** (later pushes are not seen); **remove all API keys**
4. "How you built it" ≤200 words: each Higgs model/API used, what it does, what's novel/hard
5. Team info: GitHub handles + contributions + known limitations
Form: https://docs.google.com/forms/d/e/1FAIpQLSe6IRDRto93iKdwTcRpCeZJ4pG1WIgJArIG7ksayCUOCjpMYw/viewform

## Models as described on the event page / docs
| Model | Verified claims |
|---|---|
| Higgs Realtime (`higgs-realtime`) | Speech-to-speech over WebSocket `wss://api.boson.ai/v1/realtime`; ~700 ms speech-in→speech-out; stops 0.125 s after interruption; 100+ languages with mid-sentence code-switching; native function calling mid-conversation; server-side `web_search` tool; OpenAI Realtime-compatible protocol; `server_vad` / `semantic_vad`; voices = `default`, TTS presets, or custom `voice_<id>`; optional input transcription `higgs-stt-3.1`; ephemeral browser keys via `POST /v1/realtime/client_secrets`; concurrency limit exists (WS close 1013) — **number unpublished** |
| Higgs TTS 3 (`higgs-tts-3`) | `POST /v1/audio/speech`; streaming PCM (`stream:true`, `response_format:"pcm"`, 24 kHz 16-bit mono); presets `chloe, eleanor, jake, marcus, nora, oliver` (+ hackathon voice library: https://boson-hackathon-voices.pages.dev/); zero-shot cloning via `ref_audio`+`ref_text` (5–30 s clean speech recommended); reusable `POST /v1/audio/voices`; tags `<|emotion:…|>`, `<|style:…|>`, `<|sfx:…|>`, `<|prosody:…|>`, `<|reset|>`; `timestamps:true` → JSON with base64 audio + word times, **only en/zh/es**, **not combinable with stream**, keep ≈300 chars |
| Higgs Avatar (`higgs-avatar`) | Still image (PNG/JPEG/WebP) + exactly one of `input` (audio ≤60 s) or `input_tts` (a TTS request ≤5,000 chars); sizes `640x640`, `640x480`, `480x640`; async jobs `POST /v1/videos` → poll → `GET …/content`; streaming fMP4 `POST /v1/videos/stream` (id in `X-Video-Id`); **Realtime avatar sessions** (`POST /v1/avatar/sessions`) require **LiveKit Cloud**, `avatar_id` from `GET /v1/avatars` (presets e.g. `builtin_claire_v1`, `builtin_emma_v1`, `builtin_james_v1` + avatars owned by the key), capacity-limited (`429 capacity_exhausted`) |

## Pricing quoted on the page (use for budgeting)
Realtime $0.0023/min speech in, $0.014/min speech out · TTS from $0.015 per 1,000 chars · Avatar from $0.07/min.

## Things the docs do NOT say (treat as UNVERIFIED until tested)
See `docs/02-VERIFY-FIRST.md`.
