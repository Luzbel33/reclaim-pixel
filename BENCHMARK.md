# The reversible city test

Can a model keep a tiny world spatially consistent while its buildings fall apart?

Use [the original post](https://x.com/zzzzshawn/status/2116436345082302946) and the same two [reference](https://forge.ui8.ai/share/frag_704ba1d5-05f4-44bf-bc62-34322dfaa1e1) views, 2026 and 2066, for every run. Those are the reference's actual endpoints. This recreation continues through 2126.

## Prompt

> Build an interactive isometric pixel-art city inspired by the reference. Keep its small floating block, muted palette, clean background and year slider. Use original Canvas 2D drawing code and a fixed seed; no image assets, sprites, models or external services. Keep hard pixel edges at a native width of 376–512 pixels.
>
> Let me move through 2026–2126 in either direction. Show people walking, traffic and a working fountain early on; later, show wildlife and trees with dimensional crowns rooted outside the buildings. Keep the same streets, buildings and landmarks throughout.
>
> Some buildings must fail locally. Preserve the height of surviving floors. Split real walls, slabs and roof sections into rigid pieces, show them fall and leave persistent rubble. After a room opens and its debris settles, let vegetation grow on a supported floor. Rewinding must restore both the structure and the plant life exactly.
>
> Provide 360° orbit, vertical camera tilt, zoom, pan, keyboard controls, play/pause and reduced motion. Dragging down raises the camera; dragging up lowers it. Deliver the working demo in English, the source, a short film and reproducible evidence.

## Comparison rules

Start each model in a fresh folder. Record the displayed model label, tools, time budget, number of turns and human corrections. Evaluate first attempts separately from revised builds. Compare the same year and camera with ambient motion held still. Record unknown costs or routing as unknown.

| Gate               | What to inspect                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Visual fidelity    | Compare matching 2026 and 2066 scenes at the same displayed size. Judge silhouette, pixel edges, detail and atmosphere separately.               |
| Spatial continuity | Follow a street corner while orbiting and tilting. Occlusions and visible facades should change; buildings should stay on their lots.            |
| Failure            | Follow an individual piece from its source wall to the ground. A surviving wing should keep its elevation, with actual voids in the failed wing. |
| Biology            | Trees start outside buildings. Interior plants appear only after the containing bay opens and the supporting floor is exposed.                   |
| Reversibility      | With ambient motion frozen, compare the PNG before and after a trip to 2126 and back. Repeat for a full orbit.                                   |
| Life and controls  | Watch actors walk while the year is paused. Try touch or mouse, keyboard, zoom, camera reset and day/night.                                      |
| Film               | Decode the clip, check its frame count and timestamps, and inspect the fracture in motion.                                                       |

[Run the field checks](https://luzbel33.github.io/reclaim-pixel/studio/checks.html) or open `studio/checks.html` locally. They test the rendered pixels and the actual generated geometry: support order, partition area, rigidity in flight, landing bounds and the onset of interior growth. The film renderer submits 576 individually timed frames at 24 fps.

This release was developed iteratively with Codex, including feedback about pixel style, trees, population, collapse and camera direction. It is not a one-shot run or a measured comparison between models.
