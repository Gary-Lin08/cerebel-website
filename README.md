# Cerebel AI Website

A production-ready redesign of the Cerebel AI marketing website, built around lightweight wearable capture, human-object interaction, structured motion data, and downstream robotics and embodied-AI use cases.

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
npm run test:sites
```

## Stack

- React 19 + TypeScript
- Vite Product Design prototype runtime
- Motion for restrained interaction and scroll storytelling
- Phosphor icons
- Space Grotesk Variable + IBM Plex Mono
- Semantic HTML and responsive CSS

## Project structure

- `src/App.tsx` — page sections and product experience
- `src/components/` — navigation, headings, and demo form
- `src/content.ts` — editable application, process, platform, and partner content
- `src/styles.css` — tokens, layout, interaction, and responsive system
- `public/assets/` — generated production visuals
- `docs/redesign-brief.md` — narrative, visual, motion, mobile, and technical plan
- `docs/audit/current-design-audit.md` — source-design audit
- `design-qa.md` — source-to-implementation comparison and test evidence
- `screenshots/` — desktop, mobile, menu, application, and QA captures

## Visual assets used

- `hero-human-interaction-capture.png` — natural assembly task with lightweight glasses and interaction reconstruction
- `concept-wearable-platform-exploded.png` — conceptual modular glasses platform
- `application-robotics-demonstration.png`
- `application-industrial-operations.png`
- `application-sports-intelligence.png`
- `application-research-digital-humans.png`

All visible product and application scenes are generated specifically for this prototype. Product hardware imagery is conceptual rather than a representation of a finalized shipped device.

## Unverified claims removed or softened

- Removed the implication that Cerebel requires a full-body sensor suit.
- Removed “not machine-ready” language for raw egocentric video.
- Removed unverified accuracy, scale, customer, partnership, funding, and performance claims.
- Removed detailed output-field and file-format claims such as joint coordinates, FBX, BVH, USD, CSV, and ROS2.
- Replaced deployment claims with “designed to support,” “can be used to explore,” and “built for” language.

## Remaining company-information placeholders

- CRM or calendar endpoint for the demo form
- LinkedIn and X URLs
- Privacy policy route and copy
- Canonical production domain is cerebel.tech; public contact is hello@cerebel.tech
- Any validated product specifications, supported formats, partner references, or technical results

## Deployment

The project is prepared for the bundled Sites runtime. `npm run build` produces:

- `dist/client/index.html`
- `dist/server/index.js`
- `dist/.openai/hosting.json`

Run `npm run test:sites` before a deployment handoff. No production deployment is performed unless explicitly requested.
