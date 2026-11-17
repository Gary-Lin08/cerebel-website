# Handoff: Cerebel scroll experience

Written for the next agent picking this up (GPT or otherwise). Read `AGENTS.md` too; its last
section ("November 15: scroll experience") records the decisions. This file is the working map.

## What this is

A scroll-driven WebGL page for Cerebel AI, in the manner of Resn's Corn Revolution
(cornrevolution.resn.global) and Orano's innovation pages: one fixed canvas, scroll is the clock,
each act has its own scene and backdrop, slanted wipes between acts. Only the interaction grammar
is borrowed. No code, models or copy from those sites.

- Branch: `scroll-experience` (pushed). `main` is untouched.
- **The original site must not change.** `/`, `index.html`, `src/main.tsx`, `src/App.tsx` are as on
  `main`. The experience is a separate page: `experience.html` → `src/experience/main.ts`.
- Run: `npm install && npm run dev`, open `http://localhost:5173/experience.html`.
- Preview link (private, owner shares it from claude.ai): https://claude.ai/artifact/46Zeph2oqYfWhTZ5hjofMJ, built with `npm run build:experience` (see AGENTS.md).
  On Vercel it is `/experience` (rewrite in `vercel.json`). Deploys are manual (Vercel CLI; see the
  October 6 note in `AGENTS.md`). Nothing has been deployed.
- Owner of this work: Keith (Creative & Product). He reviews on a retina Mac in Chrome.

## Files

```
experience.html                 entry page (noindex)
src/experience/
  main.ts                       mounts the experience
  index.ts                      all DOM: chapters' copy, rail, menu, loader, cursor, lens, HUDs, the loop
  data.ts                       ACTS, chapters (id, act index, group, length in viewport heights), benchmark rows, glasses copy
  stage.ts                      renderer, per-act backdrop, render targets, composite shader (wipe, grain, vignette), anchors → DOM
  experience.css                everything visual in DOM
  acts/origin.ts                act 0: cerebellum particles → twisting double strand → body → strand (exit); bokeh lights
  acts/swing.ts                 act 1: golf-1872 capture; particle surface + skeleton with muscle paths; per-finding camera zoom; visitor scrubbing
  acts/ski.ts                   act 2: modelled carving turn, skeleton built in code, ground-reaction arrows (illustrative)
  acts/benchmark.ts             act 3: T-head tapes on a millimetre scale, SEQ 32 / 128
  acts/glasses.ts               act 4: glasses modelled in code, exploded by scroll, four hotspots
  acts/field.ts                 act 5: constellation behind partners / company / contact
scripts/experience-shots.mjs    walks the page in headless Chrome and saves screenshots
```

## How it works

- `cloud.ts` is the shared cloud of lights. `stage.ts` draws backdrop → cloud → act scene into each target, and `palette()` blends backdrop and cloud colours across act boundaries so nothing jumps. Each act sets `bg` and `tint`.

- Native scroll. A spacer div gives the page its height; `u = scrollY / innerHeight` (smoothed) is the
  position in viewport heights. `spans` in `stage.ts` turns `chapters` into start/end positions.
- Each act implements `Act` (`stage.ts`): `scene`, `camera`, `ready`, `update(ctx)`, optional `bg`
  (top, bottom, glow colours), `offset` (shifts the subject on screen so copy has room) and
  `anchors()` (world points projected onto DOM elements with a matching `data-anchor`).
- `ctx.local(chapterId)` is that chapter's progress: below 0 before it, 0..1 inside, above 1 after.
  `ctx.t` is progress across the whole act. Acts read these and nothing else.
- Near an act boundary both acts render to targets and the composite shader wipes between them.
- Copy is real DOM (`<section class="ch" data-ch="id">` in `index.ts`), shown while its chapter is
  active. Root gets `data-act="<index>"`; CSS uses it to show act-specific HUDs. **If you insert an
  act, the indices in `data.ts` and every `data-act="n"` selector in the CSS shift.**
- To add a chapter: add it to `chapters` in `data.ts`, add a `<section data-ch>` in `index.ts`, read
  `ctx.local(id)` in the act.

## What is real and what is modelled

Keep this straight; the user cares and so does `AGENTS.md`.

| Thing | Source | Label on page |
|---|---|---|
| Cerebellum / body particles | point buffers in `public/assets/*.bin` | none needed |
| Golf surface, skeleton, muscle paths, the four findings, traces | `public/viewer-data/golf-1872/swing-analysis.json` (+ mesh, bone GLB). Team's own 60 fps capture, athlete consent confirmed | "Preview measurement · 60 fps" plus both disclosures from the JSON |
| Golf club | estimated from hand pose, not tracked | club disclosure from the JSON |
| Benchmark numbers | published AMASS table already on the site | reported values and their difference only; no ratios |
| Snow act (snowboard) | **no capture exists.** The bone model is real, its pose and motion are built in code; numbers come from two stated inputs (15 m/s, 2.25 m × 40 m sine line) by turn mechanics: lateral acceleration v²κ, lean atan(a/g), load √(g²+a²)/g | "Illustrative model · not a capture", "Computed… Not measured." The inside/outside split is drawn (arrow lengths) but never stated as a number |
| Glasses | geometry modelled in code; the glasses do not work yet | "Development concept", "Schematic of the development configuration" |

