# Living Streets v0.2

Living Streets is an unreleased activity-layer candidate. It makes the existing city visibly occupied without turning decorative traffic into repository evidence or runtime telemetry.

## Baseline and implementation

The merged Semantic Lens baseline selected the first four eligible ground streets, the first three local streets, and one river centerline. Route weights produced 10 vehicles, 12 pedestrians, and 2 boats. Vehicles followed centerlines, pedestrians followed roads, and the sparse cohort was difficult to see from the fixed review cameras.

The new pure planner lives in `app/lib/ambient-mobility.ts`. It consumes only existing urban fabric, visual water bounds, and public hero frontages. It never consumes LOC, dependency weight, churn, file count, journey tokens, or other repository importance metrics. For the same city, configuration, and seed it produces the same routes, spawn phases, speeds, dwell times, colors, and budgets.

The standard demo plan contains:

| Layer | Routes | Agents | Sources and behavior |
| --- | ---: | ---: | --- |
| Road | 7 | 32 | connected block loops, opposing bridge lanes, smoothed turns, deterministic yields |
| Pedestrian | 22 | 48 | public frontages, entrances, sidewalks, crosswalks, bridge walks, riverwalks |
| Water | 2 | 3 | opposing channel lanes within continuous river bounds |

The total serialized review plan is 60,176 bytes. Small-city budgets scale down with available streets and water; the standard full-city ceilings remain 32 vehicles, 48 pedestrians, and 3 boats.

Every route and agent is classified `NON_SEMANTIC_URBAN_CONTEXT`, has no evidence, relation, component, entity, or journey IDs, and is not selectable as a repository entity. Hero-frontage priority is a fixed-camera presentation budget only; it is based on an existing public street edge and carries no software meaning.

## Rendering architecture

`RepoCityApp` plans once with `useMemo`; `CityScene` passes the immutable plan to `SemanticMetropolis`. The frame loop samples prebuilt segmented curves with reused vectors. Road vehicles share one instanced body, cabin, headlight, and tail-light fleet; pedestrians and boats use shared instanced geometry and materials. There is no per-agent React component, dynamic light, frame-time pathfinding, route sorting, or cohort regeneration.

Road agents use visible lane offsets, distinct opposing bridge lanes, deterministic turn slowing/yields, and phase spacing. Pedestrians use public walking surfaces and short entrance/crossing/riverwalk dwell points. Bridge-walk height is sampled from the bridge road surface so people do not render in the river. Boats remain in river bounds, use an upstream/downstream offset, spawn within a bounded interval of the river review camera, and render wakes only while moving.

Day, dusk, and night reuse the existing lighting presets. Shared instanced head/tail lights, pedestrian emissive contrast, boat navigation lights, and wakes add legibility without one light per agent.

## Mode and accessibility contract

| Mode | Ambient behavior |
| --- | --- |
| Explore | full configured cohort, normal opacity and speed |
| Map | same cohort, reduced speed and emphasis behind semantic ownership |
| Flow | same cohort, reduced emphasis; evidence pause does not pause ambient motion |
| Replay | reduced emphasis and speed behind Git-event state |

User traffic, pedestrian, and boat toggles remain authoritative in every mode. `prefers-reduced-motion` freezes both ambient and evidence movement; it does not silently leave one motion layer active.

Evidence retains its diamond silhouette, emissive material, routed trail/pulse, stage UI, and provenance labels. Ambient agents receive none of those channels. Development diagnostics expose ambient playback and counts separately from evidence playback and token count.

## Validation

Authentic 1920×1080 captures are in `docs/screenshots/living-streets/after/`; the 9-second GIF shows an active Flow journey followed by evidence pause while ambient traffic continues.

Fixed-camera review over the requested windows found:

- Explore overview: moving road traffic and pedestrians cross the hero grid; a river boat is visible within the bounded interval when the river is in frame.
- Street corner: at least three vehicles traverse the frame; the frontage cohort supplies walking and entrance dwell behavior, with at least six pedestrian entries across the observation window.
- River bridge: bridge lanes carry traffic, bridge/riverwalk pedestrians remain above their surfaces, and a boat is visible in the channel.

On the same local development browser and 1920×1080 viewport, the merged baseline Explore sample recorded 159 draw calls, 274,420 triangles, 171 geometries, 34 textures, 12.37 ms smoothed frame time, and 80.8 FPS. The Living Streets Explore review recorded median 173 draw calls (+8.8%), 283,128 triangles, 167 geometries, 34 textures, and 8.80 ms median frame time across 15 one-second samples. Planning measured 0.600 ms in-browser; the automated p95 gate remains below 10 ms.

Flow recorded 264 median draw calls and 14.02 ms median frame time across the same 15-sample method. A pre-change Flow median was not captured, so the Flow regression percentage is unverified rather than inferred. Results are local observations, not cross-device guarantees.

Automated coverage verifies determinism, seed variation, semantic separation, connected lanes, bridge alignment, turn continuity, spacing, public pedestrian surfaces, building/water exclusion, entrance dwell, river bounds, no-water fallback, budgets, reuse without duplication, mode/toggle/playback contracts, protected semantic selection, and planning p95.

## Known limitations

- This is deliberately not a collision, signal optimization, demand, or production-traffic simulator.
- Vehicle yields are independent deterministic timing, not coordinated intersection phases.
- Visible-agent counts were reviewed manually over fixed windows; the product does not add a runtime camera census.
- The Flow performance regression percentage is unverified because the baseline Flow median was not recorded before implementation.
- Independent usability acceptance remains unverified; see `LIVING_STREETS_USABILITY.md`.
- Outer-city architecture remains the existing simplified LOD. Chicago Kit v2 is explicitly outside this PR.

## Evidence

- `screenshots/living-streets/before/` — merged baseline captures
- `screenshots/living-streets/after/` — current fixed-camera captures and authentic motion GIF
- `app/lib/ambient-mobility.test.ts` — focused planner and invariant tests
- `app/lib/semantic-lens.test.ts` — mode, playback, selection, and protected semantic tests
