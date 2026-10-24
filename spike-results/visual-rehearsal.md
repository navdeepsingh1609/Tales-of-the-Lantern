# Offline visual rehearsal — 2026-10-24

Environment: user's Mac, native Google Chrome, local Vite dev server at `127.0.0.1:5173`. This is an offline geometry/interaction test with no generated media.

| Check                | Observed result                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Page render          | Closed pleated curtains, warm footlights, title and controls visibly rendered            |
| Inspector keyboard H | Opened; reported no Higgs connection and no generated media                              |
| Open curtain         | Button changed to Close curtain; gathered side curtains revealed the cast and window set |
| Storm                | Toggle became active; stage status changed to WEATHER CUE · STORM                        |
| Actor framing        | Odile became In focus; scene description changed to her role                             |
| Cut motion           | Inspector became Held; stage controls became disabled; Resume motion remained available  |
| Render sampling      | Inspector showed 59–60 fps in these spot checks, including storm mode                    |

Reset was also verified: it restored closed curtains, calm weather and no actor focus. The initial desktop viewport put direction controls below the fold; the stage height was reduced to make those controls easier to reach. The human independently said the preview seemed okay.

Limits: no sustained frame-time benchmark, no real video textures, no MSE/audio playback, no microphone, no actual Higgs interruption, no Safari/Firefox verdict. Initial Chrome/Safari automation attempts timed out; the subsequent Chrome retry worked. No paid API calls were made.
