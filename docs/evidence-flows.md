# Evidence-backed flows

Flow mode explains selected paths through the current repository model. It is not production telemetry.

## Provenance

The public alpha exposes:

- **inferred** — supported by imports, repository structure, symbols, configuration, or deterministic projection rules;
- **simulated** — a deterministic explanatory scenario travelling over an evidence-backed graph.

The underlying design reserves separate categories for observed runtime, test, and Git evidence, but the alpha must not claim those categories where they have not been collected.

## Presentation contract

- Every journey names its provenance.
- Journey steps resolve to semantic entities.
- Route legs are projected onto the semantic street/corridor graph.
- A visible route links to relationship or rule explanations.
- Moving journey tokens are visually distinct from ambient vehicles and pedestrians.
- Density, timing, and queues are explanatory simulation values unless explicitly documented otherwise.
- Missing or unsupported evidence is shown as a limitation instead of being fabricated.

The repository-pipeline journey explains how RepoCity analyzes and compiles a repository. The delivery journey demonstrates a supported artifact path across the visual city. Both remain deterministic for the same dataset.

See [V3 Flow City specification](V3_FLOW_CITY_SPEC.md) for the longer design target and current boundary.
