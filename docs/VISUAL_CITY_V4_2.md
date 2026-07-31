# RepoCity V4.2 — Asset-Backed Chicago Visual Fidelity Proof

> **FAILED VISUAL BASELINE — structurally improved, visually not accepted**

V4.1 established useful street topology, a continuous semantic address map and a separated visual-context layer. Its final image is rejected because it still reads as a low-poly tabletop model. V4.2 changes the visible-asset and rendering strategy for one compact hero composition only. Citywide rollout is explicitly out of scope until the five final review cameras receive user approval.

## V4.1 failure audit

The fixed failure views are:

- `docs/screenshots/visual-v4-2/before/overview.png`
- `docs/screenshots/visual-v4-2/before/street.png`
- `docs/screenshots/visual-v4-2/before/glass.png`
- `docs/screenshots/visual-v4-2/before/river-bridge.png`

Visible causes:

1. Hero shells, windows, roofs and immediate context are assembled from runtime boxes.
2. Facade relief is an accumulation of thin colored cuboids rather than authored wall/window modules.
3. Brick is a tiny procedural color texture without normal, roughness or AO data.
4. Stone, roof membrane, concrete and asphalt differ mostly by flat hue and scalar roughness.
5. Glass has a small synthetic reflection texture per material but no coherent scene environment.
6. Storefront labels float over generic dark openings; doors, thresholds and shallow interiors are not composed as readable shops.
7. The overview camera is too high and exposes the scene as a bounded model.
8. Near context is made of large featureless slabs and fog is doing too much composition work.
9. River water is continuous in data, but its banks, railings, abutments and surface response do not convincingly read as an urban waterway.
10. Sparse round trees are nearly the only reliable human-scale cue.

## Baseline renderer

| Property | V4.1 value |
| --- | --- |
| camera | perspective, FOV 42°, near 0.1, far `max(480, radius × 18)` |
| review bookmarks | overview `[-88.895,43.677,49.293] → [-33.656,3.2,-9.8]`; river `[-46.247,30.831,33.877] → [0,2.4,-9.8]`; street `[-58.577,7.708,14.131] → [-31.6,2.1,0]`; glass `[-38.738,23.9,2.239] → [-67,7.2,-19.6]` |
| output color space | SRGBColorSpace, supplied by installed React Three Fiber defaults |
| tone mapping | ACESFilmicToneMapping, supplied by installed React Three Fiber defaults |
| antialiasing | WebGL antialias on, DPR 1–1.5 |
| lights | Sky; hemisphere; ambient; one directional sun; optional night point light |
| sun | time-of-day position; intensity `0.18 + daylight × 2.35` |
| shadows | directional, 1024² map, dynamic orthographic bounds, bias −0.00028 |
| scene environment | none |
| contact/AO pass | none |
| post-processing | none |
| fog | near `max(35, radius × 1.65)`; far `max(110, radius × 5.2)` |
| visible asset loading | none; all hero geometry is runtime-created |
| committed GLB size | 0 bytes |

Read-only renderer instrumentation was added before the asset replacement. In the 1280×720 in-app browser at camera 1, V4.1 measured 41 draw calls, 315,550 triangles, 48 geometries, 5 textures, 19 programs and a smoothed 8.29 ms / 119.6 FPS. The FPS is a browser/render-loop observation near the display ceiling, not a hardware-independent benchmark.

## Hero proof location

The proof uses exactly two adjacent bridge-facing blocks within the existing V4.1 west-bank hero district. Five principal visible buildings are composed from existing architectural envelopes:

- riverfront glass/lobby building;
- historic Fulton brick commercial building;
- limestone/Chicago School office;
- International Style curtain-wall office;
- vertical-fin mixed old/new composition;
- optional civic entrance/bridge-facing building where framing permits.

Twelve storefront/public entrance bays are deliberately composed. The other four V4.1 hero blocks and every city block beyond them remain on the old renderer and are not upgraded by this proof.

## Implemented asset architecture

### Reproducible source

`scripts/generate-city-kit.mjs` authors original Three.js scenes and exports deterministic GLB files. It is the source of truth; committed GLBs are reproducible build artifacts. No external mesh or texture is downloaded. The exporter merges geometry by module and material while preserving the named module roots required by the loader.

### Kit layout

```text
public/assets/city-kit-v1/
  masonry-modules.glb
  office-modules.glb
  curtain-wall-modules.glb
  storefront-modules.glb
  street-river-modules.glb
  textures/
    city-material-atlas.*
scripts/
  generate-city-kit.mjs
app/lib/
  asset-city.ts
app/components/city/
  AssetBackedHero.tsx
```

The modules use modeled profiles: inset reveals, sills, lintels, pilasters, parapets, cornices, mullions, spandrels, fins, entrance recesses, canopies, doors, warm interior cards, fire escapes, river walls, railings and bridge abutments. Street modules include parked cars, bicycles, benches, planters, bollards, hydrant/bin utilities, lamps, signals, a transit shelter and static pedestrians. Plain boxes remain allowed only as hidden semantic hit targets, the temporary selection envelope and far LOD silhouettes.

### Loading and failure behavior

- `useGLTF` loads and caches the shared kit;
- a visible Suspense/loading marker identifies asset loading;
- an error boundary shows an explicit diagnostic plaque if a GLB is missing or invalid;
- the hero does not silently revert to the V4.1 box shell;
- semantic hit targets remain separate, stable and available for selection.

## PBR material architecture

The original asset generator will create shared materials and a compact authored texture set for:

