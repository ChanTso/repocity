# RepoCity v0.2 — Semantic Lens

Status: released in v0.2.0. This document preserves the verified baseline, implementation contract, and local acceptance evidence for Semantic Lens.

## Verified baseline

- Starting `main`: `b2bdb7b1261f8dd00c7216b27bc99fb118411af6`.
- Viewer modes: `explore | journey | replay`, shown as 探索、流动、回放.
- Canonical repository facts remain file entities and static relations from the project bundle.
- `planSemanticCity` groups file entities into component campuses and assigns stable semantic addresses.
- `planUrbanFabric` projects components into blocks, parcels, semantic building envelopes, entrances and architectural subdivisions.
- `planVisualCity` and the asset-backed hero add non-semantic urban context without changing repository ownership.
- `planFlowSimulation` and `projectSemanticFlow` create deterministic, provenance-labelled explanatory journeys.
- Replay reduces the canonical history into visible entities, changed entities and active relations without replanning the city.

## Current selection data flow

```text
search / district list / 3D hit target / Flow step
  -> selectedEntityId
  -> file inspector
  -> optional focusEntityId
  -> CameraRig resolves the legacy file building
```

The final focus step is the main baseline defect: it can target a legacy file coordinate behind the visible urban-fabric projection and fly the camera into a simplified context mass. There is no persistent component/building/file breadcrumb and no dedicated component selection.

## Current semantic-to-spatial mapping

```text
repository file fact
  -> SemanticComponent.entityIds
  -> SemanticEntityAddress(componentId, campusId, fileSlotId)
  -> UrbanEntityAddress(blockId, parcelId, buildingId, entrance)
  -> UrbanBuildingEnvelope.entityIds
  -> one or more non-semantic UrbanArchitecturalEnvelope facade masses
```

Repository facts decide ownership. Deterministic planners decide physical placement. Storefront signs, facade trim, trees, lights, vehicles, pedestrians, boats and background LOD buildings are visual context only.

## Current ambient and evidence behavior

- Journey routes and tokens are rendered only by `FlowJourneyLayer`.
- `RepoCityApp` currently passes all ambient toggles as `false` in Journey mode.
- `CityScene` passes an empty ambient route list to `SemanticMetropolis`, so the component city has no persistent contextual traffic cohort.
- Journey labels identify stages and tokens, but no compact legend distinguishes ambient context from evidence.
- Static one-hop relations are available in the inspector but have no dedicated Map rendering language.

## Baseline usability failures

1. Explore has no persistent semantic labels at the public-alpha camera.
2. District list actions hide geometry instead of selecting semantic ownership.
3. A file can be inspected, but its component, semantic building and urban address are not presented as a hierarchy.
4. “Why is this building here?” is unanswered.
5. Search results show file path and district only and do not enter a semantic-navigation mode.
6. Flow removes environmental activity instead of reducing it.
7. Relationship, evidence and context provenance are implicit.
8. File focus can resolve to a legacy coordinate that is not the visible semantic building.

The immutable before captures are in `docs/screenshots/semantic-lens/before/`.

## Baseline renderer measurements

Measurements use the local development renderer, the 1920×1080 public-alpha camera (`6`), day lighting and the same demo project. Values are settled single-session observations, not hardware-independent benchmarks.

| Mode | Draw calls | Triangles | Geometries | Textures | Programs | Smoothed frame | FPS | Active semantic/Journey HTML labels |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Explore | 151 | 271,888 | 142 | 33 | 31 | 11.06 ms | 90.4 | 0 |
| Flow, step 1 paused | 230 | 277,828 | 212 | 33 | 40 | 15.91 ms | 62.9 | 11 |

## Implementation plan

1. Centralize mode visual profiles and ambient presentation in pure typed selectors.
2. Add Map as a first-class mode while retaining the internal `journey` name.
3. Resolve component, semantic-building, file, address, breadcrumb, placement and one-hop relation views from stable IDs.
4. Render bounded ownership, building, label and relation overlays without changing city assets.
5. Keep deterministic ambient context visible at reduced emphasis in Map, Flow and Replay; keep evidence tokens visually dominant.
6. Make search enter Map and focus the visible semantic building entrance.
7. Add explicit layer/provenance legends and placement explanation to the inspector.
8. Protect journey and replay invariants with focused tests, fixed screenshots and a documented heuristic usability walkthrough.

## Scope guard

This PR does not add blocks, asset families, traffic density, journeys, telemetry, interiors, ingestion, a renderer, a release or a README hero. The next Living Streets or Chicago Kit phase remains separate.

## Implemented Semantic Lens

