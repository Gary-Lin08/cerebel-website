# Phase 0–1 Design QA

Date: 2026-07-28

## Scope

- Removed visitor-facing contact and footer placeholders.
- Moved Reconstruction Evidence and AMASS Benchmark directly after the hero.
- Added Benchmark to desktop and mobile navigation.
- Added the core brand statement to the hero.
- Changed the hero secondary action to “See the Proof.”
- Replaced the active-section observer with a reading-line calculation so navigation and the vertical progress indicator remain accurate after the page reorder.

## Visual review

- Desktop: 1440 × 1000
- Tablet: 768 × 900
- Mobile: 390 × 844
- No horizontal overflow at the tested responsive sizes.
- Hero comparison: `screenshots/phase-01/hero-before-after.png`
- Final desktop hero: `screenshots/phase-01/hero-desktop.png`
- Final mobile hero: `screenshots/phase-01/hero-mobile.png`
- Final desktop benchmark: `screenshots/phase-01/benchmark-desktop.png`
- Final mobile benchmark: `screenshots/phase-01/benchmark-mobile.png`
- Final mobile menu: `screenshots/phase-01/menu-mobile.png`

## Interaction review

- “See the Proof” lands on `#evidence`.
- Desktop Benchmark navigation lands on `#benchmark`.
- Mobile Benchmark navigation closes the menu and lands on `#benchmark`.
- Benchmark metric selection reranks the chart and updates the inspector.
- Active navigation and page progress update correctly for Evidence and Benchmark.
- No browser console warnings or errors were observed.

## Automated checks

- TypeScript typecheck passed.
- Scoped ESLint passed for the changed public-site files.
- Production build passed.
- Sites packaging tests passed: 7/7.
- Required Sites output files are present.
- `git diff --check` passed.
- No visitor-facing placeholder copy remains in `src/`.
