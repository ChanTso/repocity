# Visual system

RepoCity's current renderer combines semantic geometry with non-semantic urban context.

## Full-city Chicago Kit v2 development candidate

Chicago Kit v2 extends the asset strategy from five complete hero roots to nine deterministic modular architectural families across all 72 semantic-core envelopes. The runtime fits discrete bays and floors, then instances module boxes in shared material batches. Ring 1 receives family facade structure; Rings 2–3 receive family silhouettes and roof treatments rather than blank slabs.

Outer districts intentionally use progressively simpler LOD. The public alpha does not claim uniform close-range fidelity or photo-realism.

## Visual rules

- A semantic selection must remain traceable to repository entities.
- Context assets may communicate scale, land use, circulation, or architectural hierarchy, but not software facts.
- Flow tokens and routes must remain distinct from ambient traffic and people.
- Camera presets support reproducible review and documentation.
- Product screenshots must be real captures without browser chrome, private information, debug overlays, or generated replacement scenery.
- Visual contributions must record origin, license, attribution, checksum, and semantic classification.

## Semantic Lens modes

| Mode | Dominant layer | Secondary context |
| --- | --- | --- |
| Explore | normal city materials and configured ambient life | minimal active-selection semantics |
| Map | component ownership, building envelopes, addresses, labels, optional one-hop relations | desaturated city and reduced ambient life |
| Flow | evidence route, stations, tokens, stage and provenance | reduced ambient life and semantic destination |
| Replay | Git event and changed-entity state | stable semantic ownership and reduced ambient life |

Semantic labels use a deterministic priority cap of 12 and are generated once per selection/mode change. Static relations are thin, non-emissive dashed lines; evidence journeys retain their routed, emissive, animated language. Ambient implementation paths are never shown.

Selected file/building labels outrank unselected component labels, and product HUD panels render above the WebGL canvas. General screen-space label collision avoidance is not implemented; dense world-space angles may still overlap and remain a future improvement.

Mode saturation and brightness use a CSS filter on the complete WebGL canvas. The filter therefore affects city geometry, semantic overlays, journeys, and replay geometry together; it is not an independently selective “city-only” treatment. Ambient opacity/speed and semantic/relation opacity are renderer-level layer controls. Mode switches preserve the current camera, while the Map overview button and review-camera key `6` apply the public-alpha overview explicitly.

## Living Streets activity layer

The ambient plan uses existing connected roads, validated public frontages, sidewalks, crossings, bridge walks, riverwalks, and river bounds. Motion is explicit: `closed-loop` routes contain a real final-to-first segment, `ping-pong` is reserved for finite walking approaches, and `offscreen-wrap` carries boats unidirectionally beyond the review bounds. Vehicles are lane-offset, capacity-limited, instance-batched, and share a route clock so dwell cannot reorder them. Entrances project to sidewalk segments and are rejected when sampled geometry intersects rotated footprints or water. Day/night details use shared emissive instances rather than dynamic per-agent lights.

All ambient agents remain `NON_SEMANTIC_URBAN_CONTEXT`. They are unselectable, use no repository density metric, and never receive the evidence token's silhouette, route pulse, stage number, or provenance UI.

Diagnostics distinguish `planned` from `enabled` ambient counts. No count is called visible because no camera census exists. Evidence token count is the exact current journey token-array length.

See [Chicago Kit v2](CHICAGO_KIT_V2.md), [the v2 asset manifest](assets/city-kit-v2-manifest.md), [the v1 asset manifest](assets/city-kit-v1-manifest.md), [V4.2 asset strategy](VISUAL_CITY_V4_2.md), and [V4.3 street-reality pass](VISUAL_CITY_V4_3.md).