1. warm red brick;
2. dark aged brick;
3. limestone/warm stone;
4. concrete;
5. weathered painted metal;
6. dark structural steel;
7. clear/smoked curtain glass;
8. asphalt;
9. sidewalk concrete/paving;
10. river-wall concrete/masonry;
11. roof membrane/gravel/metal.

Color maps use SRGB; normal, roughness and AO data use linear color space. Textures tile with mipmaps and anisotropy. Materials are shared by family at load time and cloned only where GLB instances need independent render state. The authored texture set is 11,119 bytes; it is intentionally compact procedural PBR source rather than downloaded photogrammetry.

## Semantic versus visual layers

| Layer | Repository meaning | Interaction |
| --- | --- | --- |
| semantic city, blocks, envelopes and routes | authoritative | existing hit targets and evidence styling |
| visible GLB hero shells | stable projection of existing semantic envelopes | clicks resolve through envelope-to-semantic mapping |
| facade modules, shops, roofs | architectural parts of mapped shell | parent semantic result or pass-through |
| parked cars, bikes, benches, signs, people | non-evidence `VISUAL CONTEXT` | excluded from raycasts/counts |
| near/far context buildings | non-semantic framing | excluded from raycasts/counts |
| Flow route tokens | evidence-backed scenario only | existing exact route behavior |

The 244 entity addresses and journey routes 8, 9 and 10 must remain byte-stable in semantic snapshots. No ambient traffic simulation will be added.

## Asset provenance and licensing

All V4.2 kit assets are original repository-authored output. Rules and inventory live in `docs/assets/city-kit-v1-manifest.md`. No real brands, landmark copies, downloaded game assets or unknown-license texture sources are permitted.

## Implementation result

1. Recorded the failed baseline and measured it before replacement.
2. Authored five reproducible GLBs plus 32 compact PBR maps.
3. Replaced only two adjacent blocks with five mapped buildings and twelve shop bays.
4. Added environment lightformers, soft PCF shadows, one-frame contact shadows, lower cameras and restrained fog.
5. Added continuous river walls/railings, bridge abutments and static non-semantic street context.
6. Preserved hidden semantic hit targets; visible asset clicks and camera 5 resolve to the original entity.
7. Merged generated meshes by material, reducing the pre-optimization V4.2 draw-call count from 771 to 116.
8. Completed three review passes at five fixed cameras.

## Fixed review cameras

| Key | Review purpose |
| --- | --- |
| `1` | low oblique hero composition |
| `2` | river, bridge deck, walls, rails and abutments |
| `3` | masonry commercial street and storefront depth |
| `4` | curtain-wall structure and environment response |
| `5` | semantic selection; selects the mapped limestone building |

## Visual review rounds

All paths below are repository-relative and were captured at 1280×720 with the HUD hidden.

### Round 1 — asset loading proved, composition rejected

Screenshots: `docs/screenshots/visual-v4-2/round-1/{hero,street,glass,river,selection}.png`

Defects found: the buildings were dispersed across five blocks; the camera still advertised the tabletop boundary; old tree bulbs dominated human scale; near context occluded asset facades; masonry side elevations lacked a complete window rhythm; metal/base-color multiplication made frames nearly black. Fixes: isolated the proof, added side bays, introduced coherent environment lighting, stopped multiplying metal base color, removed generic proof-area vegetation and lowered the cameras.

### Round 2 — compactness improved, camera and asset organization rejected

Screenshots: `docs/screenshots/visual-v4-2/round-2/{hero,street,glass,river,selection}.png`

Defects found: five buildings across six cleared blocks made empty planning pads; close cameras could enter unupgraded buildings; brick scale was oversized; selection used an unreadable debug-style wireframe; individual lintels/windows produced 771 draw calls. Fixes: reduced the proof to two adjacent blocks, moved cameras onto known road/river corridors, increased texture repeat by family, replaced triangle wireframe with outer edges and merged generated geometry per module/material.

### Round 3 — final proof

Screenshots: `docs/screenshots/visual-v4-2/round-3/{hero,street,glass,river,selection}.png`

The final pass verifies five distinct building systems, twelve storefront bays, side elevation detail, a continuous river edge, bridge depth, static street context, environment response and direct semantic selection. Known limitation: the unupgraded near/far context still uses V4.1 LOD masses and remains visibly simpler. This is deliberate scope containment, not a claim that the whole city has reached the proof's fidelity.

## Performance baseline

| Metric | V4.1 baseline |
| --- | ---: |
| hero GLB download | 0 B |
| committed hero textures | 0 B |
| draw calls | 41 |
| triangles | 315,550 |
| geometries | 48 |
| textures | 5 |
| programs | 19 |
| frame time / FPS | 8.29 ms / 119.6 |
| load time | not applicable to external hero assets |

| Metric | V4.2 final |
| --- | ---: |
| committed GLB payload | 1,414,088 B |
| committed PBR textures | 11,119 B |
| draw calls | 116 |
| triangles | 255,636 |
| geometries | 123 |
| textures | 33 |
| programs | 33 |
| frame time / FPS | 8.30 ms / 120.2 |
| external asset load time | not instrumented / not claimed |

Both measurements use the same in-app browser, 1280×720 viewport, HUD-hidden camera 1 and a settled development render loop. V4.2 adds 75 draw calls and 28 textures while rendering 59,914 fewer triangles because two old hero blocks are replaced rather than overdrawn. Frame time is effectively unchanged at the display ceiling. Before exporter merging, V4.2 measured 771 calls / 783 geometries / 109.3 FPS; that failed optimization gate and was not retained.

## Approval gate

V4.2 stops after the isolated asset-backed proof. A passing build, asset count or screenshot set is not permission to upgrade the remaining city. User visual approval is the gate.
