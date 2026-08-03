# Living Streets v0.2

Living Streets shipped in v0.2.0. It makes the city visibly occupied without turning decorative traffic into repository evidence or runtime telemetry.

## Baseline and implementation

The merged Semantic Lens baseline selected the first four eligible ground streets, the first three local streets, and one river centerline. Route weights produced 10 vehicles, 12 pedestrians, and 2 boats. Vehicles followed centerlines, pedestrians followed roads, and the sparse cohort was difficult to see from the fixed review cameras.

The new pure planner lives in `app/lib/ambient-mobility.ts`. It consumes only existing urban fabric, visual water bounds, and public hero frontages. It never consumes LOC, dependency weight, churn, file count, journey tokens, or other repository importance metrics. For the same city, configuration, and seed it produces the same routes, spawn phases, speeds, dwell times, colors, and budgets.

The standard demo plan contains:

| Layer | Routes | Agents | Sources and behavior |
| --- | ---: | ---: | --- |
| Road | 7 | 32 | connected block loops, opposing bridge lanes, smoothed turns, deterministic yields |
| Pedestrian | 18 | 48 | validated public frontages, projected entrances, sidewalks, crosswalks, bridge walks, riverwalks |
| Water | 2 | 3 | opposing unidirectional channel lanes within continuous river bounds |

The corrected production review plan is 56,851 bytes. Four unsafe public-frontage candidates are skipped and reported rather than routed through unrelated footprints. Small-city budgets scale down with available streets and water; the standard full-city ceilings remain 32 vehicles, 48 pedestrians, and 3 boats.

Every route and agent is classified `NON_SEMANTIC_URBAN_CONTEXT`, has no evidence, relation, component, entity, or journey IDs, and is not selectable as a repository entity. Hero-frontage priority is a fixed-camera presentation budget only; it is based on an existing public street edge and carries no software meaning.

## Rendering architecture

`RepoCityApp` plans once with `useMemo`; `CityScene` passes the immutable plan to `SemanticMetropolis`. The pure runtime helper in `app/lib/ambient-motion.ts` prepares cumulative-length polylines once and samples them into reused vectors. Road vehicles share one instanced body, cabin, headlight, and tail-light fleet; pedestrians and boats use shared instanced geometry and materials. There is no per-agent React component, dynamic light, frame-time pathfinding, per-frame path reconstruction, route sorting, or cohort regeneration.

Motion strategy is explicit on every route: block roads and sidewalk circuits are `closed-loop`; entrances, crosswalks, bridge walks, and riverwalks are `ping-pong`; channel traffic is `offscreen-wrap`. Prepared closed loops append the first point after the final point, so the closing edge is renderable rather than a progress-boundary teleport.

Every vehicle assigned to one road route shares speed, delay, dwell schedule, and cycle duration. Fixed spatial phases are applied after the shared route clock, preserving cyclic order and spacing even while the route clock dwells. Capacity uses real polyline length, the largest rendered vehicle body, clearance, and the configured normalized minimum gap. The hero road is resolved by structured `blockId`; its production allocation is six vehicles at a computed capacity of six, with the remaining global budget distributed deterministically.

Generic entrances are resolved against rotated footprints, projected onto the nearest sidewalk segment, and connected through a short frontage/plaza approach. Complete segments are sampled at a documented 0.15–0.25 world-unit interval and rejected when they intersect a building or water. Riverwalk crossings explicitly mark traffic-lane crossings. Invalid routes have no fallback and are counted in diagnostics.

Boats remain in river bounds, use actual-interval interpolation rather than a world-zero assumption, and consume opposing directions at runtime. Both lanes wrap beyond the fixed review bounds, so no boat visibly reverses in the channel. Wakes render only while ambient motion is playing.

Day, dusk, and night reuse the existing lighting presets. Shared instanced head/tail lights, pedestrian emissive contrast, boat navigation lights, and wakes add legibility without one light per agent.

## Mode and accessibility contract