Hard rule from `AGENTS.md`: do not fuse the golf surface and skeleton into one body. They are separate
reconstructions (hands differ by up to 0.68 m). They stand side by side.

## User feedback so far (in order)

1. First pass was too static; wanted far more detail studied from the reference sites.
2. Chapters overlapped during changes → the outgoing chapter now fades before the incoming starts.
3. Particle body too bright and messy on retina → normal blending, smaller points. Keep it calm.
4. Add the skeleton → done, with the finding's bones and muscle group lit.
5. Do not touch the original site → separate page.
6. Wants: more content and data beside the figure; every scroll step pushes in to a different view
   of the 3D person; keep the cerebellum opening ("we are Cerebel"); a different backdrop per act;
   particles that turn into a DNA-like strand and then into the next shape, with green and
   drifting lights like Corn; many more home-made 3D assets; ski as **skeletal load**, not ski-board force.

## Done in this round

- The goggles opening was built and then removed at the user's request; the page opens on the cerebellum.

- Intro order: subject alone for a beat, then top bar, rail and headline (`is-ready` → `is-live`).
- Headline lens: under the pointer, letters fall back to outlines and a live 3D node cloud (2D canvas, `drawLens` in `index.ts`) trails it. The masks apply only while `data-lens` is set; an earlier version left the headline invisible once the pointer moved away.
- Per-act backdrops (`bg` on each act, drawn in `stage.ts`).
- Origin: the strand is a bundle of 56 woven fibres (lines + beads, `FIBER` GLSL in `acts/origin.ts`) that the particles gather onto; an irregular 3D cloud (clumps, arcs, scatter); the whole scene turns with the pointer on a mass-spring; the pointer's light and speed act on fibres and cloud. The user wants this weight and density everywhere.
- Motion: skeleton + muscles beside the surface; camera pushes in on pelvis / right knee / left elbow
  per finding; the measured value rides on the joint with a dashed ring and leader; live readout of
  all four series; last chapter ("Your turn") lets the visitor drag the timeline to find the frame of
  greatest hip slide.
- Ski act (new).
- Glasses: full triangle mesh under the outline; hotspot labels with leader lines.

## Not done / next

Ordered by what the user asked for most.

1. **The snow act (snowboarding, file still `acts/ski.ts`) can go further.** The skeleton is the real
   bone model (`rajagopal-bones.glb`), carried from the golf capture's first frame into a riding pose by
   `carry()` / `setGroup()` (rigid groups rotated by a two-vector frame match; knees and elbows solved
   with `bend()`), and it moves through the turn. Obstacles: gates with flags, hoops of points, trees of
   points. Ideas the user would like: jumps or rails, a tail of exposures behind the rider, muscle
   paths on the legs, more camera moves. No muscle data exists for this pose; do not fake numbers.
   Check with `node scripts/experience-shots.mjs http://localhost:5173/experience.html /tmp/shots 1440 900`
   (needs Chrome at `/usr/bin/google-chrome` or `CHROME_PATH`).
2. More 3D assets made in code or Blender: a real ski environment (terrain, gates, trees as point
   clouds), a tennis or snowboard act, a better cerebellum → strand → body choreography, the wearer
   putting the glasses on. For anything not from a capture, label it as modelled.
3. Corn's sub-experience: a circular button that flies the camera into an orbit system (centre
   object, ring of clickable nodes, close button), without leaving the page. Good candidates: the
   muscle groups in Motion, the benchmark's other metrics.
4. (Done) The golf muscle groups are volumes via `src/viewer/muscle-volumes.ts`. Next level of detail
   would be all 80 muscles as thin volumes, or tendon-like tapered ends.
5. Real glasses CAD (GLB) in place of the code-built schematic, when the team supplies it.
6. Port from the original site: demo form and backer sheet (the experience links to mail and to
   `/#wearable` for now), the Evidence video, baseball / boxing / jogging sessions.
7. Phone pass. Layout rules exist (`@media` at the end of the CSS) but only 390×844 in headless
   Chrome was checked, and not since the ski act.
8. Performance on real hardware: untested beyond the user's Mac. Per-frame CPU work is the golf
   surface sampling (15k points) and muscle lines; both are fine on desktop.
9. `npm run test:e2e` covers the original homepage only. No tests exist for the experience.

## Checks to run before pushing

```
npx tsc --noEmit
npx eslint src/experience
npm run build && npm run test:sites
git diff main --stat -- src/main.tsx src/App.tsx index.html   # must print nothing
```

## November 16: Corn / Orano desktop interaction pass

