# 02 — Verify Before Building (the Feasibility Spike)

**Rule:** no feature code until the spike table is filled with PASS / FAIL / PARTIAL and evidence (log lines, saved files in `/spike-results/`). The spike is a script suite: `pnpm spike` (the agent writes it, using ONLY endpoints and fields documented at docs.boson.ai).

Time box: 2 hours. If more than two P0-blocking items FAIL, stop and report to the human with the decision matrix in `04-ARCHITECTURE.md`.

## A. Logistics (human + agent)
| ID | Check | How | Pass |
|---|---|---|---|
| V-00 | Submission deadline, time zone, late policy | Event Luma page, Discord/email from organizers, the form | Deadline written in `docs/00` with source |
| V-01 | Third-party AI tools allowed? | Organizer rules/FAQ; ask in event chat | Written answer; default "no" |
| V-02 | Team size limits, prize eligibility, open-source/license requirements | Same | Noted |
| V-03 | API key works; credit claimed | `pnpm verify:env` → one cheap TTS call | 200 OK; balance non-zero; monthly cap set in workspace usage page |

## B. Avatar
| ID | Check | Pass criterion | Fallback |
|---|---|---|---|
| V-10 | Cartoon/vinyl-toy reference images animate acceptably. Test 3 art styles × 3 characters at `480x640`. | Lip-sync readable, no face melting, mouth clearly opens | Move art toward semi-3D-rendered, front-facing, neutral closed-mouth faces; else use a preset avatar look for that actor |
| V-11 | Time-to-first-frame of `POST /v1/videos/stream` with `input` audio (3 s, 8 s clips) | Record ms; usable if < ~2.5 s for a 3 s line | Pre-roll next line; still-image + audio-only fallback |
| V-12 | `input_tts` accepts tags (`<\|emotion:…\|>`) and a custom `voice_<id>` | Audible emotion; face expression follows | Generate audio with TTS first, then send `input` audio |
| V-13 | Browser can play the streamed fMP4 (MSE) with its audio track; no CORS issue when proxied through our server | Plays within ~1 s of first bytes in Chrome | Wait for full clip via `/v1/videos` + `/content` |
| V-14 | Parallel avatar jobs: 3 simultaneous streams | All three complete; note any 429/capacity errors | Serialize + pre-roll |
| V-15 | `GET /v1/avatars`: which presets exist; can the key own custom avatars (docs show no create route) | List saved to spike results | Use `/v1/videos` with `ref_image` per line |

## C. TTS
| ID | Check | Pass | Fallback |
|---|---|---|---|
| V-20 | Stream PCM (`stream:true`, `response_format:"pcm"`) time-to-first-byte for a 120-char line | Record ms | Non-stream mp3 |
| V-21 | All tag families audible: emotion, style (whisper), sfx (laughter, sigh, sniff, sneeze), prosody (pause, pitch, speed). Pair each sfx with onomatopoeia as docs advise. | Team agrees by ear; record per-actor "tag palette" | Drop weak tags from the palette |
| V-22 | Voice pick: audition `eleanor, nora, jake, chloe, marcus, oliver` + the hackathon voice library | Three clearly distinct voices | Adjust pitch/speed tags |
| V-23 | Cloning from a 10–15 s mic clip in a noisy room; `POST /v1/audio/voices` reuse | Recognizable, stable | Use presets only; cloning becomes a pre-recorded team-member demo |
| V-24 | Word timestamps (`timestamps:true`, non-stream, ≤~300 chars) in en/es/zh; behavior for other languages | JSON decodes; `null` elsewhere | Line-level captions |
| V-25 | Tags + non-English text (es, hi, zh) sound right; does a tag change language/accent? | Natural | Keep emotion tags on, drop style tags in that language |

## D. Realtime
| ID | Check | Pass | Fallback |
|---|---|---|---|
| V-30 | Connect with server key; then browser connects with ephemeral key (`bai-client-secret.<value>` subprotocol) | Both work | Proxy WS through server |
| V-31 | `speech_started` latency on short commands ("Cut!", "Stop!", "Hold on") while actor audio plays through speakers vs. headphones; `echoCancellation`/`noise_reduction` settings | No false positives from actor audio; reliable on real commands | Headset required; push-to-talk fallback; `server_vad` threshold tuning (default 0.85) |
| V-32 | Function calling: declare `cut`, `give_note`, `set_language`, `change_set`, `recast`; confirm tool call arrives while Wren is speaking a preamble; return `function_call_output` + `response.create` | Calls arrive with correct JSON args for natural phrasing in en/es | Add stricter tool descriptions; `tool_choice` tuning |
| V-33 | Code-switched direction ("Odile, hazlo more sad, por favor") parsed correctly into tool args | Correct ≥8/10 trials | Normalize via tool enum |
| V-34 | Concurrent Realtime sessions allowed (try 2, then 3) | Note limit/close code 1013 | Plan A (one Realtime session) is the default anyway |
| V-35 | Custom `voice_<id>` and named presets in Realtime `audio.output.voice` | session.updated OK | Wren stays on a preset |
| V-36 | `session.update` voice change after the session started | Applies to next response | Only matters for Plan B / Hot Seat |
| V-37 | Text mode (`output_modalities:["text"]`): quality for rewriting a line to a new emotion and translating to Spanish/Hindi | Natural, tags preserved | Pre-authored translations only; **no third-party LLM unless V-01 says yes** |
| V-38 | Can Realtime be made to say exact text (via `conversation.item.create` + `response.create` with instructions)? Does it emit/consume TTS tags? | Document result | Wren only says short free-form confirmations |
| V-39 | Input transcription (`higgs-stt-3.1`) events for HUD captions of director speech | Transcripts arrive | HUD shows intents from tool calls instead |

## E. Frontend feasibility
| ID | Check | Pass |
|---|---|---|
| V-40 | R3F scene with 3 video-textured puppet planes + postprocessing holds ≥45 fps on target laptop | FPS number recorded |
| V-41 | Two simultaneous `<video>` + MSE pipelines + WS audio don't glitch | Clean |
| V-42 | Chrome + Safari + Firefox quick matrix (only Chrome must work) | Matrix recorded |

## F. Output of the spike
`docs/SPIKE-REPORT.md` with: table above filled, measured latencies, chosen architecture plan (A/B/C/D), final tag palette per actor, art style decision, list of cut features. Commit it.
