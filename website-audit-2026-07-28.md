# Motionverse Website Audit — 2026-07-28

## Audit scope

Combined UX, visual-design, conversion, responsive, and screenshot-based accessibility review of the public Motionverse website at desktop 1440 × 1000 and mobile 390 × 844.

## Overall verdict

The site already has a distinctive, credible deep-tech visual identity. Its strongest qualities are editorial scale, cinematic imagery, disciplined technical annotations, and unusually transparent product evidence. The next gains should come from credibility cleanup and narrative compression, not additional visual complexity.

## Journey steps

1. **Desktop hero — Strong.** Clear category positioning, memorable imagery, and two visible actions. The headline is compelling but still somewhat generic for the physical-intelligence category.
   - Evidence: `screenshots/audit-2026-07-28/01-hero-desktop.png`
2. **How it works — Strong.** The four-step model is understandable and the active step has a good visual relationship to the system image.
   - Evidence: `screenshots/audit-2026-07-28/02-process-desktop.png`
3. **Reconstruction evidence — Strong.** Synchronized egocentric and SMPL views are the site’s most concrete product proof and should remain a centerpiece.
   - Evidence: `screenshots/audit-2026-07-28/03-evidence-desktop.png`
4. **Benchmark overview — Strong, slightly slow to reach the evidence.** The protocol is transparent and the leader statement is easy to understand.
   - Evidence: `screenshots/audit-2026-07-28/04-benchmark-overview-desktop.png`
5. **Benchmark interaction — Strong.** Metric selection, ranked field, exact values, and method inspection coordinate well without relying on hover.
   - Evidence: `screenshots/audit-2026-07-28/05-benchmark-interaction-desktop.png`
6. **Technology stack — Healthy but repetitive in pacing.** The hardware visual is polished and correctly labeled conceptual, but the large-heading-plus-large-image rhythm repeats several times.
   - Evidence: `screenshots/audit-2026-07-28/06-technology-desktop.png`
7. **Applications — Healthy.** The selectable scenarios are clear, but this section arrives late after several adjacent explanations of the same system.
   - Evidence: `screenshots/audit-2026-07-28/07-applications-desktop.png`
8. **Desktop demo conversion — Needs trust cleanup.** The form is visually clear, but a visible internal contact placeholder makes the site feel unfinished.
   - Evidence: `screenshots/audit-2026-07-28/08-demo-desktop.png`
9. **Mobile hero — Strong but tall.** The headline and CTAs remain legible, though the first section consumes nearly the full viewport before any concrete proof appears.
   - Evidence: `screenshots/audit-2026-07-28/09-hero-mobile.png`
10. **Mobile navigation — Strong structure, incomplete proof navigation.** The menu is deliberate and usable, but it does not expose the benchmark directly.
    - Evidence: `screenshots/audit-2026-07-28/10-mobile-menu.png`
11. **Mobile benchmark — Clear but too tall before interaction.** The protocol consumes most of the first viewport; the chart begins well below it.
    - Evidence: `screenshots/audit-2026-07-28/11-benchmark-mobile.png`
12. **Mobile demo — Needs trust cleanup and conversion reassurance.** The direct contact placeholder is prominent and the form begins below a long setup block.
    - Evidence: `screenshots/audit-2026-07-28/12-demo-mobile.png`
13. **Mobile footer — Needs immediate cleanup.** LinkedIn, X, and Privacy all visibly say “Placeholder,” which creates a high-confidence unfinished-product signal at the final trust checkpoint.
    - Evidence: `screenshots/audit-2026-07-28/13-footer-mobile.png`

## Strengths

- Distinctive black, warm-white, orange, and data-blue system; the benchmark’s color roles remain semantic.
- Consistent editorial hierarchy and technical annotation language.
- Real qualitative evidence and transparent benchmark caveats build more trust than generic marketing claims.
- Desktop and mobile navigation are designed as separate responsive states rather than a compressed desktop menu.
- One `h1`, ordered `h2` sections, labeled form controls, and an accessible mobile-menu close control were observed.
- No browser console warnings or errors appeared during the audited journey.

## Highest-impact risks

### P0/P1 — Remove every public placeholder

The contact-area instruction and footer social/privacy placeholders are visible to visitors. This is the most urgent issue because it undermines trust precisely where users decide whether the company is real and ready to contact.

### P1 — Shorten the evidence journey

On mobile the page is approximately 17,514 px tall across 12 main sections. The evidence and benchmark are the most persuasive material, but visitors pass through the data-gap and process explanations first. Consider a tighter order:

1. Hero and differentiated brand statement
2. Synchronized evidence demo
3. Benchmark
4. How the system works
5. Applications and platform
6. Company and demo

The data-gap and process sections can be compressed; Robotics and Applications can likely become one stronger use-case section.

### P1 — Make the differentiator unmistakable above the fold

“Capture Human Motion. Train Intelligent Machines.” is polished but can fit several companies. Bring “We make human physical intelligence legible to machines” into the hero or its first transition so the product’s distinct intellectual position is understood immediately.

### P2 — Promote proof in navigation

The navigation exposes Evidence but not Benchmark. Rename the destination to “Proof,” add Benchmark as a direct destination, or make Evidence open a compact submenu. The benchmark is now strong enough to function as primary trust content.

### P2 — Compress the mobile benchmark setup

The mobile protocol stack consumes most of a viewport before the interactive chart. Collapse the protocol into one summary rail with an expandable methodology detail so the first ranking appears earlier.

### P2 — Break the repeated section rhythm

Several later sections repeat the same structure: oversized heading, muted paragraph, large cinematic image. Keep the visual system, but alternate the reading density with one compact section, one proof-led section, and one image-led section. This will reduce the feeling of a long pitch deck.

### P2 — Strengthen conversion reassurance

The demo form asks for five fields after a long page. Clarify what happens after submission and why each field is useful. If true, add response-time or privacy reassurance; otherwise keep the promise qualitative. Consider making Organization and Message optional at the first contact step.

## Accessibility risks

- Small monospace annotations and low-contrast gray body copy may be difficult to read, particularly on dark mobile sections. Exact contrast ratios were not measured in this screenshot audit.
- The form fields were not marked as natively required in the inspected DOM. Custom validation may still exist, but required state, field-level errors, and screen-reader announcements need explicit testing.
- The benchmark’s selected state has strong color plus inversion and focus indication, which is a positive redundant encoding.
- Heading structure and visible form labels appeared healthy in the sampled DOM.

## Evidence limits

- This was a screenshot and sampled-DOM audit, not a full WCAG conformance test.
- Keyboard traversal was sampled only around the benchmark and mobile menu.
- Form submission was not performed to avoid creating a lead, so error recovery and success messaging were not validated.
- Reduced-motion behavior, screen-reader announcements, browser zoom, and real-device video performance still need dedicated testing.

## Recommended order of work

1. Remove placeholders and confirm real contact, social, and privacy destinations.
2. Reorder and compress the narrative so proof appears earlier.
3. Promote Benchmark/Proof in navigation and tighten its mobile introduction.
4. Differentiate the hero with the core physical-intelligence statement.
5. Add conversion reassurance and run a focused accessibility pass.

