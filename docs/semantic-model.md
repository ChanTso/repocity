# Semantic model

RepoCity uses a repository-semantic graph as its source of truth. The city is a spatial projection of that graph, not an independent simulation of software facts.

## Hierarchy

| Repository concept | City presentation | Authority |
| --- | --- | --- |
| repository | city | analyzed repository identity |
| workspace, package, component | district or large semantic container | package and path evidence |
| module or file group | building or building group | deterministic grouping rules |
| file | addressable entity and inspector record | Git tree and code analysis |
| symbol or export | internal level or inspector item | supported AST analysis |
| import or supported relation | aggregated corridor and inspector relation | static analysis |
| commit | construction/replay event | Git history |

One semantic container can span multiple buildings when scale requires it. Selection therefore follows semantic ownership rather than assuming one building equals one file.

## Stable identity

Entity IDs are deterministic. Rename detection preserves identity; delete followed by a new add creates a new entity. Layout uses historical maximum metrics so replay changes state without moving the city.

## Context versus evidence

Storefronts, street furniture, parked vehicles, ambient traffic, people, vegetation, and architectural trim are non-semantic context unless a future evidence source explicitly promotes them. They may improve legibility and scale but cannot claim repository or runtime meaning.

See [Architecture](ARCHITECTURE.md) and [Data format](DATA_FORMAT.md) for implementation details.