| Mode | Ambient behavior |
| --- | --- |
| Explore | full configured cohort, normal opacity and speed |
| Map | same cohort, reduced speed and emphasis behind semantic ownership |
| Flow | same cohort, reduced emphasis; evidence pause does not pause ambient motion |
| Replay | reduced emphasis and speed behind Git-event state |

User traffic, pedestrian, and boat toggles remain authoritative in every mode. `prefers-reduced-motion` freezes both ambient and evidence movement; it does not silently leave one motion layer active.

Evidence retains its diamond silhouette, emissive material, routed trail/pulse, stage UI, and provenance labels. Ambient agents receive none of those channels. Development diagnostics expose planned and enabled ambient counts separately and explicitly state that no camera-visible census is measured. Evidence diagnostics use `flowJourney.tokens.length` exactly; pause and ambient-layer toggles do not change that count.

## Validation

The original review media remains in `docs/screenshots/living-streets/after/`. Corrected authentic captures are in `docs/screenshots/living-streets/review-fixes/`: closed-loop soak state, generic/hero entrance approach, evidence-paused Flow, and opposing river directions. README media was not changed.

Fixed-camera review over the requested windows found:

- Explore overview: moving road traffic and pedestrians cross the hero grid; a river boat is visible within the bounded interval when the river is in frame.
- Street corner: at least three vehicles traverse the frame; the frontage cohort supplies walking and entrance dwell behavior, with at least six pedestrian entries across the observation window.
- River bridge: bridge lanes carry traffic, bridge/riverwalk pedestrians remain above their surfaces, and a boat is visible in the channel.

The review-fix build completed a real 120-second Explore soak after the deterministic test soak. Every configured closed route has a cycle shorter than 120 seconds, and the page completed the run without browser warnings or errors. The exact Flow pause probe reported `ambientPlaying=true`, `evidencePlaying=false`, 32 enabled vehicles, and 31 evidence tokens.

On the local in-app browser's 985×720 viewport, Explore recorded 154 median draw calls, 282,368 triangles, 169 geometries, 34 textures, and 9.48 ms median frame time across 15 one-second samples. Active Flow recorded 181 median draw calls, 284,246 triangles, 246 geometries, 33 textures, and 11.06 ms median frame time. The deterministic production plan measured 1.175 ms median and 2.224 ms p95 across 100 runs. These are local observations, not cross-device guarantees; they are not compared as a regression percentage against the earlier 1920×1080 measurements.

Automated coverage now verifies final-to-first segments, wrap continuity and finite tangents, a 120-second deterministic soak, two full road cycles including dwell, stable vehicle order/body clearance, rotated footprints, segment projection, sampled building/water/traffic exclusion, connected sidewalk approaches, production hero frontage handling, honest invalid-route counts, structured priority capacity, translated positive/negative/cross-zero water intervals, opposing runtime directions, exact evidence-token diagnostics, mode/toggle/playback contracts, protected semantic selection, and planning p95.

## Known limitations

- This is deliberately not a collision, signal optimization, demand, or production-traffic simulator.
- Route-level yields pause a shared convoy clock; they are not coordinated traffic signals or intersection physics.
- Visible-agent counts were reviewed manually over fixed windows; the product does not add a runtime camera census.
- The Flow performance regression percentage is unverified because the baseline Flow median was not recorded before implementation.
- Independent usability acceptance remains unverified; see `LIVING_STREETS_USABILITY.md`.
- Four production hero frontage candidates fail the conservative segment validator and are intentionally omitted; one priority frontage and four generic entrances remain in the corrected plan.
- Outer-city architecture remains the existing simplified LOD. Chicago Kit v2 is explicitly outside this PR.

## Evidence

- `screenshots/living-streets/before/` — merged baseline captures
- `screenshots/living-streets/after/` — current fixed-camera captures and authentic motion GIF
- `screenshots/living-streets/review-fixes/` — corrected closed-loop, entrance, Flow-pause, and river-direction evidence
- `app/lib/ambient-motion.test.ts` — runtime continuity, spacing, direction, and 120-second deterministic soak tests
- `app/lib/ambient-mobility.test.ts` — focused planner and invariant tests
- `app/lib/semantic-lens.test.ts` — mode, playback, selection, and protected semantic tests
