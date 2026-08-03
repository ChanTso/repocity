# Chicago Kit v2 owner visual review (historical)

> This records the rejected intermediate visual baseline. The corrective baseline was later accepted for the v0.2.0 showcase; see [Chicago Kit v2](CHICAGO_KIT_V2.md) and the [final media manifest](media/README.md).

Status: **OWNER VISUAL REVIEW FAILED**.

The engineering foundation, semantic integrity, and performance direction are accepted. The actual pixels in `screenshots/chicago-kit-v2/review-fixes/contact-sheet.png` are not visually accepted: the scene reads as a procedural low-poly building test rather than a Chicago-inspired stylized city. PR #6 remains Draft and must not be merged or released as v0.2.

## Three-second questions

1. Does this read as a city within three seconds? — **No.** It first reads as a low-poly model city.
2. Does it feel Chicago-inspired without copying a landmark? — **No.** River, bridge axis, continuous historic street walls, Miesian grids, and skyline hierarchy are not legible.
3. Can Fulton brick, Loop masonry, Miesian glass, and riverfront contemporary architecture be distinguished? — **No overall.** Fulton is partially identifiable from brick; the other families remain too box-like.
4. Do adjacent buildings look historically related but not cloned? — **No.** Similar narrow towers, bases, and black rooftop boxes dominate overview and context views.
5. Does the background city support the hero view rather than reveal simplified boxes? — **No.** Context rings expose near-blank slabs.
6. Do shops, lobbies, and entrances read at street level? — **No.** The review package does not clearly reveal a shop, office lobby, or public entrance.
7. Does the city still function as RepoCity in Map and Flow modes? — **Functionally yes; visually no.** Selection and mobility survive, but the city does not support semantic memory or evidence composition.

Decision: keep PR #6 Draft. Do not merge, mark Ready, release, deploy, replace README media, or begin a v0.2 release.

## Corrective owner re-check package

Status: **OWNER RE-CHECK PENDING**. The failed decision above remains the authoritative acceptance state until the Owner reviews the replacement pixels. Automated checks and implementer inspection do not overturn it.

The corrective pass is intentionally limited to the rejected visual foundations:

- LOD selection is now independent per 28-world-unit spatial chunk. It no longer follows one citywide hero target; Ring 1 cannot fall below LOD1, and selection remains one separate forced-LOD0 overlay.
- Windows, curtain-wall panels, base openings, corners, cornices, roof houses, crowns, awnings, and the Context Ring facade grid now use cached shared non-box `BufferGeometry`. Instancing remains by material and primitive.
- Ring 1 has four-sided facade grids, public-ground openings, base/shaft/top hierarchy, real setback-shoulder massing, and recipe-driven roof silhouettes. Rings 2–3 remain progressively simpler.
- Brick, stone, concrete, and metal use separate cached sRGB albedo and linear height maps sampled in world space. Smoked and blue-green glass are translucent and reveal deterministic warm interior cards instead of rendering as black boards.
- Review cameras are architecture-specific and public-realm based: Fulton and Loop look down unobstructed streets, the Miesian view identifies the actual compiled Miesian signature, and the river view includes bridge, water, traffic, boats, and a river-facing street wall.

The replacement contact sheet is `docs/screenshots/chicago-kit-v2/owner-recheck/contact-sheet.png`. Its six source frames are genuine HUD-hidden 1920×1080 renderer captures:

1. `01-explore-overview.png`
2. `02-fulton-street-level.png`
3. `03-loop-street-canyon.png`
4. `04-miesian-facade-lobby.png`
5. `05-river-bridge-tower.png`
6. `06-context-ring1-skyline.png`

`regression-map.png` and `regression-flow.png` confirm that Semantic Lens selection and evidence Flow still render. They are regression evidence only and are not part of the six-frame visual acceptance sheet.

## Implementer self-review

- The overview now reads as one layered city rather than five detailed roots surrounded by blank slabs.
- Fulton warehouse, Loop masonry, Miesian grid, civic limestone, and contemporary river language are geometrically distinct.
- Exact neighboring signatures and repeated facade rhythms are eliminated deterministically. All 90 named rhythm/base/corner/roof choices across nine families now resolve to canonical recipes; within each family and category their pure geometry fingerprints are pairwise distinct.
- Canonical and compiled fingerprints include primitive topology as well as local placement, dimensions, rotation, and material, so changing world translation or semantic IDs does not create a false variant.
- Ring 1 contributes facade structure; Rings 2–3 contribute varied silhouettes instead of a single blank-wall treatment.
- Storefronts and entrances are more continuous, while their non-semantic boundary remains explicit. Compiled geometry measures 88% active frontage citywide and 87.9993% in Fulton; deleting storefront geometry makes the metric fail at 0%.
- LOD is now real geometry reduction: 15,236 modules at LOD0, 4,403 at LOD1, and 1,496 at LOD2. Only LOD0 contains storefront, detailed semantic-core window, mullion, awning, and spandrel modules. Selection remains a single forced-LOD0 overlay.
- Primary/secondary, party, rear/service, and exposed-end treatments are separate compiler paths. Party-wall window/mullion count is zero; every actual street-corner building has exactly one corner body rather than four decorative corner posts.
- `app/lib/chicago-kit-v2-definition.json` is consumed by both runtime and GLB generation. Catalog root maps and 90 recipe fingerprints are checked for exact parity.
- Shared deterministic brick, stone, concrete, and metal maps now prevent flat-color material allocation without creating textures per building. Close-range reflections, deep interiors, atmospheric integration, and photographic realism remain explicitly outside this corrective pass and remain alpha-quality.
- The bronze-modern family is intentionally rare and may be difficult to identify in a three-second overview; dedicated review cameras provide the evidence.

## Corrective-pass automated evidence

| Gate | Result |
| --- | ---: |
| Named variant geometry fingerprint checks | 90 / 90 distinct within family and category |
| Fixed demo building fingerprints | 72 / 72 distinct |
| LOD0 / LOD1 / LOD2 module counts | 15,236 / 4,403 / 1,496 |
| Active frontage / Fulton | 88% / 87.9993% |
| Blank context fallbacks | 0 |
| Adjacent-envelope projection penetrations | 0 |
| Three-tier compiler p95 (20 fixed-fixture runs) | 139.937 ms |
| Focused review suite | 60 passed |

Owner approval or requested corrections belong in this Draft PR's visual-review step. Automated acceptance is not presented as owner approval. Until that review occurs, the required status remains `PR6_REMAINS_DRAFT`.
