# Changelog

All notable public releases are documented here. RepoCity uses semantic versioning while recognizing that alpha interfaces and data formats may change.

## [Unreleased]

### Added

- Dedicated semantic Map mode with component ownership, building envelopes, stable addresses, deterministic labels, and repository-to-symbol breadcrumbs.
- Inspector placement explanations, semantic search navigation, and focused one-hop relationship evidence.
- Explicit City Context / Semantic Ownership / Static Relationship / Evidence Journey / Replay Event legend.

### Changed

- Flow retains a reduced deterministic ambient cohort instead of presenting an empty city; ambient traffic remains explicitly non-semantic and non-telemetric.

This section describes an unmerged development candidate and does not announce a v0.2 release or schedule.

## [0.1.0-alpha.2] — 2026-08-02

### Fixed

- Prevented Three.js client modules from executing in the Cloudflare Worker global scope, eliminating the production `Error 1101` startup failure.
- Added a lightweight, accessible loading shell while the interactive city initializes in the browser.
- Updated production rendering tests to enforce the server/client WebGL boundary.

## [0.1.0-alpha.1] — 2026-08-01

### Added

- Local JavaScript and TypeScript Git repository analysis.
- Stable entity identity, deterministic layout, and Git-history replay.
- Component-first semantic city planning across districts, blocks, and buildings.
- Building, module-group, file, symbol, export, relation, and history inspection.
- Evidence-backed repository and delivery journeys with visible provenance.
- Asset-backed hero district with original masonry, office, curtain-wall, storefront, street, bridge, and river modules.
- Explore, Flow, and Replay modes; search, focus, camera bookmarks, and responsive HUD.
- Public documentation, contribution and security policies, asset notices, and CI release gate.

### Alpha limitations

- Visual fidelity is concentrated in one hero slice; outer districts use simplified LOD.
- Semantic zoom, language coverage, and repository-shape support remain limited.
- Ambient traffic and people are context rather than observed runtime telemetry.
- Build output includes known non-blocking size and route-classification warnings.
