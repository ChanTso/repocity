# RepoCity delivery map

The MVP is split along stable product boundaries rather than UI pages. A later
layer may depend on an earlier one; the viewer never reads Git directly.

## PR 0 — workspace and schema

- [x] TypeScript project skeleton and shared scripts
- [x] Zod schemas for manifests, entities, relations, commits, chapters and deltas
- [x] Deterministic 200+ building fixture
- [x] Schema validation tests

Acceptance:

```bash
npm run typecheck
npm run test:unit
```

## PR 1 — static 3D city

- [x] District ground and persistent labels
- [x] Instanced building batches grouped by role/style
- [x] Orbit, pan and zoom controls
- [x] Instance hover, selection and focus
- [x] File/symbol search with camera flight
- [x] Inspector and local first-order relations

Acceptance:

```bash
npm run dev
```

Open the local URL, select a building, search for `repo-shell`, and press `F`.

## PR 2 — repository analyzer

- [x] Local path and public Git URL input
- [x] JS/TS ignore and role rules
- [x] LOC, import and export analysis
- [x] District and stable layout compilation
- [x] Static `.repocity` bundle output

Acceptance:

```bash
npm run repocity -- build ./fixtures/tiny-ts-repo \
  --out ./public/projects/tiny
```

## PR 3 — Git history and identity

- [x] Reverse commit traversal, tags and parents
- [x] Add, modify, remove and rename changes
- [x] Stable entity identity across rename
- [x] Deltas, chapters and periodic keyframes
- [x] Replay state equivalence tests

Acceptance:

```bash
npm run test:unit
```

## PR 4 — replay player

- [x] Play, pause, scrub and speed controls
- [x] Construction, renovation and demolition states
- [x] Chapter and release markers
- [x] Optional cinematic follow camera
- [x] Commit details and source/diff destinations

Acceptance:

```bash
npm run build
npm test
```

## PR 5 — performance and finish

- [x] Role-based `InstancedMesh` batches
- [x] On-demand relationship ribbons
- [x] DPR cap and deterministic procedural variants
- [x] Loading, empty and privacy states
- [x] Responsive read-only mobile layout
- [x] Production build and rendered HTML checks

Acceptance:

```bash
npm run check
```

## Dependency graph

```text
schema ─┬─> city compiler ─┬─> static viewer
        │                  └─> analyzer CLI
        └─> replay engine ───> timeline + scene state
git analyzer ────────────────> analyzer CLI
code analyzer ───────────────> analyzer CLI
```
