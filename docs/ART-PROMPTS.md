# Original cast artwork

The human confirmed organizer permission for AI-generated character art on 2026-10-24. Created with the built-in image generation tool; no additional API key was needed. These are original fictional characters, with no real-person or franchise reference.

## Prompt set — generation, then transparent-background edit

Shared direction: premium handcrafted stop-motion storybook character, sculpted felt/clay, rounded expressive face, believable glass eyes, neutral closed mouth, front-facing medium bust in a 3:4 frame. Plain muted teal backdrop, warm key light and cool fill. No text, watermark, real person or franchise.

- Odile: warm mature keeper, gray wavy bob, brass spectacles, oxblood coat and cream knit.
- Rocco: warm olive skin, curly dark hair, hazel eyes, moustache, teal coat and orange scarf.
- Pim: ginger curls, green eyes, freckles, goggles on the head, yellow raincoat and teal scarf.

Each transparent edit removed only the teal backdrop, preserving identity, position, lighting and framing, with genuine alpha transparency.

## Saved project files

For each actor (`odile`, `rocco`, `pim`):

- `content/characters/<actor>/avatar-v2.png`: portrait reference for real Higgs Avatar generation.
- `content/characters/<actor>/cutout-v2.png`: transparent stage art.
- `apps/web/public/characters/<actor>/portrait.png` and `cutout.png`: browser assets.

All are 1086 × 1448 PNGs. Earlier `ref.png` files are procedural spike inputs, retained for reproducibility. The previous spike video used that earlier art; new cast videos use `avatar-v2.png`. A still image does not establish animation quality; assess the real cached clips separately.

## Scene continuity references — built-in generation

Generated one shared 16:9 master from the three original identity portraits. Prompt: keep the same premium tactile stop-motion identities/wardrobe; seat Odile left with a letter, Rocco right speaking with a restrained open-hand gesture, Pim between them tending a lantern; one lighthouse sitting room, sea chart and mugs, warm practical light/cool rainy window fill, seated-eye-level camera, visible bodies/hands/grounded boots, no viewer-facing portrait arrangement or UI.

Then generated one 3:4 complete-frame reference per actor using the master plus their original identity. Prompt set: preserve face, clothing, seat, props and lighting; single actor seated from knees/mid-thigh upward, room included, neutral closed mouth, mouth/eyes visible, Odile and Pim looking across toward Rocco, Rocco looking toward Odile. No transparency or solid-color screen. Requested shallow turns; actual references include stronger three-quarter angles and still require motion validation.

Saved assets:

- `content/storyboard/gull-point/master-v1.png`
- `content/characters/{odile,rocco,pim}/avatar-scene-v1.png`
- Browser copies: `apps/web/public/scenes/gull-point/{master,odile,rocco,pim}-v1.png`

These are new sibling assets. The original `avatar-v2.png` inputs and their cached outputs remain available. After the human approved this direction, one Odile motion test and the six-line scene were rendered with these references. The clips preserve seated-body context; they do not establish controllable body blocking or reliable off-camera gaze. No additional API key was used for built-in image generation.

## Additional chapter artwork — built-in generation

The tavern and observatory chapters each have a shared scene master generated with the built-in image-generation tool. Both used the three fictional cast members' `content/characters/<actor>/avatar-v2.png` files as identity references. The tavern prompt intent was a storm-night inn meeting centered on the sealed letter and silver coin. The observatory prompt intent was a ruined mountain star room where the cast tries a lantern signal toward home. The masters are saved at `content/storyboard/tavern/master-v1.png` and `content/storyboard/observatory/master-v1.png`, with browser copies at `apps/web/public/scenes/tavern/master-v1.png` and `apps/web/public/scenes/observatory/master-v1.png`.

Nine landscape character references were generated from the corresponding scene master and each actor's `avatar-v2.png` identity reference. The shared portrait direction keeps each fictional character waist-up, with a clear near-frontal face and visible eyes, while carrying the scene's light and setting into the frame. Lighthouse, tavern, and observatory source references are `content/characters/<actor>/avatar-lighthouse-landscape-v1.png`, `content/characters/<actor>/avatar-tavern-landscape-v1.png`, and `content/characters/<actor>/avatar-observatory-landscape-v1.png`, respectively, for each of `odile`, `rocco`, and `pim`. Browser copies are `apps/web/public/scenes/<scene>/<actor>-landscape-v1.png` for `gull-point`, `tavern`, and `observatory` and the same three actors. The lighthouse source scene name remains `gull-point` in the browser path. These files are reference artwork; they do not by themselves establish animation quality or controllable gaze. No additional API key was used for built-in image generation.

## Listening shots for participation mode

Built-in image generation edited each approved master into a matching listening illustration. Prompt intent: preserve the three characters, clothes, relative positions, room, props, light and wide 16:9 framing; turn all heads and pupils toward the camera as though the viewer is a fourth friend opposite the table. Relaxed closed mouths and attentive expressions; no added person, microphone or text. These are still images, not generated gaze motion.

| Source reference                               | Final source asset                                | Browser copy                                          |
| ---------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `content/storyboard/gull-point/master-v1.png`  | `content/storyboard/gull-point/listening-v1.png`  | `apps/web/public/scenes/gull-point/listening-v1.png`  |
| `content/storyboard/tavern/master-v1.png`      | `content/storyboard/tavern/listening-v1.png`      | `apps/web/public/scenes/tavern/listening-v1.png`      |
| `content/storyboard/observatory/master-v1.png` | `content/storyboard/observatory/listening-v1.png` | `apps/web/public/scenes/observatory/listening-v1.png` |

The default generated originals remain in the local image-generation output directory; the app uses the project-local copies above.
