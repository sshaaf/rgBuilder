# Universe 3D visual target (revisit)

**Status:** deferred polish — functional LOD/navigation first; scene art pass later.  
**Reference:** [GitHub issue #61](https://github.com/sshaaf/rgBuilder/issues/61) design frame (attached JPEG / Figma Make concept).  
**Interactive mockup:** `file:///Users/sshaaf/Downloads/rg-universe-mockup.html` (also referenced in `docs/universe/` when checked in).

## Goal

Match the **issue #61 JPEG** spatial language — not just HUD chrome (Phase 0), but the **cosmos rendering**:

| JPEG / mockup element | Current Three.js (2026-08) | Target direction |
|----------------------|------------------------------|------------------|
| Soft galaxy nebula + star field | Flat `#07080f` + point stars | Layered nebula gradients per community hue; parallax stars |
| Community = spiral dust + glow + label | Solid sphere + faint glow | Instanced arm particles, emissive core, community name + member count billboard |
| Package = dashed orbit ring + dot | Solid box | Torus/ring + orbiting marker, mono label |
| Unit (L4) = nested orbit | *(Phase 1)* small sphere ring | Same ring language at smaller radius |
| L5 neighborhood = radial inset | *(Phase 2)* 3D radial graph | Full 3D call graph with edge pulses on selection |
| Bridge lines = weighted curves + flow dots | Straight dim lines | Quadratic curves, weight-scaled opacity, animated flow when emphasis on |
| Migration / taint | Amber rings + red glow (done) | Align palette with mockup `#F0A050` / `#F26D6D` |

## Constraints

- **LOD first** — never render full-repo function graph at L1; art passes must respect instancing + lazy load.
- **Performance** — prefer instanced meshes / points over per-frame canvas 2D (mockup is 2D canvas; production is WebGL).
- **Accessibility** — `prefers-reduced-motion` disables bridge flow, galaxy rotation, and fly-to easing.

## Implementation ideas (when we schedule the art pass)

1. **Community shader** — radial gradient + additive dust in fragment shader; hue from `communities.json` color.
2. **CSS2DRenderer or troika-three-text** — community/package labels (Phase 4 stub → full pass here).
3. **Bridge emphasis** — duplicate line geometry with higher opacity + `sin(time)` particle on curve (Phase 4 partial).
4. **Reference capture** — export screenshot from mockup + issue JPEG side-by-side in PR checklist.
5. **Optional export-time art hints** — `universe.json` community `hue_rgb` for consistent nebula tinting.

## Tracking

- OpenSpec: `openspec/changes/rg-universe-phase-0/design.md` § Open Questions → resolved; this doc is the art-phase backlog.
- Do **not** block Phases 1–4 analysis/navigation work on this pass.
