# Motionverse AI Website Redesign Brief

## Current design audit

The selected visual direction has a strong foundation: near-black surfaces, off-white editorial typography, restrained signal orange, precise technical annotation, coordinate systems, timelines, and cinematic depth. It feels engineered rather than decorated.

The main weaknesses are structural and narrative:

- The full-body sensor suit makes Motionverse look like an IMU motion-capture suit manufacturer.
- Hero, market comparison, hardware architecture, system status, data formats, and pipeline all compete within one viewport.
- Small technical copy is too dense for a real marketing experience and creates accessibility risk.
- Raw egocentric video is described too absolutely; it is useful and scalable, but requires substantial reconstruction, synchronization, annotation, and processing before it becomes structured motion data.
- Detailed export formats and output fields appear confirmed even though their readiness is not established.
- The vertical rail has character but occupies too much space and reads like a concept dashboard.

Because the repository was empty at the start of implementation, there was no existing runtime, responsive behavior, or claim set to preserve beyond the selected visual mock and the supplied product brief.

## Narrative reset

Motionverse is building the interface between human physical intelligence and intelligent machines.

Core belief:

> Intelligence lives not only in language, but also in movement, interaction, and action.

Primary external statement:

> We make human physical intelligence legible to machines.

Product principle:

> Capture naturally. Structure precisely. Deploy anywhere.

Engineering principle:

> Built for the real world, not only the lab.

The story moves from natural human action to lightweight egocentric capture, reconstruction of body, hands, objects, and contact, temporal structuring, and downstream machine use.

## Site architecture

1. Hero — immediate positioning and conversion
2. The Data Gap — portability versus structured data
3. How Motionverse Works — scroll-led capture, understand, structure, deploy sequence
4. Technology Stack — integrated hardware, vision, sensing, perception, synchronization, and data pipeline
5. Robotics and Embodied AI — transferable demonstration data
6. Application Scenarios — interactive robotics, industrial, sports, and research scenes
7. Wearable Platform — conceptual modular glasses platform
8. Partner Solutions — end-to-end wearable-system development
9. Company Vision — calm, ambitious long-term thesis
10. Book a Demo — accessible conversion form with explicit states

## Hero concept

A person wearing lightweight camera glasses completes a precision assembly task in normal clothing. The action remains recognizably human and real. Sparse overlays reveal the first-person field of view, hand-object contact, reconstruction, and temporal trajectories. The hero is understandable as a static image; pointer depth and progressive tracking provide enhancement rather than meaning.

## Visual system

- Background: near black (`#090a0a`) with graphite section shifts
- Primary text: warm off-white (`#f0ede7`)
- Secondary text: neutral gray (`#a7a29a`)
- Accent: signal orange (`#ff5a1f`) used only for active states, coordinates, flow, and primary actions
- Display and body: Space Grotesk Variable
- Technical labels: IBM Plex Mono
- Grid: twelve columns on desktop, six on tablet, four on mobile
- Surfaces: mostly open fields, image planes, rules, and editorial grouping; cards are reserved for form and focused selectable controls
- Corners: square to subtly rounded; no soft SaaS-card language

## Motion system

1. Ambient — slow grid and signal drift, low-frequency tracking pulse
2. Scroll storytelling — sticky visual evolves from field of view to reconstruction to temporal output
3. Direct feedback — directional button response, active application transitions, highlighted annotations
4. Major transitions — dense technical regions open into the company vision section

Motion uses restrained springs and cubic easing. Reduced-motion mode removes pointer parallax, sticky animation interpolation, and nonessential transforms.

## Component plan

- `Navigation` with active-section tracking and full-screen mobile menu
- `SectionLabel` and reusable editorial heading pattern
- `Hero` with pointer-responsive media plane and semantic CTAs
- `DataGap` continuum with qualitative axes
- `HowItWorks` sticky sequence with four steps and progressive visual states
- `TechnologyStack` layered system list
- `Robotics` demonstration narrative
- `Applications` keyboard-accessible scene selector
- `WearablePlatform` conceptual exploded product view
- `PartnerSolutions` service matrix and partnership CTA
- `Vision` open closing statement
- `DemoForm` with validation, loading, success, and error states
- `Footer` with placeholder links clearly marked

## Mobile adaptation

- Replace the desktop navigation with a full-screen menu.
- Remove pointer interactions and simplify layer counts.
- Convert the sticky pipeline into a vertically paced sequence with a fixed-height visual window.
- Use edge-to-edge imagery and larger technical labels rather than shrinking desktop annotations.
- Keep primary CTA targets at least 44 pixels high and prevent horizontal overflow.
- Preserve the hero story through image crop and explicit text labels when motion is unavailable.

## Technical implementation

- Product Design Vite starter with React and TypeScript
- Motion for progressive interaction with reduced-motion support
- Phosphor icons for consistent interface symbols
- Local variable fonts through Fontsource
- Responsive raster assets generated specifically for each visual slot
- Semantic landmarks, heading hierarchy, keyboard states, focus visibility, and live form status
- Intersection Observer for active-section navigation
- Native image lazy loading below the fold
- Production build, lint, type checking, Sites worker test, desktop/mobile browser verification, and design QA against the selected source visual

## Claim policy

The page uses capability categories rather than unverified metrics or file formats. Language is intentionally framed as “designed to support,” “can be used to explore,” and “built for” where deployment readiness is not established. Product imagery is labeled as conceptual.
