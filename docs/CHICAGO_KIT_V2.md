# Chicago Kit v2

Chicago Kit v2 is RepoCity's deterministic, full-city architectural language for the v0.2 development line. It replaces the semantic core's generic stretched envelopes and the context rings' blank slabs with fitted modular facades while leaving repository facts, ownership, roads, blocks, addresses, Living Streets, Flow, and Replay unchanged.

This document is an art bible and implementation contract. It does not announce a v0.2 release.

## Baseline audit

The pre-change renderer combined five complete City Kit v1 hero roots with procedural envelopes elsewhere. Only two adjacent blocks received asset-backed fidelity. The 72 core architectural envelopes and 326 context buildings therefore mixed detailed proof assets with repeated box silhouettes. Context rings used low-detail bodies, and finished hero roots were scaled to envelopes. Architecture could be read as a tabletop model rather than a city formed across eras.

Baseline captures are in `screenshots/chicago-kit-v2/before/`. On the fixed 1920×1080 Explore overview, the renderer reported median values of 178 draw calls, 283,298 triangles, 169 geometries, 34 textures, 37 programs, and a 21.31 ms sampled frame time. Flow reported 256 draw calls, 289,156 triangles, 237 geometries, 35 textures, 43 programs, and 27.99 ms. These figures are browser/GPU snapshots, not universal performance claims.

Relevant implementation surfaces before v2 were `urban-fabric.ts`, `visual-city.ts`, `asset-city.ts`, `SemanticMetropolis.tsx`, the City Kit v1 generator, and the existing semantic/ambient renderers. City Kit v1 remains intact as an auditable prior asset set.

| Baseline planning fact | Value |
| --- | --- |
| City Kit v1 asset payload | 1,691,674 bytes |
| Visual-city plan p95, 100 runs | 0.892 ms |
| Semantic architectural envelopes | 72 |
| Context buildings | 326 |
| Existing family distribution | Chicago masonry 17; Miesian 2; blue-green 17; bronze 4; Fulton 6; narrow rows 12; Art Deco 4; civic 4; riverfront 6 |
| Active ground floor / Fulton | 70.995% / 71.995% |
| Landmark ratio | 1.389% |

## Enforceable art direction

The city must appear to have evolved over several architectural periods. Architecture is selected from:

```text
zone + era + frontage + corner + waterfront + massing + deterministic seed
```

Component identity, software role, component display color, file count, churn, and dependency weight are not primary architecture selectors. Software meaning remains legible through Semantic Lens, labels, inspector data, selection overlays, and restrained semantic accents.

Global prohibitions:

- no single facade grammar or single red brick across the city;
- no all-blue glass skyline;
- no majority of stretched podium towers or flat-box roofs;
- no decorative asset may become a repository entity, evidence relationship, or search result;
- no copied landmark or third-party game asset;
- no uncontrolled randomness or frame-loop regeneration.

### District languages

| Zone | Required architectural reading |
| --- | --- |
| Fulton Market | 3–10 story warehouse and narrow infill fabric; broad punched windows, masonry piers, loading traces, parapets, cornices, adaptive-reuse shops, and rare contemporary insertions. |
| Loop Core | Chicago School masonry, limestone and terra-cotta offices, strong base/middle/top, vertical bays, articulated corners, prewar street walls, and selective Art Deco setbacks. |
| River North / Miesian Core | Dark expressed steel, smoked neutral glass, structural grids, public lobbies, restrained blue-green office walls, and selective slabs. |
| Riverfront / Contemporary | Podium-and-tower massing, river-facing terraces, stepped tops, transparent lower levels, and blue-green, neutral, or bronze curtain walls without copying a real tower. |
| Civic Anchor | Rare institutional limestone/terra-cotta or restrained Art Deco, a public entrance, formal base, and deliberate roofline within the existing landmark cap. |

Zones must differ by geometry, facade rhythm, base, corner, and silhouette—not hue alone.

## Modular architecture

Nine families share a named module grammar: base/ground floor, three repeatable middle rhythms, two corners, an end wall, a setback shoulder, three roof/top treatments, a roof house, and optional crown. Every ordinary family also has two deterministic material/age states.

The generator at `scripts/generate-city-kit-v2.mjs` emits nine original GLB catalogs to `public/assets/city-kit-v2/`. The runtime compiles the same module grammar into instanced unit boxes grouped by 18 PBR material batches. GLBs are the inspectable source catalog; the compiled representation avoids one scene graph per facade part.

The v2 catalog payload is 1,558,326 bytes. It is additive during Draft review: City Kit v1 is deliberately not removed until v2 is accepted.

