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

- Opening sequence in `acts/origin.ts`: the rider in line art (`buildGoggleLines`: helmet, face, goggles, camera unit, speed lines and gates in the lens) with irregular snow → push into the camera unit → particles burst out of its lens into the cerebellum. Hold it for review with `?introAt=<seconds>`. Wanted next: a truer reflection in the lens (a real little scene rendered to a texture instead of the procedural pattern), part of a face under the goggles, better goggle and unit geometry from CAD.

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
