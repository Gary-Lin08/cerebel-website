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

## Sign-ups, API and tests

The site has its own backend as Vercel functions in `api/` (shared code in `api/_lib/`):

- `POST /api/backers` — the glasses presale reservation (one record per email, no payment).
- `POST /api/leads` — the Request a Demo form.
- `POST /api/events` — accepted and dropped; page analytics are not stored on this hosting.
- `/api/admin/summary`, `/api/admin/leads?list=leads|backers`, `PATCH /api/admin/leads/:id`, `/api/admin/export?list=…` — behind `Authorization: Bearer <ADMIN_TOKEN>`; `/admin` asks for the token once per browser session.

Records are stored in a private Vercel Blob store (`BLOB_READ_WRITE_TOKEN`). Without it, a non-production build writes JSON files to `.signups/` and production answers 503 and points visitors to hello@cerebel.tech. `RESEND_API_KEY` is optional and emails hello@cerebel.tech for each new sign-up.

Provisioning, once, from a linked checkout:

```bash
vercel blob store add cerebel-signups          # creates the store and adds BLOB_READ_WRITE_TOKEN to the project
vercel env add ADMIN_TOKEN production preview  # paste a long random token; it is what /admin asks for
```

Tests:

- `npm run test:sites` — unit tests, including the API handlers against a memory store and the file store.
- `npm run test:e2e` — Playwright on desktop, tablet and phone against `vite preview` (build first) with the API faked the same way as the real handlers.
- `BASE_URL=https://<deployment> npm run test:e2e` — the same checks plus `tests/e2e/api.spec.ts` against the real functions.

## Deployment

The project is prepared for the bundled Sites runtime. `npm run build` produces:

- `dist/client/index.html`
- `dist/server/index.js`
- `dist/.openai/hosting.json`

Run `npm run test:sites` before a deployment handoff. No production deployment is performed unless explicitly requested.