One world unit remains approximately three metres. Floor count, bay count, residual pier width, podium height, and setbacks are derived discretely. A completed facade is never blindly stretched to an envelope. Maximum measured dimension deviation in the standard demo is 31.9%, below the documented 34% fitting tolerance.

Three curtain-wall geometries are structural, not palette aliases:

- `miesian-expressed-grid` — equal structural bays with strong horizontal and vertical grid;
- `unitized-vision-spandrel` — alternating vision panels and explicit spandrel bands;
- `bronze-vertical-fins` — deeper vertical fins and restrained horizontal joints.

## Deterministic signature pipeline

`planChicagoKitV2` produces one `BuildingVisualSignature` for each architectural envelope before rendering. A signature records family, era, rhythm, base, corner, roof, material set, curtain-wall system, fitted dimensions, three LOD identities, and batching key. Its spatial seed deliberately excludes component identity and component color.

An adjacency pass works along actual primary-street groups. It prevents an exact neighboring signature, immediate rhythm repetition, and more than two consecutive buildings in one family. The standard demo currently measures 18.75% same-family adjacent pairs, below the 35% ceiling.

## Context LOD and street level

- Core envelopes use LOD0 facade, corner, base, storefront, entrance, roof, and crown modules.
- Ring 1 uses family-based LOD1 bodies, window bands, vertical piers, bases, and tops.
- Rings 2–3 use deterministic family silhouettes, material sets, and roof treatments.
- All 326 context buildings remain non-semantic and unselectable.
- Every planned storefront receives a visual shop, lobby, gallery, service, or entrance treatment. This raises visual ground-floor program coverage to 82% citywide and 78% in Fulton without creating software facts.

Living Streets continues to use the pre-existing validated public-frontage and lane network. Decorative entrances do not alter route ownership or introduce diagonal fallbacks.

## Standard-demo inventory

| Measure | Result |
| --- | ---: |
| Core envelopes / v2 signatures | 72 / 72 |
| Context buildings | 326 |
| Facade families visible | 9 |
| Curtain-wall geometries | 3 |
| Roof/top variants | 22 |
| Corner variants | 16 |
| Ground-floor program families | 8 |
| Exact adjacent duplicates | 0 |
| Immediate rhythm repeats | 0 |
| Maximum same-family run | 2 |
| Landmarks | 1.389% |
| Blank context fallbacks | 0 |
| Compiled module boxes | 23,641 |
| Instanced material batches | 18 |
| Planner p95, 100 deterministic seeds | 1.137 ms |

Family use is intentionally uneven: ordinary Chicago masonry and narrow commercial fabric dominate, while bronze modernism and landmarks stay selective.

## Visual checkpoint and limitations

Representative UI-hidden captures for Fulton, Loop, Miesian, and Civic architecture are in `screenshots/chicago-kit-v2/checkpoint/`. They passed the implementation checkpoint because each shows a different base/middle/top and facade rhythm, corners are articulated, windows remain proportioned, and glass is geometrically distinct from masonry.

This remains a stylized public-alpha renderer. Materials are procedural PBR colors rather than photogrammetry; interiors are shallow warm cards; small facade elements simplify at overview distance; and context rings intentionally have less street-level detail than the core. The work aims for coherent Chicago-inspired identity, not photo-realism or a landmark replica.

Owner art-direction acceptance is intentionally pending. See [the review record](CHICAGO_KIT_V2_REVIEW.md), [asset manifest](assets/city-kit-v2-manifest.md), and [visual system](visual-system.md).

## Fixed-view performance

The following 15-sample measurements use the same Chrome session, 1920×1080 viewport, public-alpha overview camera, and machine as the baseline. They are comparative development diagnostics, not hardware-independent promises.

| Mode | Metric | Before | Chicago Kit v2 | Change / target |
| --- | --- | ---: | ---: | --- |
| Explore | Median-smoothed frame time | 21.31 ms | 8.31 ms | −61.0%; within +15% ceiling |
| Explore | Draw calls | 178 | 46 | below preferred 200 |
| Explore | Triangles | 283,298 | 375,102 | below preferred 650,000 |
| Explore | Geometries / textures | 169 / 34 | 61 / 6 | shared instancing reduced both |
| Flow | Median-smoothed frame time | 27.99 ms | 12.27 ms | −56.2%; within +15% ceiling |
| Flow | Draw calls | 256 | 152 | below preferred 230 |
| Flow | Triangles | 289,156 | 379,000 | below preferred 650,000 |
| Flow | Geometries / textures | 237 / 35 | 156 / 8 | no per-building texture growth |

The renderer spends additional triangles on facade grids, fitted windows, corners, roof forms, and Ring-1 bands, while instancing reduces draw calls and memory objects substantially. No asset or signature count grows across repeated Explore/Map/Flow/Replay switches.
