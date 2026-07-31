# RepoCity V4.1 — Chicago Visual Reality Vertical Slice

Status: implemented on `agent/urban-fabric-v4` for visual approval. This pass deliberately stops at one connected 2×3 district. It does **not** generalize the new kit to the other twelve semantic blocks.

## Outcome

V4.1 replaces the previous “model on an isolated green board” presentation with one river-oriented Chicago vertical slice:

- six connected semantic blocks form the hero district beside an existing bridge;
- one continuous river corridor passes below the existing bridge geometry and continues through the visual world;
- three rings of non-semantic city context prevent the core from ending at the camera frame;
- six deliberately different facade systems include three structurally different curtain walls;
- masonry, glazing, backing interiors, mullions, piers, spandrels, cornices, awnings, storefronts, signs, roof equipment and fire escapes create readable near/mid/far layers;
- Explore is the quiet default; Flow adds only the current evidence-backed route and its scenario token;
- context buildings never carry repository identity and never register selection handlers.

The goal is not photorealism. The goal is a useful, legible city metaphor that can survive a street-level camera without becoming columns, factory sheds or disconnected parcels.

## Scope lock

The hero selector deterministically chooses the west-bank rows nearest the existing bridge, then takes all three columns. For fixture seed `visual-71c0990c` the six roles are:

| Semantic block | Grid | Visual role | Primary V4.1 facade system |
| --- | ---: | --- | --- |
| `block-b2de990c` | 0,0 | riverfront bridge gateway | blue-green unitized glass |
| `block-b3de9a9f` | 0,1 | Loop masonry street wall | limestone bay wall |
| `block-b4de9c32` | 0,2 | modern glass corner | Miesian black grid |
| `block-a958a70b` | 1,0 | Fulton market A | warehouse brick |
| `block-a858a578` | 1,1 | Fulton market B | Chicago School terra cotta |
| `block-ab58aa31` | 1,2 | civic podium/tower | bronze vertical fins |

These are visual roles, not new repository facts. The 24 architectural envelopes inside the hero district still point to existing semantic building containers. Storefronts, facade pieces and roof equipment remain decoration and cannot become selected entities.

## Semantic boundary

| Layer | Meaning | Selectable | May carry repository IDs/evidence |
| --- | --- | ---: | ---: |
| semantic blocks/buildings | component-first repository geography | yes | yes |
| hero architectural envelopes | real-looking subdivision of an existing semantic building | through parent building | parent mapping only |
| facade/storefront/roof pieces | architectural detail | no | no |
| context blocks/buildings/roads | visual continuity outside the repository city | no | no |
| Flow route and token | one selected deterministic journey | route evidence only | yes |

The visual-context runtime objects use only `contextId`; they contain no `entityId`, `componentId`, relation IDs or evidence fields. Rendering them does not install hover/click callbacks. The existing 244 entity addresses and projected route mapping remain unchanged.

## World scale

V4.1 uses **1 world unit = 3 metres**.

- semantic half-block: 18 × 14 units = 54 × 42 m;
- local street: 3.4 units = 10.2 m, two lanes;
- collector: 4.2 units = 12.6 m, two lanes;
- arterial: 5.2 units = 15.6 m, four lanes;
- river: 10 units = 30 m;
- typical facade floor module: 1.04–1.25 units = 3.12–3.75 m;
- hero ground-floor datum: about 2.25 units = 6.75 m for storefront/sign/canopy depth and legibility.

The river is a single corridor from Z −107.8 to +107.8. Bridges remain evidence-backed semantic streets; the longer water and surrounding fabric are visual context.

## Visual systems

### Masonry

The masonry families use a deterministic procedural bond texture rather than a downloaded asset. Windows sit in dark inner cards behind piers and spandrels. Loop limestone, terra cotta and Fulton brick use different bay widths, floor heights, cornices and massing. Fulton receives exterior fire-escape platforms and active storefront rhythm.

### Curtain walls

The three curtain walls are structurally different rather than palette swaps:

1. **Miesian black grid** — regular dark mullions and floor spandrels;
2. **blue-green unitized glass** — lighter unitized panels and pale frame hierarchy;
3. **bronze vertical fins** — projected fins over the panel/mullion layer.

Each uses separate glass, inner backing, frame and massing layers. A small procedural equirectangular city/sky texture provides environment response without adding a dependency or external asset.

### Ground floor and roof

The hero district has 48 active storefronts. Awnings, recessed glazing, one readable sign per hero block, entrances, trees and road markings establish human scale. Selected role buildings receive distinct tower height, roof houses and equipment; non-hero blocks retain the previous V4 fabric.

## Explore and Flow

- **Explore** is the default. It renders the semantic metropolis without dependency beams, journey beacons or ambient simulated traffic.
- **Flow** reuses exactly the same city. It adds `FlowJourneyLayer` routes projected through the existing semantic/urban address map.
- No vehicle, pedestrian, boat or crowd is created merely to make a screenshot busy. Scenario tokens are the only moving cohort.
- Planning runs in memoized pre-render functions. The frame loop only animates material time, camera interpolation and authorized route tokens.

## Fixed acceptance cameras

All final views use a perspective camera, FOV 42°. Keys 1–4 recall the four deterministic visual bookmarks; the values below were recorded from the accepted screenshot run.

