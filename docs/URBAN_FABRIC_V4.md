# Urban Fabric V4 — Road-First Continuous City

Status: implementation record for `agent/urban-fabric-v4`

## Outcome

V4 replaces the visible “one component, one private campus” grammar with a
continuous, street-addressable city. Repository facts remain authoritative;
the new urban-fabric compiler only decides how those facts occupy shared urban
space.

The intended reading order is:

1. public street network;
2. blocks bounded by those streets and typed water;
3. street-facing parcels inside each block;
4. varied building envelopes on those parcels;
5. repository components distributed across connected groups of blocks;
6. files and modules addressable inside the resulting buildings.

This is deliberately a spatial rewrite, not a decorative pass. Ambient traffic,
extra boats or crowds, a new renderer, a HUD redesign, new dependencies, and
full room interiors are outside this phase.

## Verified baseline

The phase started from a clean `agent/urban-fabric-v4` at
`782a8843a4c2dd1bd99088a7c13c05c448a1ce74`, identical to `main`.

Baseline commands all passed:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run check`

Known baseline warnings are unchanged: a production chunk larger than 500 kB,
Vinext's unknown route-classification notice, and 15 npm audit findings (2 low,
13 high). Dependency and build cleanup are not part of V4.

The baseline overview is
[`urban-fabric-v4-before-overview.png`](./screenshots/urban-fabric-v4-before-overview.png).
It shows six color-coded, self-contained campuses with local perimeter roads,
large component-colored slabs, and mostly factory-like aggregate masses.

The browser automation sandbox does not expose `requestAnimationFrame` to page
evaluation, so a precise baseline frame-time sample was not available before
the spatial rewrite. Performance comparison therefore uses the same browser,
viewport, camera journey and production build, plus renderer instance/draw-call
proxies. Any inability to establish the requested 15% threshold numerically
will be reported rather than guessed.

## Why the current city reads as plots and factories

`planSemanticCity` currently performs two jobs at once: it clusters repository
facts and also assigns every component a rectangular `SemanticCampus`.
`componentAccessLoopPoints` then draws a private access loop around each campus.
`SemanticMetropolis` consumes those rectangles as lawns, plazas and aggregate
building kits, applying the component color across most of each compound.

That creates four structural problems:

- roads are consequences of components instead of public space that organizes
  them;
- component boundaries and physical block boundaries are identical;
- file slots are cells inside a compound instead of street addresses;
- typology is chosen once per component, so a component becomes one oversized
  object rather than a neighborhood made from several buildings.

Adding windows, vehicles or roof props cannot repair those relationships.

## Architecture boundary

`SemanticCityPlan` remains the semantic/evidence model. Its component IDs,
entity IDs, relation IDs, boundary facts, ports and journey tokens continue to
mean exactly what they mean today.

`UrbanFabricPlan` is a deterministic projection over that model. It owns only:

- shared street nodes and segments with primary, secondary and local hierarchy;
- public blocks and their adjacency graph;
- connected multi-block component assignments;
- parcels, street edges, frontage, setback and entrances;
- building envelopes, typologies, neutral materials and small semantic accents;
- entity-to-building and entity-to-entrance addresses;
- selection unions for all blocks occupied by a component.

No spatial choice is evidence of runtime traffic, occupancy, call frequency or
dependency direction. Typed water crossings and existing flow evidence keep
their current semantic authority.

## Deterministic planning pipeline

### 1. Terrain and water exclusions

Start from the semantic display envelope. Typed water boundaries reserve a
continuous canal/river exclusion. Land is divided into banks; blocks and ground
streets may not overlap water. Existing authorized quays and water routes are
preserved.

### 2. Shared road graph

Generate a small citywide hierarchy before placing any component:

- primary waterfront avenues establish the main north/south structure;
- secondary cross streets divide each bank into walkable blocks;
- local streets subdivide long blocks where needed;
- duplicate collinear edges are merged into one public street segment;
- bridge geometry exists only where the spatial plan explicitly marks a
  crossing and never invents a semantic dependency.

Street IDs and ordering derive from the repository seed and stable coordinates.
There is no `Math.random`.

### 3. Blocks and adjacency

Closed road faces become public blocks. Adjacency means sharing a traversable
street edge, not merely touching at a corner. The default repository target is
18 blocks—three connected blocks for each of six components—while the planner
must handle smaller and larger component sets deterministically.

Blocks are spatial containers, not component-colored plots. Their ground uses
one city material; component ownership is shown only through interaction and
small accents.

### 4. Connected component assignment

Components are sorted by a stable importance score and assigned two to four
connected blocks through deterministic region growth. The score balances:

- entity count and external reach;
- existing semantic bank/waterfront constraints;
- adjacency to related components as a soft layout cost;
- avoidance of isolated islands and single-component compounds.

One component may cross streets but may not teleport between disconnected
blocks. A block has one primary component assignment in V4; public streets and
waterfronts remain shared.

### 5. Street parcels and addresses

Each assigned block is subdivided from its street edges inward. Every occupied
parcel records a primary street edge, frontage segment, setback, entrance and
building envelope. At least 70% of occupied parcels must meet a genuine street
edge. Entrances target sidewalks, not campus centers.

Entities are distributed among buildings by stable hash and module/path group.
Their V4 address resolves to a component, block, parcel, building and entrance,
while retaining the legacy semantic address for compatibility and inspection.

### 6. Typology and skyline

V4 requires at least four geometrically distinct typologies in the default
fixture:

- narrow street building: slim frontage, repeated bays, modest height;
- perimeter/courtyard block: multiple wings enclosing a visible void;
- podium and tower: broad street podium with a set-back vertical mass;
- civic landmark: rare, broad public base with a distinctive roof/vertical
  marker;
- technical hall: optional and uncommon, low-span rather than universal
  factory language.

Height is derived from relative component reach and parcel role, then varied
within a bounded deterministic range. Primary streets and important nodes may
receive taller envelopes; secondary streets carry mid-rise fabric; waterfront
and local edges step down. No raw LOC extrusion is introduced.

Walls, roofs, glazing and streets use a neutral shared city palette. Component
colors are limited to entrance canopies, signage strips, beacons and temporary
selection overlays. No permanent component-colored ground plane is allowed.

## Interaction and semantic continuity

Hovering or selecting any building resolves its primary entity and component.
The renderer highlights the union of every block assigned to that component,
so selection communicates “this subsystem occupies these connected pieces of
the city” rather than “this tower is the subsystem.” Clicking still opens the
existing file inspector; export symbols, relations, history and focus behavior
remain intact.

Journey steps 8 (artifact entry), 9 (viewer/city control) and 10 (3D build site)
retain their token IDs, evidence and inspector destinations. Land legs may be
spatially projected onto the new public streets. Boat legs retain typed water
geometry. Reprojection changes only coordinates, never the meaning or weight of
a route.

## Required invariants and tests

Pure planner tests must establish:

- byte-stable output for reordered inputs;
- every component has two to four assigned blocks when the fixture has enough
  land;
- every component assignment is connected in the block adjacency graph;
- street IDs and block IDs are unique and stable;
- blocks do not overlap typed water;
- every occupied parcel is contained by its block and references a real street;
- at least 70% of occupied parcels have a primary edge on a real street;
- the default fixture exposes at least four genuine typologies;
- no building uses a component color as its dominant wall/roof material;
- every entity resolves to a valid building and entrance;
- a component selection resolves to all of its assigned blocks;
- journey steps 8, 9 and 10 resolve to valid V4 addresses without changing
  their evidence IDs or token counts.

The existing lint, typecheck, tests and production build remain mandatory.

## Visual and performance verification

The final comparison will use the same local browser and an equivalent overview
camera. Required captures are:

- before overview;
- after overview;
- after road/block close-up;
- after multi-block component selection;
- after building/file drill-down;
- after journey steps 8, 9 and 10.

The report will record renderer population (street segments, blocks, parcels,
building envelopes and instanced parts), production build size warnings, and a
same-browser smoothness observation. If frame timing can be instrumented without
changing product behavior, median frame time is accepted only when it is no
more than 15% above baseline; otherwise the measurement limitation and proxy
comparison remain explicit.

## Delivery sequence

1. Add the pure urban-fabric model and spatial invariant tests.
2. Feed V4 addresses into the existing scene and journey projection.
3. Replace campus-ground and campus-kit generation inside
   `SemanticMetropolis`; do not add a parallel renderer.
4. Add building-level hit targets and connected multi-block selection.
5. Validate steps 8/9/10, screenshots, performance proxies and all checks.
6. Commit in coherent slices, push `agent/urban-fabric-v4`, and open one focused
   draft PR. Do not merge it in this phase.

## Implementation result

V4 now compiles the current 244-file HEAD fixture into:

| Layer | Count |
| --- | ---: |
| semantic components | 6 |
| shared streets | 18 |
| typed-water bridges | 2 |
| public blocks | 18 |
| occupied parcels | 26 |
| building envelopes | 26 |
| entity addresses | 244 |

Every component occupies exactly three mutually connected blocks. All occupied
parcels have real frontage and a sidewalk entrance, so the measured default
frontage rate is 100%. The resulting building mix is eight narrow street
buildings, eight podium/towers, six perimeter/courtyard blocks, three technical
halls and one civic landmark. The civic and technical forms are therefore
exceptions rather than the city's default language.

The public street graph is generated before assignments and contains two
cross-bank bridge segments. Non-water fixtures receive equivalent ground
crossings rather than disconnected halves. Static repository relations still
do not create ambient vehicles: journey tokens are the only moving agents.

The existing `SemanticMetropolis` renderer now consumes `UrbanFabricPlan` in
Flow mode. It retains instanced facade/roof/glazing groups and uses one
instanced hit-target mesh for all 26 selectable envelopes; it does not create a
React node or draw call per window. Selection is an accent-colored perimeter
around the complete three-block assignment, never a permanently colored plot.

## Journey and interaction verification

Direct canvas picking was exercised against a courtyard building and resolved
to `packages/analyzer/blob-cache-23.ts`. Its existing inspector still showed
the summary, two export symbols, three relations, metrics, history, source link
and Diff link.

Repository journey steps 8, 9 and 10 were each selected through the real UI:

- step 8 resolved `Project Bundle 入城港` to
  `apps/web/project-loader-05.ts` and retained its static Bundle / Artifact
  water-boundary evidence;
- step 9 resolved `Viewer 城市调度中心` to
  `apps/web/timeline-03.ts` and retained its response token cohort;
- step 10 resolved `三维施工现场` to
  `packages/renderer/city-scene-01.ts` and retained its scene-build evidence.

Land legs visibly followed local streets, waterfront primaries and bridges.
Boat legs retained their evidence-authorized semantic points. The spatial
projection changes no journey ID, token ID, evidence ID, provenance, weight or
inspector destination; this is also covered by the V4 integration test.

## Final visual record

- [before overview](./screenshots/urban-fabric-v4-before-overview.png)
- [after overview](./screenshots/urban-fabric-v4-after-overview.png)
- [road and block close-up](./screenshots/urban-fabric-v4-road-block-closeup.png)
- [multi-block selection](./screenshots/urban-fabric-v4-multi-block-selection.png)
- [building/file drill-down](./screenshots/urban-fabric-v4-building-drilldown.png)
- [journey step 8](./screenshots/urban-fabric-v4-journey-step-08.png)
- [journey step 9](./screenshots/urban-fabric-v4-journey-step-09.png)
- [journey step 10](./screenshots/urban-fabric-v4-journey-step-10.png)

## Verification and performance report

The first V4 delivery suite covered 72 application-library tests, including
eight new V4 invariants, plus all workspace and rendered-HTML tests. Lint, typecheck,
unit tests, production build and rendered-HTML tests pass. The existing Vinext
route-classification and greater-than-500-kB chunk warnings remain unchanged.

The same in-app browser, viewport, daylight preset and deterministic journey
were used for before/after observation. Orbiting, following journey steps,
switching steps and building picking remained responsive with no visible stalls.
The render population is bounded to 18 street ribbons, 26 envelopes grouped by
shared instanced material/part categories, and one instanced 26-item hit target.

The requested numeric “median frame time no more than 15% above baseline” could
not be established: the browser automation evaluation sandbox did not expose
`requestAnimationFrame`, and the baseline was recorded before a page-side frame
probe existed. This is an explicit unverified performance assumption, not a
claim that the 15% threshold passed. The available same-browser observation,
bounded scene counts, retained instancing, production build and unchanged chunk
warning are the recorded proxies. A future benchmark should add a renderer-level
probe before both comparison builds so the threshold can be measured honestly.

## Chicago Fabric & Street Commerce Corrective Pass

### Why the first V4 image was still a campus model

The road-first topology was correct, but the visible projection still treated
the 26 semantic building containers as 26 literal buildings. The standard
fixture therefore had a median of one frontage unit per block, 24.5% street
edge coverage, a 75.5% street-wall gap and no modeled storefronts. Repeated
cyan strips changed the surface, not the urban relationship.

This corrective pass uses Chicago Loop, the Chicago River / River North and
Fulton Market as one generative reference system: continuous orthogonal street
walls, bridges embedded in downtown, historic masonry beside steel-and-glass
construction, active commercial bases and restrained skyline clusters. It
does not reproduce Chicago's map, landmarks or real businesses.

### Three-layer contract

The implementation now keeps three explicit layers:

1. The semantic repository layer remains authoritative for 244 visible files,
   six components, symbols, dependencies, evidence and journeys.
2. The spatial city layer projects those facts into streets, blocks, semantic
   building complexes, frontage parcels, architectural envelopes and volumes.
3. The structural urban-program layer adds non-evidentiary storefronts,
   lobbies, awnings, canopies and fictional signs. They never enter semantic
   counts or intercept repository selection.

The existing 26 `UrbanBuildingEnvelope` values remain semantic address
containers. The 72 `UrbanArchitecturalEnvelope` values are readable physical
buildings sharing those containers. Their 213 massing volumes provide base,
shoulder, shaft, setback, crown and roof-house composition. This increases
density without returning to one file per building or inventing filler files.

### Character zones and perimeter subdivision

`UrbanBlock.characterZone` is assigned from stable spatial context, not
component color:

- **Loop Core**: continuous office walls, Miesian grids, Chicago School
  masonry and selective setbacks.
- **River North**: terrace mid-rises, corner towers and glass/metal/masonry
  bases framing the typed river and bridge approaches.
- **Fulton Market**: lower brick warehouses, narrow storefront rows,
  loading-bay retail rhythm and occasional glass additions.
- **Civic Anchor**: one importance-supported public block with a symmetrical
  entrance and a single true landmark envelope.

Each block is split into four deterministic corner/frontage parcels. Paired
north/south and east/west frontages form a continuous perimeter while a narrow
paved cross preserves a service alley/courtyard. Envelopes are distributed
across the block's real semantic building complexes. Tiny repositories apply
the rule only to blocks with a semantic building; visible volumes may multiply,
but evidence-bearing buildings are never fabricated. An empty semantic city
produces no decorative repository buildings.

Architecture varies with zone, corner, river proximity and stable seed. A seed
override changes architecture while preserving component blocks and file
addresses. There is no uncontrolled `Math.random`; plan generation remains
pure, serializable and memoized by semantic input in the application.

### Massing, facade and commerce grammar

The fixture exercises ten massing profiles and nine geometric facade families:

- Chicago School masonry office;
- Miesian steel-and-glass grid;
- blue-green contemporary curtain wall;
- bronze vertical-fin modernism;
- Fulton brick warehouse;
- narrow storefront row;
- Art Deco setback composition;
- civic / institutional frontage;
- riverfront terrace building.

The renderer keeps shared instanced groups for shells, wings, roofs, glazing,
accents and details. Punched masonry bays, piers, industrial spandrels,
cornices, terrace slabs and parapets create geometric differences rather than
enum-only styles. No React component or unique material is created per window.

The curtain-wall kit provides smoked glass with a dark Miesian grid,
blue-green panels with light framing, and bronze/charcoal panels with stronger
vertical fins. Mullions, floor spandrels, panel bays, double-height commercial
bases and roof screens reuse shared primitive geometry. Upper panels avoid
expensive per-window transparency; warm emissive glazing is shared at night.

The non-semantic commerce layer contains 143 storefront/lobby instances from
ten categories: corner café, bookshop, neighborhood grocer, design studio,
music room, bakery, repair shop, gallery, restaurant and hotel lobby. Curated
fictional labels such as “Canal Cafe”, “Lake Books” and “Grid Studio” exist only
in this layer. Glazing, fascia signs, awnings, blade signs and entrances align
to real frontage edges.

Primary architecture uses shared brick, terra-cotta, limestone, concrete,
dark metal, bronze and blue-green glass. Component colors are absent from wall,
roof, ground and curtain-wall material slots; they remain limited to selection
perimeters and evidence highlights.

### Morphology metrics and results

Metrics are pure spatial calculations in `urban-fabric.ts`:

- frontage coverage = qualifying architectural frontage / developed perimeter;
- street-wall gap = one minus coverage after the deliberate service gap;
- active ground floor = active storefront/lobby width / eligible frontage;
- generic lawn ratio = untyped core grass / developable block area;
- adjacent diversity compares facade, material, cornice band and massing/roof,
  counting pairs with at least two differences;
- landmark ratio = tagged landmarks / architectural envelopes.

| Metric | First V4 projection | Corrective result |
| --- | ---: | ---: |
| streets / bridges / blocks | 18 / 2 / 18 | 18 / 2 / 18 |
| semantic building complexes | 26 | 26 |
| architectural envelopes | 26 | 72 |
| massing primitives / volumes | 86 estimated | 213 planned |
| facade/storefront instances | cyan strips / 0 | 6,038 / 143 |
| median frontage units per block | 1 | 4 |
| citywide frontage coverage | 24.5% | 89.4% |
| citywide street-wall gap | 75.5% | 10.6% |
| active ground floor | 0% | 71.0% |
| Fulton active ground floor | 0% | 72.0% |
| generic core lawn | 7.4% | 0% |
| diverse adjacent pairs | not modeled | 94.4% |
| landmark share | 3.8% of semantic envelopes | 1.4% of architecture |

| Zone | Blocks | Frontage | Gap | Active ground floor |
| --- | ---: | ---: | ---: | ---: |
| Loop Core | 5 | 90.0% | 10.0% | 72.0% |
| River North | 6 | 90.0% | 10.0% | 72.0% |
| Fulton Market | 6 | 88.2% | 11.8% | 72.0% |
| Civic Anchor | 1 | 90.0% | 10.0% | 54.0% |

### Semantic and route invariants

All 244 visible files still resolve to a component, semantic building complex,
parcel and sidewalk entrance. Architectural envelopes reference real semantic
building IDs; storefront IDs never appear in `entityAddresses`. Selecting an
envelope resolves the semantic building's primary file. Component selection
highlights all three connected blocks and all 12 visible envelopes associated
with that component. The inspector still exposes module/file metadata,
relations, history and export symbols.

Journey steps 8, 9 and 10 retain IDs, labels, evidence IDs, station order,
token cohorts and semantic endpoints. Land coordinates remain projected to the
public road and bridge graph; the typed artifact boat leg retains its authorized
water points. The corrective pass adds no traffic, crowd, boat or runtime
activity simulation.

### Performance and measurement limits

For the exact 244-visible-file fixture, 200 warmed Node runs of the complete
spatial plus facade planner measured 1.805 ms median, 3.067 ms p95 and 5.439 ms
maximum. The serializable plan is 261,473 bytes. Static detail remains grouped
into existing instanced material layers plus one instanced 72-envelope hit
target; planning runs only when semantic input or seed changes.

A development probe exposes draw calls, triangles, programs, frame time and
city population through `window.__REPOCITY_RENDER_METRICS__` in a normal
browser. The in-app automation evaluation realm again lacked a page
`requestAnimationFrame` and could not see the page's window property. A valid
fixed-camera median frame time, draw-call and triangle sample could not be
collected, so the requested 15% frame-time target is **not claimed**. Production
build, rendered-web tests and bounded instance counts are supporting checks,
not a replacement for the missing comparison.

### Visual iteration record

All images use the same 1280×720 in-app browser viewport:

- [corrective before](./screenshots/chicago-corrective-before-overview.png)
- [pass A — density and street wall](./screenshots/chicago-corrective-pass-a.png)
- [pass B — facades and storefronts](./screenshots/chicago-corrective-pass-b.png)
- [pass C — materials and night hierarchy](./screenshots/chicago-corrective-pass-c.png)
- [final default overview](./screenshots/chicago-corrective-final-overview.png)
- [river and bridge corridor](./screenshots/chicago-river-bridge-corridor.png)
- [Loop street canyon](./screenshots/chicago-loop-street-canyon.png)
- [Fulton Market commerce](./screenshots/chicago-fulton-market-street.png)
- [curtain-wall close view](./screenshots/chicago-curtain-wall-close.png)
- [multi-block selection](./screenshots/chicago-selected-component.png)
- [building/export drill-down](./screenshots/chicago-building-symbol-drilldown.png)
- [preserved evidence journey](./screenshots/chicago-evidence-journey.png)

### Reserved for Semantic Zoom V5

V5 should reveal the hierarchy inside a selected semantic building complex:
module/file-group floors, file rooms, symbol/export workstations and focused
dependency routes. It should reuse the new architecture-to-semantic mapping,
add distance-aware facade simplification and collect a real renderer benchmark
in a standard browser. Ambient crowds, fake traffic, weather and decorative
boats remain outside scope unless future repository evidence justifies them.

The corrective result expands the application-library suite to 77 passing
tests, including 13 focused urban-fabric tests. Final lint, typecheck, full
workspace tests, production build, rendered-HTML tests and `npm run check` all
pass. The pre-existing large-client-chunk and Vinext route-classification
warnings remain unchanged.