Work is isolated on `codex/muscle-orbit`, based on `07b4a34`, to avoid overwriting the other scroll-experience worker.
References inspected live: https://cornrevolution.resn.global and https://www.orano.group/experience/innovation/en (not just /protect).

- Added a seventh act, Data loop, between Glasses and Field. Four scroll chapters / selectable phases: Deploy → Capture → Validate → Improve. A procedural orbit diagram rotates to the active stage with travelling particles. Copy uses the user-confirmed 20,000 h split (5,000 real / 15,000 simulated); robotics licensing is explicitly planned, not revenue.
- Added the Motion circular exploration entrance and a modal orbit view of the two available muscle groups. Uses actual muscle paths at the existing annotation frames; no made-up anatomy measurements or force values. Drag to orbit, wheel to zoom, click satellites or named buttons; Escape/close returns focus and scroll state.
- Procedural spatial linework per existing act (origin contour shells, snow contours / tree edges, evidence rails, optical rings, field structures). These are decorative, not new capture assets.
- Broader slanted transition with counter-moving scene planes and a slight depth push. Shared cloud and native scroll preserved.
- Corn headline treatment extended from the existing implementation: more depth-varied nodes, soft local solid-to-outline mask, inherited overdamped lag. Orano-style primary CTA: off-white rectangle, lavender leading strip that expands on hover, arrow movement. Circular exploration actions retain thin double rings.
- Desktop was visually inspected at 1280×720 and interaction tested at 1440×900. Mobile refinement is deferred at the user's explicit request; this is a desktop review build.
- Original homepage source untouched. No goggles intro restored.

Validation: TypeScript, ESLint on src/experience, production build, 10 Sites tests; desktop smoke checks modal selection/Escape and flywheel selection. Build with `npx vite build --configLoader runner` if the worktree uses symlinked dependencies. `npm run preview -- --host 127.0.0.1 --port 5177` serves the built `/experience.html` without dev-server font symlink restrictions.

## November 16: pointer / anatomy / authored eyewear revision

Latest feedback supersedes earlier “arms always move” instruction: when scroll stops, snowboard hands must hold their pose. Removed time-driven hand fidgets; only 2.5 mm slow shared breathing remains. Balance posture still follows the scroll turn.

- Replaced the orbit's isolated normalized strips with the same captured pose's pelvis/legs GLB and registered muscle paths. Selected paths use schematic volumes; all other paths are faint context. No surface/opensim fusion. Bone model is loaded separately; the entrance waits for it.
- Replaced procedural eyewear with `public/assets/wearable-studio/cerebel-wearable-v1.glb`, the existing export of `assets/blender/Cerebel_Wearable_Studio.blend`. Uses authored presentation groups and explosion vectors, material tuning, white key / violet rim / cool fill. Still labelled development concept.
- Strand highlight uses projected screen height with a broad horizontal falloff. Removed the erroneous second subtraction of view offset; reduced the autonomous pulse so upper/lower pointer position controls the highlight.
- Text hover now reveals a seeded irregular field at fixed page locations; nearby nodes pivot in depth and fade, instead of a ball of nodes chasing the cursor. Solid/outline mask strength eases in and out.
- The opening stays noninteractive until 1.5 seconds after the text/interface appears, then pointer influence ramps up. A lower posterior area of the existing unsegmented brain mesh is highlighted green as a visual cue; it is not a labelled anatomical segmentation.
- Benchmark typography is constrained below the fixed header. Guarded animation time deltas against negative values after page/background timing changes.

### Follow-up: hard lens and reversible particle attraction
User clarified Corn hover: no feather on the circular text aperture. Use a hard 96 px radius, subdued underlying outline and moving bright contour segments. The seeded particles retain rest positions, are attracted toward a loose shell around the pointer, and return to their original positions after it leaves. Whole-effect entrance/exit can ease; the spatial edge must stay crisp.

### Opening camera choreography
Scroll now lowers the camera below the brain and aims upward at the highlighted posterior region, approaching to 7.2 scene units. The close view holds into the second chapter before particles loosen and gather into the fibre helix. The aim point is transformed with the model; pointer rotation is attenuated during the close-up. Reverse scrolling reverses the same timeline. The helix/body morph windows moved later within the existing Origin span; later acts retain their scroll positions.

### Smaller lens, exact contours, sparse graph, true upward camera
Lens radius is now 72 px. Bright strokes use paths extracted from the installed Space Grotesk 700 font, with a DOM baseline marker and browser-measured glyph advances, instead of approximate canvas text positioning. Each closed contour has exactly two animated lit segments. `scripts/build-heading-outlines.py` regenerates the 12 KB JSON (fonttools + brotli); the font's OFL license is beside it. The irregular rest field has more points, but at most two links per point and many isolated dots. Camera reaches 5.1 units below its tracked aim point, 4.8 units in front, making the upward angle explicit rather than merely pushing in.

### Hover radius adjustment
Text aperture radius reduced another 30%, from 72 px to 50.4 px (both CSS and contour canvas). Brain pointer deformation/highlight radius reduced 40%: Gaussian coefficient 9 → 25, since radius scales inversely with its square root. Particle field and strand lighting are unchanged.

