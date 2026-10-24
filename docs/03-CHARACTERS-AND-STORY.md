# 03 — Characters, Story, and Behavior Bible

## Premise
*The Lighthouse at Gull Point* — a storm is coming. Three people are stuck in one room: a keeper who has stopped hoping, a smuggler who won't stop joking, and an apprentice who is terrified of both. The scene is a seed: the director reshapes it live. The authored scene exists so the demo is reliable; the *directing* is what's live.

## Visual identity (character art brief)
- Style: **vinyl-toy / paper-cutout hybrid**, front-facing bust, neutral closed-mouth expression, even lighting, plain background, 1024×1365 (3:4).
- **Hypothesis (UNVERIFIED, test in V-10):** Higgs Avatar handles semi-3D-rendered stylized faces better than flat 2D line art. Make one reference per character in two styles and let the spike decide.
- Each actor ships: `ref.png` (avatar input), `cutout.png` (transparent puppet body for the 3D stage), `palette.json`.
- Art sourcing: hand-made, Blender, or commissioned. AI image generators = third-party tools → **only if V-01 allows**; if used, disclose in write-up.

## The cast

### Odile Marsh — the Keeper
- **Want:** to be left alone. **Hides:** grief. **Tell:** long pauses.
- **Voice:** calm, low, American English (`eleanor` or `nora`; pick by ear). Default delivery: `<|prosody:speed_slow|>`.
- **Tag palette:** contentment, sadness, contemplation, determination; `<|prosody:pause|>`, `<|prosody:long_pause|>`, `<|sfx:sigh|>Ahh`.
- **Face behavior:** minimal; slow blinks; looks away on sadness lines.
- **Under direction:** "angrier" → `<|emotion:anger|>` + shorter pauses; "heartbroken" → `<|emotion:sadness|><|prosody:speed_slow|>` + `<|sfx:sniff|>`.
- **Language habit:** stays English unless directed.

### Rocco "Nine-Lives" Vega — the Smuggler
- **Want:** to charm his way out. **Hides:** he's scared of storms. **Tell:** laughs too early.
- **Voice:** `jake`-like, energetic. Default `<|emotion:amusement|>`.
- **Tag palette:** amusement, enthusiasm, elation, pride; `<|sfx:laughter|>Haha`, `<|prosody:speed_fast|>`.
- **Language habit:** **code-switches naturally (English/Spanish)** inside a sentence — the star of the code-switch beat.
- **Under direction:** "scared" → `<|emotion:fear|>` + the laugh cracks (`<|sfx:laughter|>Ha— ha…`).

### Pim — the Apprentice
- **Want:** to be useful. **Hides:** nothing, badly. **Tell:** whispers when nervous.
- **Voice:** `chloe` with `<|prosody:pitch_high|>`; fast when nervous.
- **Tag palette:** fear, surprise, awe, relief; `<|style:whispering|>`, `<|sfx:sniff|>Sff`, `<|sfx:sneeze|>Achoo`.
- **Under direction:** "calm down" → `<|reset|>` then `<|emotion:relief|>`.
- **Language habit:** always English — the **control** that proves the others switched, not the whole scene.

### Wren — the Stage Manager (Booth, Realtime voice, no face)
- **Role:** the director's only live conversational partner. Dry, efficient, loyal. Speaks short acknowledgements ("Rolling." "Cutting. Odile, from the top of the line?") and runs tools.
- **Why off-stage:** saves an avatar slot (capacity is limited), reinforces theatre, and keeps Realtime's voice distinct from the cast.
- **Behavior rules:** never longer than two sentences; announces what it is about to change *before* the tool call (this is where tool-call-while-speaking is visible); asks at most one clarifying question; never argues with a "Cut!".

## Behavior contract (applies to all actors)
1. **Instant stop.** On `speech_started` the actor freezes mid-phoneme; face holds a micro-expression of "listening" for ≤1 s.
2. **Resume protocol.** After a note, the actor re-performs *only the interrupted line* unless the director says "from the top".
3. **Stay in character.** Notes change delivery, not identity: voice stays, vocabulary may shift.
4. **Idle presence.** Between lines actors breathe (3D sway), blink on a timer, and glance toward whoever speaks.
5. **No overlap.** One actor speaks at a time except designated "talk-over" beats (P2).

## Scene pack (authored, JSON)
`content/scenes/lighthouse.json` — schema (agent finalizes in `packages/shared`):
```json
{
  "id": "lighthouse",
  "title": "The Lighthouse at Gull Point",
  "lines": [
    { "id": "l1", "actor": "odile", "lang": "en", "tags": ["emotion:contentment","prosody:speed_slow"], "text": "The glass has been dark since March. Nobody asked why." },
    { "id": "l2", "actor": "rocco", "lang": "en", "tags": ["emotion:amusement"], "text": "Ha. Nobody asks anything out here, Captain, that's why I like the place." }
  ],
  "variants": { "es": { "l2": "…" } },
  "cues": [{ "at": "l4", "tool": "change_set", "args": { "effect": "storm" } }]
}
```
Rules: ≤300 chars per line (timestamp limit); every sfx tag followed by onomatopoeia; English lines first, Spanish variants hand-written for the demo path. Other languages in the live demo rely on V-37 results.

## Story of the project for the write-up (draft)
"We asked what happens if the thing voice AI is worst at — being interrupted — becomes the interface. Directors interrupt actors for a living. CUT! makes a voice-directed table read: you talk, three animated actors perform, and a single word stops them mid-syllable."