- `SemanticLensState` owns the four modes, typed selection, relationship direction, and label level.
- `CityVisualProfile` contains only consumed canvas, ambient, semantic-overlay, and relation controls. Whole-canvas brightness/saturation are named honestly because CSS cannot isolate city geometry from journey or replay geometry.
- Component selection is a component scope: it clears any previous file child, renders a component-specific inspector, and never invents a representative file.
- Map mode uses stable semantic and urban-fabric IDs to resolve component block unions, semantic building envelopes, architectural facade masses, entrances, and file addresses.
- World-space semantic labels are memoized, deterministic, distance/selection culled, and capped at 12. Storefront and context names never enter the label or search selector.
- Search results expose entity type, component, module group, path/export match, and semantic address, then enter Map and focus the visible semantic building.
- The inspector separates repository ownership from deterministic placement in “为什么在这里？”.
- Optional one-hop relation overlays are thin non-emissive dashed lines; their inspector card reports endpoints, type, clamped weight, repository provenance, and the non-telemetry contract.
- A single deterministic ambient cohort is derived from compiled streets and river geometry. It has no evidence IDs and is passed to the existing instanced mobility renderer; mode profiles reduce opacity and speed without creating a second simulation. Its playback is independent from evidence-journey playback; reduced-motion explicitly freezes both.
- Camera focus resolves the visible `UrbanBuildingEnvelope` before the legacy file coordinate.
- Switching modes preserves camera position. Map overview is an explicit button/`6` preset rather than an automatic reset.

## Mode contract after implementation

| Mode | Primary meaning | Ambient | Semantic labels/selection | Journey / replay |
| --- | --- | --- | --- | --- |
| Explore | experience the city | configured, full emphasis | minimal active selection + breadcrumb | hidden |
| Map | understand repository ownership | configured, 25% emphasis | component/building/file overlays + optional one-hop relations | hidden |
| Flow | understand a supported journey | configured, 25% emphasis | destination + breadcrumb; relations secondary | evidence at full emphasis |
| Replay | understand Git evolution | configured, 20% emphasis | stable breadcrumb/ownership | Git events at full emphasis |

## Performance comparison

The After samples use the same local browser, 1920×1080 viewport, day lighting, demo project, and public-alpha camera. Each After frame time is the median of 12 settled development-renderer samples. The Before values are the original settled observations, so they are useful directional evidence rather than a hardware-independent benchmark.

| View | Before frame | After median frame | Change | Before → After draw calls | After labels |
| --- | ---: | ---: | ---: | ---: | ---: |
| Explore | 11.06 ms | 10.67 ms | −3.5% | 151 → 84 | 0 with no selection |
| Map overview | n/a | 10.48 ms | −1.8% vs After Explore | n/a → 87 | 6 |
| Flow with ambient | 15.91 ms | 13.88 ms | −12.8% | 230 → 160 | 2 |

Final After renderer observations:

| View | Triangles | Geometries | Textures | Programs |
| --- | ---: | ---: | ---: | ---: |
| Explore | 263,724 | 208 | 33 | 33 |
| Map overview | 263,730 | 208 | 37 | 34 |
| Flow with ambient | 265,012 | 311 | 35 | 43 |

Frame delta measures request-animation timing and can vary with display refresh, window focus, and development tooling. Reproduce through the hidden `[data-repocity-render-metrics]` output at camera `6`; production profiling remains a follow-up when a stable hardware matrix exists.

## Visual evidence

Before:

- [Explore](screenshots/semantic-lens/before/explore.png)
- [Flow](screenshots/semantic-lens/before/flow.png)
- [Selected building](screenshots/semantic-lens/before/selected-building.png)

After:

- [Explore](screenshots/semantic-lens/after/explore.png)
- [Map overview](screenshots/semantic-lens/after/map-overview.png)
- [Selected component](screenshots/semantic-lens/after/map-selected-component.png)
- [Selected building](screenshots/semantic-lens/after/map-selected-building.png)
- [Semantic file search](screenshots/semantic-lens/after/map-file-search.png)
- [Flow with ambient context](screenshots/semantic-lens/after/flow-with-ambient-context.png)
- [Replay selection](screenshots/semantic-lens/after/replay-selection.png)

All captures are authentic 1920×1080 local product screenshots. No generated imagery or asset replacement is used.

## Acceptance status

- `npm run check`: passed after the review-fix pass (lint, all workspace typechecks/tests, 109 application tests across 11 files, production build, and 2 rendered-HTML tests).
- Semantic Lens selector coverage: 17 tests covering mode transitions/profiles, independent ambient/evidence playback, reduced motion, semantic exclusion, coherent component/file scope, component/building/address/breadcrumb resolution, placement explanation, selected-label priority/cap, one-hop relationships, and semantic search.
- Existing flow-simulation journey invariants (14 tests) and viewer replay behavior (3 tests) passed unchanged in the repository-wide gate.
- Production build: passed with the repository's existing non-blocking chunk-size and route-classification warnings.
- Owner browser acceptance: recorded in [Semantic Lens usability](SEMANTIC_LENS_USABILITY.md), including component/file reconciliation, independent ambient playback, preserved camera context, layer toggles, and relation presentation.
- First-time-user study: unverified because no independent participants were available; see [Semantic Lens usability](SEMANTIC_LENS_USABILITY.md).

## Known limitations

- World-space label priority suppression is deterministic, but dense camera angles can still produce overlap.
- The demo contains inferred and deterministic evidence, not observed runtime evidence.
- Ambient agents establish context at the public-alpha camera but are intentionally subtle; density is not repository or runtime data.
- Component-only selection uses a component-specific inspector until a building/file is selected.
- This change does not extend repository language coverage, city blocks, architectural assets, interiors, journeys, or telemetry.
