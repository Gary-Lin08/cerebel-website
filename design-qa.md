# Design QA — TryMira-inspired Hero, Option 1

## Source and implementation

- Selected source visual: `/Users/kaijunlin/.codex/generated_images/01a02a0b-f729-7080-9446-f185bac51a75/exec-5dd5c8b1-a6f7-4a1d-a2c4-23b21eed7028.png`
- Final desktop implementation capture: `/Users/kaijunlin/Desktop/motionverse ai website/screenshots/option-1-implementation/desktop-1487x1058-v3.png`
- Final side-by-side comparison: `/Users/kaijunlin/Desktop/motionverse ai website/screenshots/option-1-implementation/design-qa-side-by-side-v3.png`
- Final mobile capture: `/Users/kaijunlin/Desktop/motionverse ai website/screenshots/option-1-implementation/mobile-390x844-v2.png`
- Route: `/`
- Viewport: 1487 × 1058 CSS pixels for desktop; 390 × 844 CSS pixels for mobile
- UI state: Hero at rest after the introductory morph; mobile tap interaction also checked in the cerebellar state

## Full-view comparison

The implementation preserves the source visual's principal composition: borderless navigation, oversized left-aligned editorial headline, a monumental silver particle body occupying the middle/right of the viewport, restrained electric-purple state cues, and an Evidence threshold anchored to the bottom edge. The live version keeps the existing verified Cerebel statement, chips, CTAs, and real precomputed particle assets rather than using the mock's speculative copy or an invented human model.

## Focused-region checks

- Headline and particle overlap: headline remains readable while the particle body crosses behind the text field without a panel divider.
- Particle stage: the body is immediately visible, brighter than the previous iteration, and extends beyond its former right-side container.
- Evidence threshold: three-part hierarchy remains legible at the bottom of the desktop Hero and becomes an in-flow card below the mobile particle stage.
- Mobile: no horizontal overflow at 390 px (`scrollWidth === innerWidth === 390`); the accessible mobile navigation and CTA stack remain intact.
- Interaction: tapping the mobile particle stage successfully toggles from the articulated body to the cerebellar field.
- Runtime: no browser console errors were present in the tested state.

## Comparison history

1. Initial implementation: headline broke into too many lines and the particle form remained too contained on the right. Fixed by widening the editorial field, scaling the desktop point body to 1.82×, and moving the particle stage into the page composition.
2. First refinement: the lede orphaned “from”, while the body still read slightly dim and high. Fixed by grouping the copy/flow spans, increasing particle luminance and alpha, and shifting the desktop form left and down.
3. Post-fix recapture: confirmed the selected composition at the exact source viewport and verified the mobile fallback separately.

## Remaining differences

- P0: none.
- P1: none.
- P2: none.
- P3: the live articulated pose differs from the generated concept because the site uses Cerebel's actual checked-in particle asset and existing motion sequence. This is intentional and improves truthfulness without changing the selected composition.

final result: passed
