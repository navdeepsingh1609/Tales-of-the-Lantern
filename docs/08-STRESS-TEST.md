# 08 — Stress test (self-scored, honest)

| Criterion (weight) | Score | Why |
|---|---|---|
| Use of Higgs Audio (30%) | 8 | All three models do work generic TTS cannot: interruption-as-interface (Realtime), inline emotion/sfx/pitch/pause tags and cloning (TTS 3), single-image faces (Avatar), code-switched direction, mid-speech tool calls. Gap: Realtime mostly listens + acts, and the cast is TTS-driven, not Realtime-driven. |
| User Experience (25%) | 7 | Directing by voice is intuitive and the stage is cinematic; the risk is avatar render latency between a note and the redo. |
| Innovation (25%) | 8 | "Voice as a director's megaphone" turns interruption — usually a failure case — into the core mechanic. Table-read / localization framing gives it a real user. |
| Technical Execution (20%) | 6 | Many moving parts: Realtime WS + TTS + avatar fMP4 + MSE + 3D. Mitigated by spike-first plan and feature flags. |

**Weakest: Technical Execution (and the avatar-latency half of UX).**
**One change that fixes it:** make *pre-roll* a first-class feature. While actor A speaks line N, the server already renders line N+1 for actor B (TTS → Avatar stream) and holds it hot; on interruption, discard and re-render only the changed line. Also ship a feature-flag ladder (see 04-ARCHITECTURE §Degradation ladder) so a failure degrades the show instead of ending it.

**Second-weakest: "Use of Higgs" if Realtime feels bolted-on.** Fix: stretch goal **Hot Seat** — one actor goes fully live over Realtime so the director can hold an open conversation with a character while the other two heckle from the wings.

## Unverified assumptions (every one has a test in 02-VERIFY-FIRST.md)
1. Event deadline / time zone / late entries.
2. Third-party AI tools allowed? (default: not used)
3. Higgs Avatar animates stylized (non-photoreal) faces acceptably.
4. `/v1/videos/stream` time-to-first-frame is low enough for turn-by-turn use.
5. `input_tts` honors inline tags and custom `voice_<id>`.
6. fMP4 from `/v1/videos/stream` plays in browsers via MSE with its audio track.
7. REST calls from the browser are CORS-blocked → proxy through our server.
8. Realtime concurrency limit (number unpublished).
9. Custom `voice_<id>` works in Realtime sessions.
10. `session.update` voice change mid-session works (only needed for Plan B/hot seat).
11. Realtime text-only mode is good enough to translate / rephrase lines (else pre-authored translations only).
12. Browser echo cancellation prevents the actors' audio from triggering false barge-in on the director's mic.
13. Realtime `speech_started` fires reliably on short commands like "Cut!".
14. Word timestamps only for en/zh/es → captions in other languages use line-level timing.