### November 16: bounded pointer particle circle
After reverting the background experiments, change only the white headline-hover overlay. Its points and sparse links are clipped to a hard 120px radius; attraction is limited to rest positions within 150px. Per-point alpha fades over time rather than falling off with cursor distance; returning points cannot trail beyond the circle. The 50.4px text aperture, brain radius and restored background remain unchanged.

### November 16: close inspection of Corn hover
Observed in the live reference with small moves and pauses: points and sparse links keep changing at rest; the silhouette is roughly circular with a sparse centre and varying point sizes/brightness. This visually suggests a rotating volume, not proof of its implementation. Replaced the uniform fixed-field attraction with 78 seeded irregular volumetric points, a broad size range and depth-dependent appearance; sparse connections remain. The particle volume stays local and bounded, with no radial opacity wash. Text aperture radius is 0.60 of current font size (60–112px), shared by CSS and contour clipping. Removed the grey custom pointer ring. Hit testing is refreshed each frame against actual active text, including stationary-pointer chapter changes; menus/modal/pointerleave clear it. Backgrounds stay exactly as after the requested revert.

### Hover correction: viewport field, not cursor-carried volume
User rejected the rotating cursor-centred volume. Restore 1,650 permanent seeded rest positions distributed across the viewport. Only points within the hover aperture become visible; tiny depth tilt stays relative to each point’s own rest position. No spherical gathering, no autonomous rotation, and no cloud travelling with the cursor. Keep larger irregular sizes, sparse links, font-relative text aperture and removed grey ring. Background unchanged.

### Smaller particle reveal without a visible cut edge
Reduce particle window from max(135px, 1.85×text radius) to max(88px, 1.25×text radius). Remove the particle canvas circle clip. Each seeded point has a slightly different outer threshold and a narrow 12px reveal transition; alpha settles over time and links inherit endpoint alpha. This avoids clipped half-dots and a shared circular cut without returning to a broad radial glow. The text aperture remains sharp and unchanged.

### Sparse larger points with visible local depth turn
Reduce seeded field to 1,080 points; enlarge point radii to 1.8–6.4px before depth modulation. Increase local yaw from 0.3 to 2.2 radians across the hover window, with stronger depth displacement, size and facing variation. Each point still pivots around its own fixed rest position and returns when the hover leaves; no cursor-carried sphere. Keep the compact staggered reveal edge.

### Two-force hover and breakable links
Each seeded point now has velocity and displacement. Cursor attraction acts locally, nearby points exert weaker mutual attraction with a short-range separation force, and an overdamped rest-position spring preserves the full-screen field. Existing local depth turn remains. Links use deformed positions: connect below 28px, disconnect above 40px, with endpoint fading and hysteresis. At most four active links and two per node; stroke widened from 0.65 to 1.2px. Corn was inspected for visible connection changes; these forces are our implementation of the requested behavior, not a claim about its source.

### Progress-bar entrance and two-zone cursor force
Removed visible loading numbers. The centred wordmark now sits above a slim violet progress track with a travelling highlight, quiet framing lines and mono captions. Fill follows the existing actual act-readiness progress; percentage is exposed only through progressbar ARIA. Reduced-motion disables the sweep. Cursor force now has a positive inner core and a negative outer annulus with smooth crossover: inner pull promotes proximity links, outer push stretches/breaks them. Mutual particle attraction, separation, anchor return and the 28/40px link thresholds remain.

### Smooth headline re-entry
Replace binary raw-pointer text hit testing with continuous aperture-to-text proximity, using the same lagged coordinates as the rendered lens. The effect remains active while its circle overlaps a headline, bridging line gaps; text strength and particle visibility ease independently without resetting node positions or bonds. Keep the crisp spatial text mask and existing particle radius.

### Outline-first headline entrance
Active headlines now briefly reveal their existing outline layer, followed by a bottom-up white fill in 620ms (90ms line stagger). Entrance is gated on is-live so loading cannot consume it. The outline animation releases its opacity back to the existing hover rules; fill uses clip-path independently of the pointer mask. Reduced motion skips the new effect.

### Orano-inspired primary button trial
Header demo CTA uses a violet base under a translating off-white panel. On hover/focus the panel exits right (500ms, 100ms delay), label moves 40px right, and a 26px horizontal stroke extends with 50ms delay. Exit returns the panel over 800ms and the label over 500ms with 100ms delay. Fixed geometry, no lift/glow; keyboard focus and reduced-motion supported. Existing circular actions unchanged.

### Single heartbeat for circular controls
Orb CTAs, muscle-entry, modal close, and section-rail circles pulse once on hover/focus/selection: 1 → 1.14 → 1.045 → 1.065 over 520ms. Engagement holds at 1.065 and departure returns to 1 over 380ms. Individual scale preserves existing ring rotations. No looping pulse; reduced-motion disables animation.

