# Semantic Lens usability record

Status: heuristic walkthrough complete; first-time-user acceptance unverified.

## Participants

Independent first-time participants available: **0**.

No participant identities, task times, completion rates, or observations are fabricated. The implementation agent ran the scripted tasks in a clean browser session to verify mechanics, but that operator is not counted as a participant because it implemented the feature.

The requested first-time-user success target—80% task completion, median under 60 seconds for tasks 1–4, and 100% ambient/evidence distinction—therefore remains **unverified**.

## Scripted heuristic walkthrough

The only orientation text used was: “This city represents a software repository.”

| Task | Heuristic result | Evidence |
| --- | --- | --- |
| Find a named component | passed mechanically | Map component list selects all assigned blocks/buildings and shows repository → component |
| Find a named file | passed mechanically | search `entity-registry-08` returns one typed result with component, module group, path, and city address |
| Identify its building/module group | passed mechanically | focused envelope and `packages/core` label/breadcrumb |
| Explain why it is there | passed mechanically | inspector separates grouping fact, deterministic parcel rule, dependency non-influence, and mapping provenance |
| Identify one static relation | passed mechanically | Relations → incoming/outgoing/both → relation evidence card |
| Distinguish ambient context from evidence | passed mechanically, human comprehension unverified | persistent `○ Ambient context / ◆ Evidence journey` key; distinct instanced agents vs emissive routed tokens/stations |
| Identify journey provenance | passed mechanically | Flow header and route-evidence panel show deterministic simulation / static evidence copy |
| Return to component map | passed mechanically | dedicated 地图 mode preserves semantic selection state |

## Confusion points observed during heuristic review

- Component labels can overlap at unusually dense camera angles even with deterministic priority and a 12-label cap.
- The right inspector reduces the visible city area, so labels behind it are intentionally unavailable until the camera moves.
- Component-only selection cannot populate a file inspector without inventing a representative file; the empty inspector is accurate but may need future component-specific content.
- Ambient people and cars are deliberately subtle at the public-alpha camera and may require closer viewing, while the legend remains the primary classification cue.

## Changes made after observation

- Added the public-alpha overview camera when entering Map.
- Replaced unreadable distance-scaled HTML labels with memoized world-space label textures.
- Added repository → component-only breadcrumbs instead of retaining a stale file ancestry.
- Cleared stale relation evidence when Flow selects a new entity.
- Focus now resolves the visible semantic building and entrance rather than a legacy file coordinate.
- Added explicit endpoints and non-telemetry language to relation evidence.
- Kept a small cars/people/boat cohort visible in Flow with no evidence IDs.

## Unresolved validation

A future maintainer should run the same eight tasks with at least three independent first-time participants and record task-level completion and timings here. That validation is intentionally not a condition silently claimed by this draft PR.
