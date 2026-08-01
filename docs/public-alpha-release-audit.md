# Public alpha release audit

Audit target: `v0.1.0-alpha.1 — Public Semantic City Prototype`

This document records the release-candidate checks performed before owner approval. It does not authorize merging, tagging, deployment, or a repository visibility change.

## Results

| Area | Result | Evidence |
| --- | --- | --- |
| Complete Git history | Pass | Gitleaks scanned all 18 pre-release commits with redaction and found no secrets. Deterministic history searches found only `localhost` development values and `@repocity.local` fixtures. |
| Risky files | Pass | No committed `.env`, private key, certificate, token file, or local absolute path. |
| GitHub Actions history | Pass | No prior workflow runs and no artifacts existed while the repository was private. |
| Dependency graph | Pass | Initial audit: 15 findings (13 high, 2 low). Patched framework/build dependencies and constrained vulnerable transitive packages. Final `npm audit`: 0 findings. |
| Asset provenance | Pass | All 37 city-kit files are original deterministic output; every SHA-256 matches the asset manifest. No external game capture, copied landmark, brand, font, or marketplace asset is committed. |
| Public screenshots | Pass | Four authentic 1920×1080 product captures; hashes and states are recorded in `docs/media/README.md`. |
| Social preview | Pass | 1280×640, 997,066-byte PNG based on the authentic hero capture; no claim that it is an additional product view. |
| License | Pass pending owner publication decision | Apache-2.0 is installed for project source and original assets. Dependency licenses and exceptional families are recorded in `THIRD_PARTY_NOTICES.md`. |
| Quality gate | Pass | Local and isolated clean-clone `npm ci` / `npm run check` passed; GitHub Actions `Release gate` passed. |

## Known non-blocking warnings

- Vinext cannot yet classify the dynamic `headers()` route statically.
- The client build reports a chunk larger than 500 kB.
- Performance varies by browser, GPU, dataset size, and device-pixel ratio; the project does not publish a universal FPS claim.
- The visual renderer remains an alpha: the hero slice has the most detail and outer districts use simplified geometry.

## Owner-only publication gate

After reviewing the final `PUBLIC_READY` report, the owner may authorize these separate steps:

1. merge the ready-for-review release PR;
2. create the `v0.1.0-alpha.1` prerelease;
3. verify branch/ruleset protection and required checks;
4. deploy or update any hosted site if desired;
5. change repository visibility from private to public;
6. verify an anonymous clone, README images, Quick Start, social preview, issues, security reporting, and rules after the visibility change.

Changing visibility is intentionally not part of the release-candidate preparation commit.

The current private repository cannot enable GitHub branch protection on its account tier: the Branch Protection API returns `403` and requires GitHub Pro or a public repository. The owner must enable protection immediately after publication (or upgrade before publication), require the `Release gate` check, require pull requests, and prohibit force pushes and branch deletion.
