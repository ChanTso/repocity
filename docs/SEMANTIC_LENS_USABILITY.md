# Semantic Lens usability record

Status: owner acceptance complete; first-time-user acceptance unverified.

## Participants

Independent first-time participants available: **0**.

No participant identities, task times, completion rates, or observations are fabricated. The implementation agent ran the scripted tasks in a clean browser session to verify mechanics, but that operator is not counted as a participant because it implemented the feature.

The requested first-time-user success target—80% task completion, median under 60 seconds for tasks 1–4, and 100% ambient/evidence distinction—therefore remains **unverified**.

## Owner acceptance — 2026-08-02

One implementation-owner pass ran in a clean local browser session. This is product acceptance evidence, not independent usability research.

| Required step | Result | Observation |
| --- | --- | --- |
| Explore with a known file | pass | `repo-shell-01.tsx` appeared as the active file with component → module → file breadcrumb and file inspector. |
| Enter Map and select another component | pass | selecting 分析工坊 replaced the previous 交互中枢 file with a component-only breadcrumb and `COMPONENT SCOPE` inspector; no file was named or fabricated. |
| Select/focus a building and address | pass | file search selected `entity-registry-08.ts`; breadcrumb, 核心引擎 ownership, `packages/core`, block `block-b14d6a8b`, inspector path, and visible-building focus agreed. |
| Search for a file | pass | the typed result exposed FILE, component, module, path, block, and building before entering the focused Map state. |
| Pause Flow | pass | the evidence step remained `8/10` across a 5.2 s observation; scene diagnostics reported `evidence=false` and `ambient=true`, and successive rendered frames continued changing. |
| Flow → Map → Flow camera | pass | both transitions reported the `preserve` camera policy and performed no mode-triggered preset; Map exposed the explicit `地图全景`/`6` action. |
| Toggle ambient layers | pass | vehicles, pedestrians, and boats each became unchecked while both persistent ambient/evidence legend entries remained visible; all three toggles were restored. |
| Inspect one-hop relation | pass | `timeline-03.ts → project-loader-05.ts` showed `import`, weight `1`, repository-fact provenance, and explicit “非运行流量、非数据旅程” copy; the scene line remained thin, dashed, and non-emissive. |

The public-alpha overview and the committed Map/Flow/Replay review captures were rechecked for label scope. Selected file/building labels retain deterministic priority over component labels, and canvas labels remain below breadcrumb and inspector HUD layers. General screen-space collision is still not implemented.

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
- Component-only selection intentionally shows aggregate component content and never populates a file inspector without an actual file choice.
- Ambient people and cars are deliberately subtle at the public-alpha camera and may require closer viewing, while the legend remains the primary classification cue.

## Changes made after observation

- Removed automatic camera reset on Map entry; added an explicit public-alpha Map overview button while retaining review key `6`.
- Replaced unreadable distance-scaled HTML labels with memoized world-space label textures.
- Added repository → component-only breadcrumbs instead of retaining a stale file ancestry.
- Added a component-specific inspector and a pure selection transition/presentation contract that clears cross-component file state.
- Cleared stale relation evidence when Flow selects a new entity.
- Focus now resolves the visible semantic building and entrance rather than a legacy file coordinate.
- Added explicit endpoints and non-telemetry language to relation evidence.
- Kept a small cars/people/boat cohort visible in Flow with no evidence IDs.
- Decoupled ambient playback from journey playback; reduced-motion explicitly freezes both layers.

## Unresolved validation

A future maintainer should run the same eight tasks with at least three independent first-time participants and record task-level completion and timings here. That validation is intentionally not a condition silently claimed by this draft PR.
