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

## Classification and committed inventory

The five building roots are hero semantic-container visuals mapped onto existing entities. Storefront, interior, street, parked-mobility and river-edge roots are `NON_SEMANTIC_URBAN_CONTEXT`. Every file is original, generator-authored and repository-licensed. GLBs are hero LOD; PNGs are shared hero/context PBR maps.

| Asset | V4.3 modification | Bytes | Approx. triangles | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `masonry-modules.glb` | thinner reveals/plinth, roof and facade depth | 306,108 | 2,472 | `f460a300e81bdff91a8f6b88d5f18cbfdff5d0ce0d8f27b55b855a511a2da461` |
| `office-modules.glb` | base, entrance hierarchy and roof silhouette | 473,464 | 3,876 | `a6ed9d15ffeb133ccc52432513729388f8bfc5be48c4796e71236bb29246f28c` |
| `curtain-wall-modules.glb` | dark-steel, blue/spandrel and transparent-podium systems | 199,932 | 1,496 | `eb8c84aa937df3de679c48d947966ddf9b8eca75db69e6b4a1ff7e9d62d7d313` |
| `storefront-modules.glb` | eight program fronts, entries and shallow interiors | 271,520 | 1,784 | `0d07097e1cff15b035df5d325499c5862502a9d1000ad93d39842ff71cd2bf8e` |
| `street-river-modules.glb` | pavers, curb/gutter, loading, riverwalk, stairs, rail and abutment detail | 427,636 | 3,204 | `37ba0e1e0248f8abb4973008674ae68dfbc5a6bc1538665e94f67261200c3259` |

Every PNG row is an original deterministic procedural map; V4.3 raises brick and limestone to 128² while retaining 64² for lower-screen-footprint families.

| Asset | Dimensions | SHA-256 |
| --- | ---: | --- |
| `textures/brick-basecolor.png` | 128×128 | `5e6f7f18925157d8c00a2f04d984c9b7ff214a8f462e5b5e0d288d5cef483595` |
| `textures/brick-normal.png` | 128×128 | `d369d2c194630412d2a7503e9e5b8619ff7db4c5852b68735084c9d2c20e4502` |
| `textures/brick-roughness.png` | 128×128 | `59d28618cd977172601ce99bf576effd7821c00d1caf817e95b4bc0528b0d2af` |
| `textures/brick-ao.png` | 128×128 | `aa0871b960ae0d252b7c408bc34770754ce91375e56917b8ed6b71be6d1f6645` |
| `textures/limestone-basecolor.png` | 128×128 | `ed202f921112ebfdd4ebf44c35d73f861e62640256d2293a338696c398343181` |
| `textures/limestone-normal.png` | 128×128 | `b1eb2a002ccd39e1cef02327f905701a2f3f69fe21d7bef48d2c5981de477056` |
| `textures/limestone-roughness.png` | 128×128 | `0e73cc0dc20b4dd34763b9dd83ad8dfa8c2dfc0fb4080fdfa747d35589981781` |
| `textures/limestone-ao.png` | 128×128 | `2ee013aad4661bbfef01eb613700c0b1b99ee3706b75354d8e07761ae95fbe17` |
| `textures/concrete-basecolor.png` | 64×64 | `3f6c1b437ec93e166b4115b8b1716795ea18c709c2f0978bc5e53991615e7d17` |
| `textures/concrete-normal.png` | 64×64 | `df3e8a1edd362948a93646c9ac5c9a0fca0ddf3090f24d4e9a640f82f12fbbfd` |
| `textures/concrete-roughness.png` | 64×64 | `cf1b866d809a68d5aba560a2bcf000d47d5e1146707ae210379f60713359956d` |
| `textures/concrete-ao.png` | 64×64 | `3eb66f950bead4d4d37c7e3dd021b25a749e814f9154defb3748c621536d1012` |
| `textures/metal-basecolor.png` | 64×64 | `4b451ffe16be85f51d2b1dfd9d778e1826b046b97417367d538981c666495bea` |
| `textures/metal-normal.png` | 64×64 | `a32961813c858ab89b0df90abb10f02e6114aa4cdc2141ebc64709443278bbed` |
| `textures/metal-roughness.png` | 64×64 | `baf6ded5188417415914a86d0e3ceb74bc452030624c600b8286790d608b527d` |
| `textures/metal-ao.png` | 64×64 | `d05576b89a519eb1ebd15dca74f2dfd0d24bb5484c9d04718e7855ceb60c3b0f` |
| `textures/asphalt-basecolor.png` | 64×64 | `42f5e7c6b2f180d0fff6fdcd60ea3ecfc88cee44f11fbb9607a7ffb4e7de3da2` |
| `textures/asphalt-normal.png` | 64×64 | `6d8cf8b80ab26d3c87ea7f66a28adf353204cc10aab67007e38e74cd42f43da9` |
| `textures/asphalt-roughness.png` | 64×64 | `25fe27a0238601e83c7111cdb86bf559587eeb6b4fe70adf9cf18c0c98e43241` |
| `textures/asphalt-ao.png` | 64×64 | `890fc0b452dfc9f5e85ed492d27b866aea962cceccd96f9406d244440e99eb1e` |
| `textures/sidewalk-basecolor.png` | 64×64 | `a67fce4ac4640228cabb42dbe79acc1e3b11141f2a7399150b540041f9d79d4b` |
| `textures/sidewalk-normal.png` | 64×64 | `df3e8a1edd362948a93646c9ac5c9a0fca0ddf3090f24d4e9a640f82f12fbbfd` |
| `textures/sidewalk-roughness.png` | 64×64 | `cf1b866d809a68d5aba560a2bcf000d47d5e1146707ae210379f60713359956d` |
| `textures/sidewalk-ao.png` | 64×64 | `3eb66f950bead4d4d37c7e3dd021b25a749e814f9154defb3748c621536d1012` |
| `textures/river-basecolor.png` | 64×64 | `5d0c46f2e2763058988fa0f4dc26d481d84f627e8716f3cc9326ed618ab65c2d` |
| `textures/river-normal.png` | 64×64 | `a32961813c858ab89b0df90abb10f02e6114aa4cdc2141ebc64709443278bbed` |
| `textures/river-roughness.png` | 64×64 | `9a805980abf08bf631a6e3ca5800f33a2a64acc5d5699091e52927db35e68447` |
| `textures/river-ao.png` | 64×64 | `d05576b89a519eb1ebd15dca74f2dfd0d24bb5484c9d04718e7855ceb60c3b0f` |
| `textures/roof-basecolor.png` | 64×64 | `a6fbbc56939b054c13ecac13f96ab035c4fb729484bc29cc78259716650260f8` |
| `textures/roof-normal.png` | 64×64 | `9c45f61d173a74e86973b85ed879156c70cae1bab1a1ec722e5ff4fee65f95a6` |
| `textures/roof-roughness.png` | 64×64 | `18a8ce5ca84ffbd581b28e287ce6153244932f817af4bba72a4e4bcce18e92b7` |
| `textures/roof-ao.png` | 64×64 | `54ca87cfe200b3841c511d33f42f3ed6474c25845ba43715afc13c898a13360f` |

Total committed payload: 1,691,674 bytes. The generator prints bytes, triangle estimates, dimensions and the complete SHA-256 inventory on every run.

## Optimization boundary

The source generator keeps named reusable roots but merges child geometry by material inside each module. The final browser measurement is 116 draw calls and 123 geometries; the unmerged intermediate (771 / 783) is prohibited from rollout.
