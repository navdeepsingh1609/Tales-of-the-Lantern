# Story direction and uses for CUT!

The strongest current use is an interactive table read: a writer can hear the same words with different delivery, rewrite a held line, or step into a scene to discover what the cast does with a new idea. Keep the cinematic player central; avoid adding separate chat dashboards or unrelated demo modes.

## What makes it a story

- **A situation with an objective and stakes.** Each chapter now declares what the characters want, what can go wrong, and who the player is. These enter the model context and are available under “Your part.”
- **Character continuity.** Voices, roles, relationships and prior contributions should persist. The app carries recent authored lines plus recent user/cast turns; it does not claim a full world simulation.
- **Agency and consequence.** Replies should act on the user’s suggestion instead of merely acknowledging it. A three-character exchange lets one person answer, another challenge or develop the idea, and a third move the situation forward while leaving the player an opening.
- **Pacing.** Scene changes, listening, reaction shots and speech need different rhythms. Speech uses generated clips; silent reaction clips cover preparation waits. A stopped performance must not continue generating automatically.
- **A finish.** An exchange should reach a meaningful stopping point. The current three-turn beat ends by handing initiative back to the user. Explicit persistent quest flags and authored alternate endings remain future work.

This direction is informed by inkle’s primary documentation on choices, conditional story state and continuity. The recommendation to prioritize consequential choices is an inference from that design approach, not a claim that CUT! embeds Ink. [Writing interactive fiction with ink](https://www.inklestudios.com/ink/web-tutorial/), [Ink overview](https://www.inklestudios.com/ink/).

## Useful next applications

| Use                                    | Why this interaction fits                                                | What a proper version would need                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Narrative/game writing table reads     | Compare rewrites and delivery before recording actors                    | Save/export scene versions and a take list                                        |
| Conversational language practice       | Join a fictional group with a goal instead of answering isolated prompts | Validated language support, level controls and optional feedback                  |
| Facilitated collaborative storytelling | The cast develops participants’ ideas and returns initiative             | Facilitator controls, clear turn ownership and consent for recordings             |
| Presentation or negotiation rehearsal  | Try another wording or delivery and observe a contextual response        | Domain-specific scenarios and honest performance feedback; no unsupported scoring |

Table reads are the recommended primary use for the hackathon. They directly exercise expressive delivery, facial performance, interruption and revision. Language practice and rehearsal are possible future uses, not features advertised as finished today.

## Visual honesty

The lantern is an original lightweight SVG inspired by the supplied brass hurricane-lantern reference, not a WebGL scene. Emoji marks select discrete moods rather than claiming a numerical emotion intensity. Idle clips are real Avatar generations driven by silent audio; subtle motion was inspected in a close-up, but specific blinks, nods and body actions are not direct API controls or guaranteed outcomes.
