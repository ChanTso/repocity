# Chicago Kit v2

Chicago Kit v2 is RepoCity's deterministic, full-city architectural language for the v0.2 development line. It replaces the semantic core's generic stretched envelopes and the context rings' blank slabs with fitted modular facades while leaving repository facts, ownership, roads, blocks, addresses, Living Streets, Flow, and Replay unchanged.

This document is the art bible and implementation contract for the Chicago Kit v2 system released in v0.2.0.

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

Nine families share a named module grammar: two base/ground-floor variants, three repeatable middle rhythms, two real street-corner treatments, exposure-aware end/party/rear walls, and three roof/top treatments. Every ordinary family also has two deterministic material/age states. Variant names are accepted only when they resolve to a canonical numeric recipe, and every recipe produces a distinct local-space geometry fingerprint.

`app/lib/chicago-kit-v2-definition.json` is the single canonical module source. Both the runtime compiler and `scripts/generate-city-kit-v2.mjs` consume it. The generator emits nine original GLB reference catalogs to `public/assets/city-kit-v2/`; their exact root maps and recipe fingerprints are checked against runtime definitions in CI. The GLBs are explicitly tooling/reference artifacts. Runtime recipes compile into material-and-primitive instanced batches using shared box, reveal, oriel, curtain-panel, corner, cornice, crown, awning, and context-facade geometries instead of one scene graph per facade part.

The corrected v2 catalog payload is 1,970,652 bytes. City Kit v1 remains as the original reusable hero-slice catalog and compatibility reference; v2 supplies the full-city architectural system.

One world unit remains approximately three metres. Floor count, bay count, residual pier width, podium height, and setbacks are derived discretely. A completed facade is never blindly stretched to an envelope. Maximum measured dimension deviation in the standard demo is 31.9%, below the documented 34% fitting tolerance.

Three curtain-wall geometries are structural, not palette aliases:

- `miesian-expressed-grid` — equal structural bays with strong horizontal and vertical grid;
- `unitized-vision-spandrel` — alternating vision panels and explicit spandrel bands;
- `bronze-vertical-fins` — deeper vertical fins and restrained horizontal joints.

## Deterministic signature pipeline

`planChicagoKitV2` produces one `BuildingVisualSignature` for each architectural envelope before rendering. A signature records family, era, rhythm, base, corner, roof, material set, curtain-wall system, fitted dimensions, three LOD identities, and batching key. Its spatial seed deliberately excludes component identity and component color.

An adjacency pass works along actual primary-street groups. It prevents an exact neighboring signature, immediate rhythm repetition, and more than two consecutive buildings in one family. The standard demo currently measures 18.75% same-family adjacent pairs, below the 35% ceiling.

## Real LOD, exposure, and street level

- LOD0 uses full facade rhythms, base openings, storefronts, entrances, mullions, spandrels, the selected corner pair, and full roof topology.
- LOD1 uses simplified city-scale facade bands, bases, major corners, and reduced roof topology; it contains no storefront, detailed window, mullion, awning, or spandrel modules.
- LOD2 uses distant massing and a family-specific top silhouette only.
- Precompiled tiers switch independently for each 28-world-unit spatial chunk using stable `52 / 145` world-unit thresholds with a seven-unit hysteresis band. Ring 1 cannot fall below LOD1. Geometry is never planned or rebuilt in the frame loop.
- The selected semantic building is removed from regular tier batches and rendered once at LOD0, preserving accurate inspection without duplicate instances.
- Primary and secondary street walls receive the full facade. Shared party walls receive no windows, rear/service walls remain restrained, exposed ends use sparse end-wall treatment, and corner modules are emitted only at the real primary/secondary street intersection.
- All 326 context buildings remain non-semantic and unselectable.
- Every planned storefront receives a visual shop, lobby, gallery, service, or entrance treatment. Measured from the actual compiled opening widths, active frontage is 88% citywide and 87.9993% in Fulton without creating software facts.

Living Streets continues to use the pre-existing validated public-frontage and lane network. Decorative entrances do not alter route ownership or introduce diagonal fallbacks.

## Standard-demo inventory

| Measure | Result |
| --- | ---: |
| Core envelopes / v2 signatures | 72 / 72 |
| Context buildings | 326 |
| Facade families visible | 9 |
| Curtain-wall geometries | 3 |
| Distinct compiled building fingerprints | 72 |
| Distinct compiled rhythm fingerprints | 72 |
| Distinct compiled base fingerprints | 72 |
| Distinct compiled roof fingerprints | 65 |
| Distinct compiled corner fingerprints | 72 |
| Ground-floor program families | 8 |
| Exact adjacent duplicates | 0 |
| Immediate rhythm repeats | 0 |
| Maximum same-family run | 2 |
| Landmarks | 1.389% |
| Blank context fallbacks | 0 |
| Compiled LOD0 / LOD1 / LOD2 modules | 15,236 / 4,403 / 1,496 |
| Runtime batching | per spatial chunk, material, and shared primitive |
| Planner p95, 100 deterministic seeds | 1.4836 ms |
| Three-tier compiler p95, 20 fixed-fixture runs | 139.937 ms |

Family use is intentionally uneven: ordinary Chicago masonry and narrow commercial fabric dominate, while bronze modernism and landmarks stay selective.

## Visual checkpoint and limitations

The failed Owner package remains in `screenshots/chicago-kit-v2/review-fixes/` as history. The accepted corrective baseline is in `screenshots/chicago-kit-v2/owner-recheck/`; final release media is in `docs/media/`. Every image is made from real renderer pixels, not generated concept art.

This remains a stylized public-alpha renderer. Brick, stone, concrete, and metal now use separate small shared deterministic sRGB albedo and linear height maps sampled in world space, with one cached pair per material rather than per building. Translucent office glass reveals shallow warm interior cards; small facade elements simplify at overview distance; and context rings intentionally have less street-level detail than the core. The work aims for coherent Chicago-inspired identity, not photo-realism or a landmark replica.

Owner art-direction acceptance is intentionally pending. See [the review record](CHICAGO_KIT_V2_REVIEW.md), [asset manifest](assets/city-kit-v2-manifest.md), and [visual system](visual-system.md).

## Corrective-pass performance status

The prior fixed-view table described the rejected visual implementation and is not reused as evidence for this corrective pass. Current deterministic checks confirm 15,236 / 4,403 / 1,496 precompiled modules, a 139.937 ms three-tier compiler p95 on the fixed fixture, stable repeated builds, and no signature or instance-count growth across mode switches. Material maps, materials, and non-box primitive geometries are cached and shared; no per-building textures or frame-loop planning were introduced. Fresh GPU-specific draw-call and frame-time claims are intentionally deferred until Owner visual re-check rather than mixing old measurements with new pixels.
