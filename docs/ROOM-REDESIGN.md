# Conversation room redesign

The previous renderer placed portrait planes on chairs and rotated them as though they were bodies. This cannot produce a convincing side view. The room also changed in response to isolated words, breaking continuity.

## Composition

Build a single keeper's sitting room. Odile and Pim occupy armchairs angled toward a shared coffee table; Rocco sits on the back sofa. Keep the floor at zero and furniture/people in the same scale. The room needs a readable window, rug, upholstered furniture, shelves, practical lamp, and modest personal objects. Avoid decorative neon, floor selection rings and hover enlargement.

Use a warm lamp against a cool sea window, soft contact shadows, matte plaster and fabric, restrained brass and wood. Keep faces readable. The room should feel occupied rather than a showroom of unrelated objects.

A three-quarter establishing view includes all three people, their seats, and the table. Speaker changes shift the framing slightly without crossing the conversation axis or orbiting the group. Listener heads turn toward the speaker within anatomical limits; bodies remain anchored to their seats. Pause freezes animation; reduced motion removes ambient motion.

## Characters and model integration

Replace all portrait planes with real modeled geometry: seated bodies, bent limbs, hands, shaped heads, eyes, hair, and character-specific clothing. Use one deliberate miniature/clay art direction. This is a stylized implementation, not photoreal people or a claim of a production facial rig.

Higgs Avatar MP4s are animated 2D portraits. They do not contain skeletons, geometry or facial blend shapes. Keep the saved outputs and speech playback intact, but do not stretch a portrait video across a modeled face. True phoneme animation requires a rig with supported mouth shapes and alignment data; an audio envelope can drive jaw opening, with that limitation disclosed.

## Continuity and validation

Locations change through explicit director selection or explicit scene metadata, never incidental keywords such as “fine” or “count.” Keep the authored lighthouse conversation in one room. Other available sets reuse the same seating geometry so scene changes preserve spatial relationships.

Verify build, types, lint and existing tests. Inspect the browser at conversation and pause states, confirm limbs/furniture contact, readable faces, no cards, no abrupt turns, and record observed FPS. No new paid generation is necessary for this redesign.

## Implementation review — 2026-10-24

The room and cast now use actual geometry. The room keeps one seating layout across three manually selected palettes. Removed incidental-word scene switches and kept the authored rehearsal in the lighthouse. Listener yaw uses speaker positions with a bounded neck pivot. Local cached WAV RMS at 30 Hz controls mouth opening against the playing media's current time; it introduces no provider request and does not modify audio routing. Failed local decoding leaves the mouth closed.

Chrome visual review confirmed all three seated people, furniture, table and window in the same shot. Corrected window/wall overlap, chair directions, head pivot, camera height, and caption placement after inspecting the rendered result. Inspector showed 60 FPS in this spot check. Clicking CUT showed the held state; this is not a measured mic-to-silence latency test. No microphone session or paid generation was started for this redesign.

This remains a stylized procedural cast. Skin, cloth, hair, hands and facial articulation are simpler than authored production character assets. The next asset-quality step is three compatible rigged GLB characters with expressive facial blend shapes and seated animation clips, preserving this room and playback interface. Avatar MP4s cannot supply those meshes. Do not describe the current result as photoreal or phoneme-accurate.

Local validation: 44 tests passed, lint/typecheck/format checks passed, production build passed with the existing large Three.js chunk advisory. Secret-pattern scan passed. These checks do not establish subjective art quality or full microphone behavior.
