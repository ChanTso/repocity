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