### Secondary control interaction pass
Menu trigger gains opposing line shifts and a quiet sliding backing; top/footer text links get directional underlines. Menu items expose a leading stroke; menu side links reveal a violet panel. Benchmark sequence buttons share one sliding selected plate, with separate hover/press feedback. Flywheel steps draw a mint top rule and lift 4px; partner links reveal a restrained background. Muscle selection chips and the scrub handle now respond to hover/press. Keyboard focus mirrors hover and reduced-motion keeps state changes instant.

### Benchmark table visibility fix
The benchmark data table must remain visible whenever its chapter is active, including immediately after a SEQ switch. Removed its opacity dependency on the later scroll-driven gap annotation and removed the narrow-window display:none rule. Table values still come from the selected benchmark dataset.

### Faster landing readiness
Landing now waits only for Origin assets; later scene readiness no longer gates the loader. Removed artificial percentage catch-up and the 1900ms brain-only hold. Ready and live activate together, loader exits in 300ms, and hover unlocks after the existing headline entrance (1300ms). Later scenes continue loading concurrently.

### Menu viewport fit
Menu type now depends on viewport height as well as width, with fixed header clearance, compact chapter spacing and safe internal overflow. Narrow/tall layouts place the three secondary links in a compact bottom row. Seven chapter items must fit without overlapping the logo.

### Paced opening restored at user request
User wants the loading interface visible again, with a brief designed rhythm. Minimum presentation is 1400ms, still gated only by actual Origin readiness; progress is presentation-paced and capped before ready. Loader wipes out in 550ms; brain makes a one-time 0.65-radian yaw settle over 1200ms, starting 150ms into reveal. Text begins 450ms after reveal starts and hover unlocks at 1750ms. Reduced motion skips holds and turn. Later model loads never block the opening.

### Direct navigation and quicker hover readiness
Removed every Playground link and the swing-app promotional CTA from the experience; Previous site remains. Menu chapter rows now show small clickable subchapters on the right. Golf and Snow get thin native-range chapter scrubbers with named clickable stops; dragging updates scroll and scene directly, keyboard arrows/Home/End work natively. Existing golf frame scrub remains separate above the chapter navigator. Readouts raised to clear the new control. Opening hover unlock moved from 1750ms to 1050ms after reveal begins.

Removed the decorative DATA FLYWHEEL numbered pill from all four flywheel sections at user request.

### Inline menu subchapters
Subchapter links now follow each chapter title with a fixed small gap instead of a shared second column. Removed the top-header demo/previous-site shortcuts; menu-bottom entry points remain.

## November 16 (later): art pass and snow act, by Claude on `codex/muscle-orbit`

Taken over at `344b6a0`. User brief: review everything, especially colour, light spots and transitions; make the snow act natural (pose, camera), and show its forces.

- **Snow act (`acts/ski.ts`)**
  - Model inputs are gentler: 14 m/s on a 2.0 m × 40 m line (peak about 45° lean, 1.4 × body weight; copy reads these from `skiPeak()`). The 52° version looked contorted.
  - Arms are held low and quiet (hands between hip and chest height, small see-saw). The old ±0.32 m see-saw threw a hand above the head.
  - Lean is read 1.5 m ahead of the rider, so the body commits before the apex.
  - Camera is one orbit round the rider (`SHOTS` = azimuth, elevation, distance, look-ahead; Catmull-Rom between keys). It rides a point on the fall line, so fast scrolling cannot lose the rider; only the orbit offset and aim are eased in time. Slight bank with the turn. The top-down key and the extreme close-ups are gone.
  - Forces: ground reaction up the lean line from the edge, weight down from the modelled centre of mass, and their sum (the turn force) toward the centre of the arc, closed as a dashed parallelogram, with DOM labels (`ski-force`, `ski-weight`, `ski-turn`). A lean arc against a plumb line appears in "Edge control". Load path: beads from each binding up shin, thigh and spine with a slow pulse, and a ring on ankle, knee, hip that opens with load. All of it follows from the two inputs; nothing per joint is stated as a number. Keep the "Computed… Not measured" line.
  - Fixed: anchors were handed to the stage in the slope's frame, so the force label was off screen. They are now world space.
- **Colour**: Motion is green (`0x07201c / 0x0c4a40`), Snow is ice blue (`0x0f2646 / 0x1d5c94`, tints ice white and violet). They used to share one teal. Journey: violet → green → ice blue → indigo → graphite → dark teal → magenta.
- **Backdrop (`stage.ts`)**: warped fbm banks of the act's two tint colours over the gradient and glow, so the field is uneven and drifts.
- **Light spots (`cloud.ts`)**: 46 large lights near the lens; out-of-focus lights draw as discs with a brighter rim and uneven face.
- **Transitions (`stage.ts` composite)**: the ruled slanted edge and the counter-sliding planes are replaced by a wide, noise-shaped front with a small depth push (out goes toward the lens, in settles back) and a faint lift along the front. Velocity chromatic offset cut to about a third; it read as a glitch.
- `environments.ts` skips the snow act: fixed linework was left behind as the rider travels.