| Key/view | Camera position | Orbit target | Evidence |
| --- | --- | --- | --- |
| 1 · overview | `[-88.895, 43.677, 49.293]` | `[-33.656, 3.200, -9.800]` | `after-overview.png` |
| 2 · river/bridge | `[-46.247, 30.831, 33.877]` | `[0.000, 2.400, -9.800]` | `after-river-bridge.png` |
| 3 · Fulton street | `[-58.577, 7.708, 14.131]` | `[-31.600, 2.100, 0.000]` | `after-fulton-street.png` |
| 4 · glass facade | `[-38.738, 23.900, 2.239]` | `[-67.000, 7.200, -19.600]` | `after-glass-facade.png` |
| Flow overview | `[-88.895, 43.677, 49.293]` | `[-33.656, 3.200, -9.800]` | `after-flow-mode.png` |

## Screenshot evidence

Baseline:

- [`before-overview.png`](screenshots/visual-v4-1/before-overview.png)
- [`before-river.png`](screenshots/visual-v4-1/before-river.png)
- [`before-street.png`](screenshots/visual-v4-1/before-street.png)

Final:

- [`after-overview.png`](screenshots/visual-v4-1/after-overview.png)
- [`after-river-bridge.png`](screenshots/visual-v4-1/after-river-bridge.png)
- [`after-fulton-street.png`](screenshots/visual-v4-1/after-fulton-street.png)
- [`after-glass-facade.png`](screenshots/visual-v4-1/after-glass-facade.png)
- [`after-flow-mode.png`](screenshots/visual-v4-1/after-flow-mode.png)

## Screenshot review pass 1

Evidence: [`pass-1-overview.png`](screenshots/visual-v4-1/pass-1-overview.png), [`pass-1-street.png`](screenshots/visual-v4-1/pass-1-street.png), and the corrected [`pass-1-fixed-overview.png`](screenshots/visual-v4-1/pass-1-fixed-overview.png).

| Criterion | Finding | Correction |
| --- | --- | --- |
| 1. Perspective/framing | fail: east-bank ordinary buildings hid the hero district and the frame cropped the city | moved the camera to the hero district’s southwest and increased orbit distance |
| 2. Six-block readability | fail: the wrong bank dominated | camera target now biases toward the west-bank hero and river edge |
| 3. Continuous river | pass structurally; weak in framing | added a dedicated river bookmark centered on the corridor |
| 4. Bridge approach | weak | river view targets the existing semantic bridge, not an invented crossing |
| 5. City context | pass: three rings removed the hard world edge | added context grid roads so background buildings sit in fabric, not on one slab |
| 6. Massing hierarchy | weak: facade roles changed but base heights still followed old zones | role buildings gained controlled tower extensions and roof equipment |
| 7. Masonry depth | partial | added procedural bond, piers, spandrels, cornices and backing cards |
| 8. Glass depth | partial | separated inner card, panel, frame and reflected environment layers |
| 9. Storefront readability | fail at overview | increased deterministic sign legibility and added recessed fronts/awnings |
| 10. Overlay dominance | pass in Explore | kept routes/beacons absent until Flow is explicitly chosen |

## Screenshot review pass 2

Evidence: [`pass-2-overview.png`](screenshots/visual-v4-1/pass-2-overview.png) and final views.

| Criterion | Finding | Correction/result |
| --- | --- | --- |
| 1. Perspective/framing | pass: core fills the frame without clipping its whole shape | final overview frozen as key 1 |
| 2. Six-block readability | pass | the foreground reads as one connected 2×3 district |
| 3. Continuous river | pass | one 30 m corridor crosses the full context depth |
| 4. Bridge approach | pass | bridge remains aligned to semantic street geometry |
| 5. City context | pass with intentionally lower detail | 114 context blocks, 326 buildings and 37 context roads form three rings |
| 6. Massing hierarchy | pass, but revealed blank tower backs | wrapped structured facade systems around all four sides of hero volumes |
| 7. Masonry depth | pass at Fulton bookmark | brick bond, inset glazing, piers and cornices survive the low camera |
| 8. Glass depth | pass for vertical slice | three curtain variants show different frame hierarchies and inner depth |
| 9. Storefront readability | initially oversized at close camera | reduced sign distance scale and lowered Fulton camera to street datum |
| 10. Overlay dominance | pass | final Explore images are quiet; Flow screenshot alone shows the exact route |

## Deterministic metrics

- hero blocks: 6, connected;
- hero architectural envelopes: 24;
- hero storefronts: 48/48 active;
- facade systems: 6;
- curtain-wall systems: 3;
- context: 3 rings, 114 blocks, 326 buildings, 37 roads;
- continuous visual river segments: 1;
- estimated unused generic ground: 8%;
- complete semantic fabric retained: 72 architectural envelopes, 212 massing volumes, 143 storefronts;
- full-fabric frontage coverage: 94.042%; street-wall gap: 5.958%.

## Verification contract

Focused tests cover:

- deterministic planning independent of input order;
- exactly six connected hero blocks;
- three context rings with no semantic/evidence/selection fields;
- every hero envelope mapping to an existing semantic building;
- entity-address and bridge-route preservation;
- six facade systems, three curtain walls and one continuous river;
- hero/context quantitative acceptance thresholds;
- explicit pre-render planning policy.

## Approval gate and next step

This is the requested stopping point. Do not propagate the hero kit to the remaining twelve blocks until the overview, river/bridge, Fulton street, glass facade and Flow screenshots receive visual approval. If approved, a later phase can generalize role selection and facade grammar without changing the semantic/context boundary established here.
