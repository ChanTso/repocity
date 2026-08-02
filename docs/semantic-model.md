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

The Semantic Lens presents the authoritative chain explicitly:

```text
repository facts
→ semantic ownership
→ deterministic spatial projection
→ non-semantic urban context
→ evidence journeys
```

Map selection resolves stable component, block, semantic-building, file, entrance, and address IDs. The breadcrumb renders only levels supported by those mappings. Repository facts decide ownership; deterministic planners decide physical placement; architectural subdivisions and decoration do not create repository entities.

Component selection is a scope, not an implicit file choice. Selecting a component clears any file child from another component and shows aggregate component facts; RepoCity never fabricates a representative file. Selecting an actual file re-establishes the component → building → file chain in both breadcrumb and inspector.

## Stable identity

Entity IDs are deterministic. Rename detection preserves identity; delete followed by a new add creates a new entity. Layout uses historical maximum metrics so replay changes state without moving the city.

## Context versus evidence

Storefronts, street furniture, parked vehicles, ambient traffic, people, vegetation, and architectural trim are non-semantic context unless a future evidence source explicitly promotes them. They may improve legibility and scale but cannot claim repository or runtime meaning.

The Living Streets planner makes this boundary structural: every ambient route and agent is classified `NON_SEMANTIC_URBAN_CONTEXT` and carries empty evidence-relation, component, repository-entity, and journey identifiers. Its deterministic budgets depend on available city surfaces, not LOC, churn, dependency weight, file count, or token count. Public-frontage priority improves fixed-camera legibility without assigning meaning to a building or street.

The inspector’s “为什么在这里？” section reports the grouping and placement rules separately. It does not infer importance, quality, runtime frequency, production traffic, or architectural meaning from location or appearance.

See [Architecture](ARCHITECTURE.md) and [Data format](DATA_FORMAT.md) for implementation details.
