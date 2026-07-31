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

Draw calls, triangles, geometries, textures, frame time and FPS were not exposed by the baseline page. They are therefore **not measured**, not estimated. V4.2 will add read-only renderer instrumentation before asset replacement so the same browser and camera class can provide an honest comparison. Loading time is likewise not claimed for a scene with no external hero asset.

## Hero proof location

The proof uses a smaller composition within the existing V4.1 west-bank hero district: the bridge-facing intersection and river edge around the deterministic six-block selection. Four to six principal visible buildings will be composed from existing architectural envelopes:

- riverfront glass/lobby building;
- historic Fulton brick commercial building;
- limestone/Chicago School office;
- International Style curtain-wall office;
- vertical-fin mixed old/new composition;
- optional civic entrance/bridge-facing building where framing permits.

Approximately eight to twelve storefront/public entrances will be deliberately composed and camera-readable. The other V4.1 blocks remain on the old renderer and are not upgraded by this proof.

## Proposed asset architecture

### Reproducible source

`scripts/generate-city-kit.mjs` will author original Three.js scenes and export deterministic GLB files. The generator is the source of truth; committed GLBs are build artifacts that can be reproduced without Blender. No external mesh or texture will be downloaded.

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

The modules use modeled profiles: inset reveals, sills, lintels, pilasters, parapets, cornices, mullions, spandrels, fins, entrance recesses, canopies, doors, river walls, railings and bridge abutments. Plain boxes remain allowed only as hidden semantic hit targets and far LOD silhouettes.

### Loading and failure behavior

- `useGLTF` loads and caches the shared kit once.
- A visible Suspense/loading marker identifies asset loading.
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

Color maps use SRGB; normal, roughness, metalness and AO data use linear color space. Textures will tile or atlas with mipmaps and renderer anisotropy. Materials are shared by family rather than cloned per building.

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

## Implementation sequence

1. record this audit and failure baseline;
2. add renderer instrumentation and capture the V4.1 browser baseline;
3. author/export the original modular GLB kit and PBR maps;
4. implement deterministic asset placement for the compact hero composition;
5. configure environment response, contact shadows and lower review cameras;
6. add street/river assets and restrained static visual context;
7. map visible shells to existing semantic hit targets and lock route snapshots;
8. complete three rounds × five UI-hidden review cameras, fixing visible defects between rounds;
9. record final performance/asset size, validate and update Draft PR #3.

## Performance baseline

| Metric | V4.1 baseline |
| --- | ---: |
| hero GLB download | 0 B |
| committed hero textures | 0 B |
| draw calls | not exposed / not measured |
| triangles | not exposed / not measured |
| geometries | not exposed / not measured |
| textures | not exposed / not measured |
| frame time / FPS | not exposed / not measured |
| load time | not applicable to external hero assets |

This table will be updated from the same 1280×720 browser and fixed camera after read-only instrumentation is present.

## Approval gate

V4.2 stops after the isolated asset-backed proof. A passing build, asset count or screenshot set is not permission to upgrade the remaining city. User visual approval is the gate.

