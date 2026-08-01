# Public alpha release audit

Audit target: `v0.1.0-alpha.1 — Public Semantic City Prototype`

This document records the release-candidate checks, the owner-authorized history remediation, and the final public-alpha publication gate.

## Results

| Area | Result | Evidence |
| --- | --- | --- |
| Complete Git history | Pass | Gitleaks found no secrets. Every commit reachable from the public repository uses the authenticated GitHub noreply identity; file trees were unchanged by the metadata-only rewrite. |
| Risky files | Pass | No committed `.env`, private key, certificate, token file, or local absolute path. |
| GitHub Actions history | Pass | The clean repository contains only release-gate runs for the sanitized candidate and no downloadable artifacts. |
| Dependency graph | Pass | Initial audit: 15 findings (13 high, 2 low). Patched framework/build dependencies and constrained vulnerable transitive packages. Final `npm audit`: 0 findings. |
| Asset provenance | Pass | All 37 city-kit files are original deterministic output; every SHA-256 matches the asset manifest. No external game capture, copied landmark, brand, font, or marketplace asset is committed. |
| Public screenshots | Pass | Four authentic 1920×1080 product captures; hashes and states are recorded in `docs/media/README.md`. |
| Social preview | Pass | 1280×640, 997,066-byte PNG based on the authentic hero capture; no claim that it is an additional product view. |
| License | Pass | The owner approved Apache-2.0 for project source and original assets. Dependency licenses and exceptional families are recorded in `THIRD_PARTY_NOTICES.md`. |
| Quality gate | Pass | Local and isolated clean-clone `npm ci` / `npm run check` passed; the GitHub Actions `Release gate` passed on the sanitized candidate. |

## Known non-blocking warnings

- Vinext cannot yet classify the dynamic `headers()` route statically.
- The client build reports a chunk larger than 500 kB.
- Performance varies by browser, GPU, dataset size, and device-pixel ratio; the project does not publish a universal FPS claim.
- The visual renderer remains an alpha: the hero slice has the most detail and outer districts use simplified geometry.

## History remediation

The first private development repository contained 17 commits with a machine-local `.local` author and committer address. The owner explicitly authorized a metadata-only `git filter-repo` rewrite and force-push with leases. Commit tree hashes for `main` and every product branch were identical before and after rewriting.

GitHub retains server-owned refs for closed and merged pull requests, so the rewritten branches alone could not make that repository a complete public-history boundary. The original repository was therefore retained as a private history archive. This public repository was created from the sanitized refs and has no relationship to the archive's pull-request refs.

The clean repository was rescanned after publication preparation. No machine-local identity, personal absolute path, credential, private key, or private service URL is reachable from its branches or tags.

## Publication decision

The owner approved the history rewrite, private archive, clean repository, merge, prerelease, publication, hosting, and post-publication protection sequence. The final candidate is `PUBLIC_READY`.