Checked in headless Chrome at 1440×900 as stills only. Not checked: real-time feel of the camera easing and the transition, phones, performance on real hardware. Headless frames run slowly with a capped `dt`, so anything eased in time looks further behind there than it is.

### Snow camera: contrasting set-ups (user: one angle read as flat)
The single even orbit was rejected as flat. `SHOTS` now has seven set-ups with large swings in distance and lens (wide establishing → low and close beside the board on a 47° lens → medium for the force triangle → overhead → close chase → far side for the lean → long pull-out), still one continuous Catmull-Rom move riding the fall line. Key 5th value is the lens angle. The user wants angle changes and zooms here; do not flatten it again. Headline entrance animation is being reworked by GPT, not here.

### Strand rungs (user: the helix was only two rails; add the bars, in the same fibres, as in Corn)
`acts/origin.ts` now draws nine rungs between the rails. Each is a bundle of 11 fibres (`rung()` GLSL): it runs along one rail, gathers, crosses the axis and fans out along the other, coloured violet → green across, with beads, the same pointer light and the same draw-in as the rails (rungs arrive after the rails). Keep rungs made of fibres; no solid bars.

## November 16: scroll feel (user: scrolling was not smooth or intuitive)

Diagnosis: the 3D followed the scroll but the copy ran on timers (class toggle, 0.22 s out, 0.24 s wait, staggered in), there was nowhere to come to rest, scroll-driven values were eased twice, chapter lengths were uneven, and two acts render at full cost during a change.

- **Copy is a function of scroll position** (`index.ts`, block above the loop; CSS at the end of `experience.css`). Per chapter `--e` runs 0→1 over the first `ENTER` (0.34 vh) of its span and `--x` over the last `EXIT` (0.16 vh). Body copy fades and rises from `--e`; nothing uses a timer, and scrolling back undoes it. Only the opening headline is time-driven (1.5 s after `is-live`).
- **Headline entrance, as the user specified: outline traced first, then filled inside that outline.** `traceHeadlines()` strokes each glyph's contours from `heading-outlines.json` on the lens canvas with a growing dash, letters starting left to right, a short violet pen tip at the head; then the solid text (`::before`) is revealed bottom-up by `clip-path` from `--f` while the stroke fades. The old slide-up of lines and the `xp-type-fill` / `xp-type-outline` keyframes are switched off. Headings without `.ln` lines just fade with the body copy.
- **Settling** (`settle()` in `index.ts`): never during scrolling. If input has stopped for about 0.3 s inside a change (text mid-entry, or within `WIPE` of an act boundary), the page drifts slowly to where that change is complete, mostly onward, back only if it had barely begun. Any wheel, touch, key or pointer press cancels it, and it gives way to menu jumps and scrubbers. `?still` in the URL disables it (use it for screenshots of intermediate states: `experience.html?still`).
- **One easing only**: scroll position is smoothed once (`damp(u, target, 8)`). Snow lean and camera no longer ease in time. Golf camera moves between findings keep a time ease (their targets are discrete) but faster (about 4.7).
- **Chapter lengths** evened out in `data.ts` (legible 2.1, benchmark 1.9, glasses and data-loop steps 1.1, intros 1.2). Total is now 31.5 vh; absolute scroll positions in old notes and the default stops in `scripts/experience-shots.mjs` have shifted. The shot script now names files with two decimals.
- **Act change cost**: `WIPE` is 0.6 (was 0.85) and, while two acts are drawn, both go to 2-sample targets instead of 4. Resolution is unchanged because point sizes are in target pixels and would visibly pop.

Checked as stills in headless Chrome plus a scripted test of settling. Not checked: how any of this feels in real time, trackpad versus wheel, and whether the act-change cost is actually what dropped frames on the user's Mac (never profiled there).

### Frosted glass pane (user: a little frosted-glass texture over the whole screen except the logo and Request a demo)
Two parts. In the composite shader (`stage.ts`) every pixel samples the scene about 1.5 device pixels aside in a direction fixed to the screen (`uFrost`), plus a faint fixed speckle and a sheen across one corner. Over the page, `.xp-glass` (z-index 28, under `.xp-top` at 30) adds the pane's surface: fine noise, corner light and a lit inner edge. Copy is DOM above the canvas, so it gets the surface but is never blurred. The user asked for "a little": to adjust, change `uFrost` (set in `resize()`) and the opacities in `.xp-glass`.

