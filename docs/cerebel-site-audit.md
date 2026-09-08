# Cerebel AI site audit — September 2026

## Current implementation

- Stack: React 19, TypeScript, Vite 6, Motion, Three.js, CSS, and a small Cloudflare/Sites-compatible worker layer.
- Public routes: homepage, `/viewer`, and `/logo`; `/admin` remains an internal application route.
- Hosting: Vercel serves `dist/client`; the repository also keeps its existing Sites worker packaging.
- Visual system: near-black site chrome, cool off-white typography, electric purple for selection and movement, documentary evidence, and scientific instrument views.
- Homepage order: Hero → Evidence → CeRebel motion representation → wearable product reveal → In the field → Company → Benchmark → Contact.

## Problems reproduced

1. At 390 px the document was 418 px wide. The mobile Company photograph inherited the browser's default `figure` margin and its reveal transform pushed it beyond the viewport.
2. The large rendered glasses sequence had no production delivery path, mobile derivative, frame manifest, cache policy, reduced-motion state, or bounded decoded-memory strategy.
3. The viewport metadata did not opt into iPhone safe-area layout.
4. Vercel rewrites covered `/admin` but not the existing `/viewer` and `/logo` client routes.
5. The production JavaScript still emits a bundle-size warning. The Three.js viewer is already isolated as a separate chunk, but the main application chunk is approximately 540 kB before gzip and is a future optimization target.
6. The public directory is approximately 368 MB because it includes large motion-viewer assets. The new product sequence is not the primary source of that weight.

## Implemented fixes

- Removed the mobile Company `figure` margin and clipped accidental horizontal overflow at the document shell.
- Added `viewport-fit=cover` and kept sticky sections on `svh`/`dvh` sizing.
- Added immutable caching for product-sequence assets and client-route rewrites for `/viewer` and `/logo`.
- Added a reusable canvas-based `CerebelScrollSequence` after the motion-representation chapter.
- Kept native page scrolling; no scroll hijacking or wheel capture was introduced.
- The canvas uses contain-style drawing on the original neutral gray field so the glasses and exploded parts remain visible on portrait screens.
- Added normal HTML headings and copy for four phases; the raster frames contain no required text.
- Added a static poster and an explicit static reduced-motion state.

## Product sequence pipeline

`scripts/prepare-cerebel-scroll-assets.mjs` validates the 520 supplied WebP files and creates:

- Desktop: 520 frames, 1600 × 900, WebP quality 83, 7,526,930 bytes (7.18 MiB).
- Mobile: 260 physical frames, 960 × 540, WebP quality 74, 1,474,618 bytes (1.41 MiB).
- Manifest: logical frame count, paths, dimensions, poster/reduced-motion frames, phase boundaries, and the mobile logical step.

Raw source frames stay outside the production public directory. `VITE_CEREBEL_SCROLL_ASSET_BASE_URL` can point both the manifest and frames at a CDN later without changing the component.

## Runtime and memory decisions

- Canvas rendering avoids 520 image elements.
- The first requested frame is prioritized, then nearby frames and the current scroll direction are prefetched.
- Concurrent decodes are capped at five on desktop and three on compact screens.
- Decoded cache size is capped at 48 desktop frames and 30 mobile frames.
- Old `ImageBitmap` objects are explicitly closed.
- If an exact frame is unavailable, the closest decoded frame remains visible.
- Rendering is scheduled with `requestAnimationFrame`, paused while the section is offscreen, resized with `ResizeObserver`, and capped at 1.5 DPR desktop / 1.25 DPR mobile.

## Responsive verification

Verified in the Codex in-app browser at 375 × 812, 390 × 844, 430 × 932, 768 × 1024, and 1440 × 900.

- Document width equals viewport width at every checked breakpoint.
- Primary heading and navigation stay inside the viewport.
- Mobile menu covers the viewport, locks page scrolling, and closes with Escape.
- Canvas width stays exactly within its section.
- Perception, solid-product, and exploded-view phases render without cropping the product.
- Phase copy moves above the product stage on phone layouts and remains readable through the sequence.

Audit screenshots are stored in `screenshots/cerebel-scroll-audit/`.

The production build, TypeScript check, and eight automated worker/asset tests pass. The local ESLint process stalls while bootstrapping this repository's dependency graph on the current Mac runtime; no lint result is claimed for this pass.

## Remaining limitations

- Device-family verification was performed in the available in-app browser. A separate physical iPhone Safari pass is still recommended before a public production release.
- Hundreds of frame requests are appropriate for this experience, but production analytics should confirm CDN cache hit rate and cellular behavior. The component is already CDN-ready.
- The larger existing viewer asset library should be audited separately for route-level delivery and archival cleanup; it was not deleted during this pass.

## Local verification

```bash
npm run scroll-assets:build
npm run build
npm run test:sites
```

The repository's default Node 25 installation is unusually slow while traversing this project's dependency graph on this Mac. Node 20 completes the Vite production build normally; the deployed output is unaffected.
