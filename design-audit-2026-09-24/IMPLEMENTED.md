# September 24 — refinement pass

## Implemented

- Kept the particle Hero and original 520-frame glasses reveal.
- Homepage order: Hero → Glasses → Evidence → Motion representation → Benchmark → Field → Company → Contact. Navigation and progress follow the same order.
- Tightened Evidence, Motion, Field and Benchmark introductions. Paired evidence remains one original video; viewport playback respects reduced motion and Save-Data.
- Embedded viewer has four clear activity buttons and compact mode controls. Mobile activity choices remain a 2 × 2 grid; underlying renderers and synchronization are unchanged.
- Benchmark now prioritizes one real metric with a zero-based comparison, explicit better direction, selected method's four exact values, sequence switch and expandable source table. Removed derived radar axes. Preserved GND decimal precision and reported uncertainty.
- Calmed magnetic controls, unified Request a Demo language, added Sports and Coaching to the contact form.

## Browser checks

- 1280 × 800: chapter layout and navigation inspected; Benchmark ~1,055 px tall compared with ~2,362 px in the prior audit.
- 390 × 844: no page-level horizontal overflow; activity grid, mode switch and selected-method details inspected.
- Switched T-head → GND, SEQ 128 → SEQ 32, CeRebel → NoShape; verified the selected profile matches the source values and retains 0.94±0.01.
- Expanded the source table and checked text contrast on the dark background.
- No browser console errors during the checks. Preview: http://127.0.0.1:5176/.

## September 27 continuation

- Glasses copy now leads with the confirmed in-lens AR display and camera/sensor capture capabilities.
- Added a persistent product name, development-visualization disclosure, and a working View real capture link to Evidence.
- Separated desktop product imagery and copy to prevent overlap; retained the original gray studio sequence and mobile/static fallbacks.
- Checked desktop and 390 px mobile layouts, plus pointer and keyboard activation of the Evidence link.

## Validation status — September 27

- Frontend production bundle passed with public-asset copying disabled, output at /tmp/cerebel-ui-validation. This verifies code compilation, not a complete deployment package.
- Full npm run build now passes, including public assets, worker and hosting metadata. The latest build includes the glasses refinements.
- All 10 tests in npm run test:sites pass, including deployment artifacts.
- Typecheck still stalls while reading existing Three.js declaration files and has not completed; do not report it as passed.
- No public deployment performed.

The new glasses use-demo is a storyboard only: see GLASSES-DEMO.md. Real in-lens AR footage has not yet been supplied.
