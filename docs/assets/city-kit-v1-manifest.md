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

## Planned inventory

| Asset | Purpose | Provenance | Status |
| --- | --- | --- | --- |
| `masonry-modules.glb` | brick/stone bays, reveals, cornices, corners, fire escape | original | pending generation |
| `office-modules.glb` | limestone bays, pilasters, entrances, roof terminations | original | pending generation |
| `curtain-wall-modules.glb` | three structural glass systems and lobby/crown pieces | original | pending generation |
| `storefront-modules.glb` | doors, frames, canopies, sign bands, interior cards | original | pending generation |
| `street-river-modules.glb` | curbs, lamps, signals, river wall, railing, abutment | original | pending generation |
| PBR texture set | base color, normal, roughness, metal/AO where appropriate | original procedural authoring | pending generation |

Final byte sizes and SHA-256 values will replace the pending status after generation.

