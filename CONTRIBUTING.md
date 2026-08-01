# Contributing to RepoCity

RepoCity is an experimental public alpha. Small, evidence-backed changes are easier to review than broad visual or architectural rewrites.

## Development setup

1. Use Node.js 22 (the exact tested version is in `.nvmrc`).
2. Run `npm ci`.
3. Run `npm run dev` for local exploration.
4. Run `npm run check` before opening a pull request.

## Semantic integrity

The repository graph is authoritative. A visual metaphor must not invent software facts.

- Label inferred and simulated information explicitly.
- Keep ambient people, vehicles, storefronts, and props non-semantic unless backed by evidence.
- Preserve stable entity identity and deterministic layout.
- Add or update tests when changing analysis, mapping, routing, or replay behavior.
- Document an asset's origin, author, license, attribution, checksum, and semantic classification.

## Pull requests

Explain the problem, the semantic mapping, user-visible behavior, and verification. Include real product screenshots for visual changes. Do not use generated concept art as evidence of implementation.

Do not commit target-repository source, secrets, local paths, internal URLs, dependency directories, caches, or unrelated generated output.

## Scope and conduct

There is no promised roadmap or review schedule. Be respectful and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
