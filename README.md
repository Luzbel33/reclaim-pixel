# Reclaim · A Century After Us

Inspired by **[Post Humans by @zzzzshawn](https://x.com/zzzzshawn/status/2116436345082302946)**. Shawn’s piece is where the idea for this recreation came from: one floating city block, with a slider to watch it age. **[Play the original on Forge](https://forge.ui8.ai/share/frag_704ba1d5-05f4-44bf-bc62-34322dfaa1e1)**.

Reclaim is my independent interpretation, built iteratively with Codex. It follows one block from 2026 to 2126: people cross the square, parts of buildings fall into the street, and ferns take root upstairs. Drag the timeline backward to put it all back.

**[Play Reclaim](https://luzbel33.github.io/reclaim-pixel/)** · [Watch 100 years in 18 seconds](https://luzbel33.github.io/reclaim-pixel/media/reclaim.mp4) · [Copy the prompt](#reproduction-prompt) · [Comparison protocol](BENCHMARK.md)

## Reproduction prompt

This is the consolidated brief from our iterations, not a transcript of a single prompt. Give a model the [original interactive reference](https://forge.ui8.ai/share/frag_704ba1d5-05f4-44bf-bc62-34322dfaa1e1) and the following text:

~~~text
Reference: Post Humans by @zzzzshawn
https://forge.ui8.ai/share/frag_704ba1d5-05f4-44bf-bc62-34322dfaa1e1

Build an interactive isometric pixel-art city inspired by the reference. Keep its small
floating block, muted palette, clean background and year slider. Use original Canvas 2D
drawing code and a fixed seed; no image assets, sprites, models or external services.
Keep hard pixel edges at a native width of 376–512 pixels.

Let me move through 2026–2126 in either direction. Show people walking, traffic and a
working fountain early on; later, show wildlife and trees with dimensional crowns rooted
outside the buildings. Keep the same streets, buildings and landmarks throughout.

Some buildings must fail locally. Preserve the height of surviving floors. Split real
walls, slabs and roof sections into rigid pieces, show them fall and leave persistent
rubble. After a room opens and its debris settles, let vegetation grow on a supported
floor. Rewinding must restore both the structure and the plant life exactly.

Provide 360° orbit, vertical camera tilt, zoom, pan, keyboard controls, play/pause and
reduced motion. Dragging down raises the camera; dragging up lowers it. Deliver the
working demo in English, the source, a short film and reproducible evidence.
~~~

![The same isometric pixel city in 2026 and 2126: the busy market square becomes a wooded block with a torn-open tower.](media/cover.png)

## Look closer

- **2056 · The old brickworks.** Mortar splits along the edge of the pitched roof. The roof tiles and masonry land in different places.
- **2074 · East apartments.** A footing gives way. Look down into the missing corner: the floors next door still sit at their original height.
- **2100 · The transfer floor.** A failure partway up the tower travels into the wing above. Pause on a slab in flight, then scrub back and follow the same slab again.
- **2126 · Succession.** Moss, ferns and climbing ivy occupy the newly exposed floors. The large trees are rooted outside the buildings.

![One camera on the tower in 2088, 2100 and 2126: the intact facade, the corner breaking into rigid pieces, and the open rooms colonized by plants.](media/fracture-study.png)

## Controls

| Action          | Input                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| Visit a year    | Drag the timeline, use its arrow keys, or press Play                          |
| Orbit and tilt  | Drag sideways to orbit; drag **down** to raise the camera, **up** to lower it |
| Zoom / pan      | Scroll or pinch to zoom; Shift + drag to pan                                  |
| Keyboard camera | Focus the scene. ← → rotate, ↑ ↓ change elevation, + / − zoom, Home resets    |
| Day / night     | Use the sun in the top right                                                  |

## Run it

Download the repository and open **`index.html`** in a modern browser. There is no install, build step or network request to draw the city. The finished film is included in `media/`; the interactive page does not download it at startup.

The city is drawn to a **480 × 360 Canvas 2D**. Streets, people, foliage and facades come from code. A fixed seed builds the load paths once. A failed bay releases pieces of its original walls, floors or roof; each rotates in flight and keeps its resting place. Ambient time drives pedestrians, birds and water separately from the year. This is an artistic model of decay, not a structural engineering simulation.

| Source        | Responsibility                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `city.js`     | Pixel rasterizer, world layout, projection, actors and foliage                                                                                                                                |
| `fracture.js` | Support graph, fracture geometry, landings and conditions for interior growth                                                                                                                 |
| `masonry.js`  | Facade materials, exposed rooms, airborne pieces, dust and plants                                                                                                                             |
| `app.js`      | Timeline, camera gestures, keyboard input and reduced motion                                                                                                                                  |
| `studio/`     | [Ten reproducible field checks](https://luzbel33.github.io/reclaim-pixel/studio/checks.html) and a [frame-by-frame film renderer](https://luzbel33.github.io/reclaim-pixel/studio/index.html) |
