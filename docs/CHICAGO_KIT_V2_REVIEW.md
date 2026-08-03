# Chicago Kit v2 owner visual review

Status: **ready for owner visual review; not owner-approved**.

The implementation checkpoint and automated semantic/performance gates passed. This record does not fabricate approval. The repository owner should review the real UI-hidden images in `screenshots/chicago-kit-v2/review-fixes/` and record short answers below. Start with `contact-sheet.png`, then inspect the full-resolution files before deciding.

## Three-second questions

1. Does this read as a city within three seconds? — **Pending owner answer**
2. Does it feel Chicago-inspired without copying a landmark? — **Pending owner answer**
3. Can Fulton brick, Loop masonry, Miesian glass, and riverfront contemporary architecture be distinguished? — **Pending owner answer**
4. Do adjacent buildings look historically related but not cloned? — **Pending owner answer**
5. Does the background city support the hero view rather than reveal simplified boxes? — **Pending owner answer**
6. Do shops, lobbies, and entrances read at street level? — **Pending owner answer**
7. Does the city still function as RepoCity in Map and Flow modes? — **Pending owner answer**

## Implementer self-review

- The overview now reads as one layered city rather than five detailed roots surrounded by blank slabs.
- Fulton warehouse, Loop masonry, Miesian grid, civic limestone, and contemporary river language are geometrically distinct.
- Exact neighboring signatures and repeated facade rhythms are eliminated deterministically. All 90 named rhythm/base/corner/roof choices across nine families now resolve to canonical recipes; within each family and category their pure geometry fingerprints are pairwise distinct.
- Representative Chicago School canonical fingerprints are `586d57b5 / 040d1f4c / 4c103c56` for its three rhythms, `342349f7 / 4813772e` for its two bases, `f3e4a247 / 7ace98e9` for its two corners, and `46b3a083 / c0584d83 / ed8f7e70` for its three roofs. The compiled fingerprints additionally include local module placement, dimensions, rotation, and material, so changing world translation or semantic IDs does not create a false variant.
- Ring 1 contributes facade structure; Rings 2–3 contribute varied silhouettes instead of a single blank-wall treatment.
- Storefronts and entrances are more continuous, while their non-semantic boundary remains explicit. Compiled geometry measures 88% active frontage citywide and 87.9993% in Fulton; deleting storefront geometry makes the metric fail at 0%.
- LOD is now real geometry reduction: 11,448 modules at LOD0, 4,096 at LOD1, and 1,376 at LOD2. Only LOD0 contains storefront, detailed window, mullion, awning, and spandrel modules. Selection remains a single forced-LOD0 overlay.
- Primary/secondary, party, rear/service, and exposed-end treatments are separate compiler paths. Party-wall window/mullion count is zero; every actual street-corner building has exactly one corner body rather than four decorative corner posts.
- `app/lib/chicago-kit-v2-definition.json` is consumed by both runtime and GLB generation. Catalog root maps and 90 recipe fingerprints are checked for exact parity.
- Shared deterministic brick, stone, concrete, and metal maps now prevent flat-color material allocation without creating textures per building. The strongest remaining weakness is still close-range realism: mortar scale, window/interior depth, reflections, and distant atmospheric integration remain alpha-quality.
- The bronze-modern family is intentionally rare and may be difficult to identify in a three-second overview; dedicated review cameras provide the evidence.

## Corrective-pass automated evidence

| Gate | Result |
| --- | ---: |
| Named variant geometry fingerprint checks | 90 / 90 distinct within family and category |
| Fixed demo building fingerprints | 72 / 72 distinct |
| LOD0 / LOD1 / LOD2 module counts | 11,448 / 4,096 / 1,376 |
| Active frontage / Fulton | 88% / 87.9993% |
| Blank context fallbacks | 0 |
| Adjacent-envelope projection penetrations | 0 |
| Three-tier compiler p95 (20 fixed-fixture runs) | 83.646 ms |
| Focused review suite | 50 passed |

## Pixel package

All images below are 1920×1080 and hide the HUD. `map-selected-component.png` intentionally keeps the in-scene semantic overlay, and `flow-with-living-streets.png` intentionally keeps evidence plus ambient vehicles, pedestrians, and boats visible.

- `explore-overview.png`
- `fulton-street.png`
- `loop-street-canyon.png`
- `miesian-glass.png`
- `riverfront-tower.png`
- `civic-anchor.png`
- `context-rings.png`
- `dusk-skyline.png`
- `map-selected-component.png`
- `flow-with-living-streets.png`
- `contact-sheet.png`

Owner approval or requested corrections belong in this Draft PR's visual-review step. Automated acceptance is not presented as owner approval.
