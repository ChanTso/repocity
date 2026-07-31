# RepoCity City Kit V1 — Asset Manifest

## License

All files in `public/assets/city-kit-v1/` are original works generated specifically for the RepoCity repository by `scripts/generate-city-kit.mjs`.

- source/author: RepoCity project contributors;
- license: same license as the RepoCity repository;
- external source URLs: none;
- external authors requiring attribution: none;
- real brands, logos and named landmark copies: none;
- ripped game, marketplace or unknown-provenance content: prohibited and absent.

## Reproduction

Run:

```sh
npm run assets:city-kit
```

The generator is deterministic. It exports the committed GLB modules and authored PBR texture maps from repository-owned source parameters. Generated binaries must match the manifest inventory and tests before use.

## Committed inventory

| Asset | Purpose | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `masonry-modules.glb` | brick bays, reveals, cornice, side elevations, fire escape, shops | 339,028 | `6cb9761b4f72313c10c263433b788ab0709dc0ffea5ec5c09d551396b3074137` |
| `office-modules.glb` | limestone bays, pilasters, entrance, base/middle/top, roof | 491,948 | `64c2dd1be99c831173dc3368dc328a36f88a4c310ec7f653d1453ae856a0801f` |
| `curtain-wall-modules.glb` | Miesian grid, blue unitized, bronze fins, transparent podium | 253,568 | `b32334ef315b8a473236f947391c35c9378c70537a4f7c87d40707bdcf3a19b8` |
| `storefront-modules.glb` | reusable doors, frames, canopies, sign bands, interior cards | 46,444 | `9f29fa8522ab2ab932534d3e407f608eb03595b556109ccc07abaff0ae842d09` |
| `street-river-modules.glb` | river wall/rails, bridge abutment, lamps, signals, shelter and props | 283,100 | `80d02e236928792c944d688f5ec82880eabde75e6d7e249ce01aae4f39e5e9d9` |
| 32 PNG PBR maps | eight families × base color, normal, roughness and AO | 11,119 total | emitted individually by the deterministic generator |

Total committed payload: 1,425,207 bytes. The generator prints the complete per-file SHA-256 inventory on every run; `shasum -a 256 public/assets/city-kit-v1/**/*.png public/assets/city-kit-v1/*.glb` provides an independent verification.

## Optimization boundary

The source generator keeps named reusable roots but merges child geometry by material inside each module. The final browser measurement is 116 draw calls and 123 geometries; the unmerged intermediate (771 / 783) is prohibited from rollout.