### Texture pass after the user's Corn reference ("yours is not enough")
The reference frame has three things the first glass pass lacked: visible film grain over picture and type alike, a soft diffusion (lights bloom, edges lose hardness, shadows fill with colour), and larger luminous colour clouds. Now in the composite shader (`stage.ts`): a 12-tap wide blur laid back over the scene (`haze`), a tone curve that keeps the blacks, and coarser, stronger grain that moves every frame and peaks in the mid-tones. Backdrop colour banks are nearly doubled. In CSS, `.xp-glass::after` is a soft-light grain tile over the copy that jumps a few times a second, and copy has a soft halo. Tried and dropped: `filter: blur()` on headings (it broke the hero's blend and smeared the trace). Dials: `haze` mix and add, grain amplitude, `.xp-glass::after` opacity.

### Headline fill grows inward from the outline (user rejected the bottom-up fill as ugly)
After the trace, `traceHeadlines()` draws the same contours again with a growing line width, clipped to the glyph (`glyphShapes`), so the fill starts at every edge and closes toward the middle of each stroke, letter after letter. The DOM text (`::before`) only fades in over the last 6% of `--f`, once the canvas letters are solid. Do not bring back the `clip-path` wipe.
Also fixed: `.ch` must not carry `transform` / `translate` (even `0 0`): it becomes the containing block of the `position: fixed` team photo (`.slant`), which then lands on top of the company headline. The exit lift is on the children instead.

### Grain slowed (user: too fast, too much)
Scene grain now holds a pattern for 1/6 s and cross-fades to the next (it used to change every frame) and is about a quarter weaker. The grain tile over the copy steps roughly three times a second instead of nine. Keep it slow.

### Grain streaks (user saw vertical lines in the grain)
Two causes, both fixed in `stage.ts`: the `sin()` hash lined up in columns on large pixel coordinates (replaced by a fract-based hash, also used by `fbm`), and the grain cell was 1.35 device pixels, giving columns of uneven width (now a whole number of pixels). Grain amount reduced again (shader about 20% down, copy tile opacity 0.17).

### Headline halo box
The halo round headlines was cut off in a rectangle by `.ln { overflow: hidden }`, left over from the old slide-up. `.ln` is now `overflow: visible`.

## November 16: sound (user: add some subtle sound)
`src/experience/sound.ts`, synthesised with Web Audio, no audio files. A low pad that glides to a new chord per act (`CHORDS`), air (filtered noise) that rises with scroll speed and is stronger in the snow act, a soft glass note on each chapter change, a tiny tick when the pointer reaches anything pressable and a soft press on click. Everything goes through one quiet master with a short generated reverb and a limiter.
Browsers allow audio only after a press or key, so nothing plays before the visitor's first one. The "Sound" toggle (four bars) sits in the top bar before "Previous site"; the choice is remembered in `localStorage` (`cerebel-xp-sound`). Audio suspends when the tab is hidden. Tested in headless Chrome that it starts, toggles and throws no errors; nobody has listened to it yet, so levels are a first guess: master 0.5, pad 0.09, air up to 0.075, notes 0.012–0.05.

### Sound fix (user: no sound)
Three causes. (1) Pressing "Sound" before audio had started both unblocked it and toggled it off, and stored "off". Now the press that unblocks audio never toggles; the label reads "Click for sound" until audio runs; the storage key is `cerebel-xp-sound-v2` so nobody keeps the bad "off". (2) The pad sat at 55–165 Hz, which MacBook speakers barely reproduce; it is an octave up now. (3) Levels were far too low; raised (pad 0.16, master 0.9, notes and air about 3×). Measured in headless Chrome through a dev-only meter (`window.__xpSoundLevel`, not in production builds): about 0.1 RMS (−20 dBFS) with sound on, 0 when off.

### Sound in one key (user: not harmonious, pad too loud)
Everything is in D major now: each act's pad chord is diatonic with open voicings, all sines, slower glides; chapter notes and hover ticks are drawn from the D major pentatonic (`BELLS`) instead of random pitches. Pad bus 0.16 → 0.045, air about half, reverb a little wetter.

### Phone layout pass (390 × 844 checked as stills)
New block at the end of `experience.css`. Top bar: "Previous site" hidden, smaller Request a demo pill, sound icon only. Headlines: one size per line that fits the width, lines never wrap internally (this was the odd gap in the hero). Motion: copy clears the readouts; the muscle entry moves to the top right and shrinks; traces hidden. Snow: copy clears the readouts; per-force labels hidden (leg load label stays); the "Computed… Not measured" disclosure stays visible. Benchmark: number and headline at the top, tapes in the middle (offset tuned), switch and table at the bottom; the explanatory sentence is hidden on phones. Glasses and Data loop: subject centred in the upper half on phones (`offset` set per aspect in `acts/glasses.ts` and `acts/flywheel.ts`; the loop is scaled to 0.56); loop step buttons span the width. Not checked: other phone sizes, landscape, real devices.

### Sound removed (user: remove it)
`sound.ts`, the toggle and its CSS are deleted. Do not add sound back unless asked.

- November 17, glasses inspection: drag the model region to rotate, arrow keys also rotate and Reset view/Home restores the scroll pose. Retain matte/grain/background. Hard CAD shell edges now use creased normals (36 degrees) instead of smoothing across panels, with calmer satin reflections. Typecheck and standalone build passed; browser launch failed in this environment, so the temple shading needs live visual confirmation.

## November 17: coming to rest (snap.ts), rewritten

User report: with a trackpad, letting go often left the page in the middle of a transition. Wanted: release between two stops, even near halfway, and the page glides softly to the right one; gentle; yields at once to new input; keep the current slow scroll sensitivity (`scrollDistanceScale = 2` at the time; later the same day lowered 30% to `2 / 0.7` at the user's request).

What was wrong (reproduced):
- **Stops were not where the picture is still.** The old reading point was the same rule for every chapter (just after the headline). Golf findings move the skeleton to the extreme frame until 55% of the chapter and push the camera in between 40% and 70%; the stop was at 35%, so the page rested mid-swing before the push-in. Benchmark tapes were still growing, the glasses' optical explosion was half done, and Snow and Field never stop moving at all. That reads as "stuck in the transition" even when the snap fired.
- **Release was detected with a 180 ms timer.** Measured in the user's Chrome (Mac, 120 Hz): normal frames 8 ms, but in Motion and during scene changes median 16.7 ms, p90 40–50 ms and single frames up to 275 ms. One long frame passes for a pause, so the snap could start mid-gesture and fight the next momentum events.
- Smaller: a timer that found the page blocked (menu, drag) dropped the snap for good; a timeline drag released outside the slider left `timelineDragging` stuck; the target was always the nearest stop, so a long deliberate move often slid back.

What it is now:
- `data.ts`: optional `rest` per chapter (units from its start) where the act settles later than the default. Set for `legible` (strand formed), the five golf findings (extreme frame held, camera pushed in), `benchmark` (tapes grown). Glasses `g-optical` explosion now completes by 40% of the chapter instead of 80%.
- `stage.ts`: `RESTS` (one per chapter) and `sceneTime(u)`. The scene holds completely still for `HOLD` = 0.1 units (0.2 screens) either side of every rest point; motion between rest points runs a little faster to make up the distance. Copy is not held (raw position). `index.ts` passes `sceneTime(u)` to `stage.frame`.
- `snap.ts` (new, replaces the block in `index.ts`). Four rules, written at the top of the file: never move the page while the reader is moving it; release = no input for 6 rendered frames and 140 ms; target = the stop the reader was heading for once 30% of the way there, else back; a blocked rest waits and fires when unblocked. Glide is smootherstep, 0.6–1.4 s by distance. 1–2 px wheel deltas within 400 ms of the last are momentum tail and never cancel a glide. Menu and chapter buttons (`jump`) glide to the chapter's rest point.
- Dev-only aids: `window.__xpSnap` (stops and a log) and `?norender` (skips WebGL so input tests run at real event rates in a software-rendered browser). Neither is in production builds.

Checked: `node scripts/scroll-snap-check.mjs` (dev server running) in headless Chrome at 1440×900 without rendering: 47 of 47 trials came to rest on a stop and on the stop the rule expects (20/35/50/70% down and up from four stops including across Benchmark, random flicks with modelled momentum, re-scrolling mid-glide: yields immediately, 1 px tail mid-glide: does not cancel, wheel notches). Rendered stills at three stops and ±0.08 units: identical picture; at −0.3 the push-in and headline trace are still running. Not checked: a real trackpad (synthetic input only), Safari, phones and touch momentum, how the 0.6–1.4 s glide feels in hand.

## November 17 (later): menu, loader, muscle ring, viewer, layout pass

- **No filler labels.** User: nobody reads kickers like "Explore the story", nobody counts chapters. Removed the menu kicker and "Chapter N", the glasses "0N / 04" counter, the loop-nav numbers, the "Scroll to discover" hint, the "Snowboard" timeline label . Don't add them back.
- **Menu.** Frosted (gradient + `backdrop-filter: blur(26px)` + grain), rows on a two-column grid with hairlines. The Cerebel logo no longer shifts when the menu opens: the top links are hidden with `visibility`, not `display:none`, so the bar keeps its height.
- **Loader.** Back to the original design (eyebrow, wordmark, purple bar with end ticks, caption, signature), only made black with a light frost, softly glowing type and logo, and a quieter bar glow with a small glowing head at its leading end; logo a little bigger (232px). User rejected both the game-style rebuild and the stripped white-line version: keep the original, adjust lightly.
- **Explore muscle groups button and muscle viewer: reverted to the original.** A rhythmic drawn ring and a frosted Jarvis-style HUD were tried and rejected (user: ugly, the original was fine). Don't restyle them.
- **Layout pass.** Hero copy gets a dark halo; the golf readout sits on a fitted frosted strip; small timeline/finding labels raised to 12/11px; metric units are set small after the number ("6 cm" → 6<small>cm</small>); company photo offset only on desktop; phone: pill fits its text, figure labels and the joint caption hidden so they don't sit on the copy; benchmark offset smaller on narrow screens so labels aren't cut.
- **Verified:** headless Chrome stills at 1440×900 and 390×844; snap trials 37/37 at sensitivity 2/0.7. **Not verified:** real trackpad feel, Safari, real phones, the animations in motion on real hardware.
