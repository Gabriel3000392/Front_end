## Purpose

This repository is a static single-page restaurant template (HTML/CSS/JS). These instructions give an AI agent the minimal, concrete knowledge needed to be productive: where the behavior lives, which selectors/attributes are code-significant, common design tokens, and a few editing gotchas.

## Big picture

- Single-page static site. Entry: `index.html`. Assets under `assets/` (CSS: `assets/css/style.css`, JS: `assets/js/script.js`, images: `assets/images`).
- Structure is markup-first: HTML defines semantic sections (preloader, header, hero, menu, footer) and JS attaches behavior by querying data-attributes and class names.

## Key files to inspect

- `index.html` — canonical markup and data-attribute usage
- `assets/css/style.css` — design tokens (CSS custom properties), layout rules, and critical quirks (see "Gotchas")
- `assets/js/script.js` — site behavior and exact selectors used by scripts
- `README.md` — repo-level notes (clone/run guidance)

## Important selectors & data-attributes (do NOT rename without updating JS)

- `[data-preaload]` — preloader element. Note: both HTML and JS use the same misspelling (`preaload`) so keep it or update both files.
- `[data-navbar]`, `[data-nav-toggler]`, `[data-overlay]` — navbar open/close wiring
- `[data-header]`, `[data-back-top-btn]` — header visibility and back-to-top behavior
- `[data-hero-slider]`, `[data-hero-slider-item]`, `[data-prev-btn]`, `[data-next-btn]` — hero slider. When adding slides, include `data-hero-slider-item` and keep image preloads in head for performance.
- `[data-parallax-item]` and the HTML `data-parallax-speed` (accessed as `dataset.parallaxSpeed`) — parallax translation math lives in `script.js`.

## Conventions and patterns (examples)

- Typography/utility classes: `display-*`, `headline-*`, `body-*`, `title-*`, `label-*` — used across markup and sized via CSS custom properties in `:root`.
- Buttons: `.btn` wrapper with nested `.text-1` and `.text-2` for the two-layer animated label.
- Preload pattern: `<link rel="preload" as="image" href="...">` is used in `index.html` for hero images; when adding large hero images add corresponding preload hints.

## Developer workflow (discovered)

- No build tools present. To preview: open `index.html` in a browser or serve the directory with any static server. The repo README suggests cloning only; there are no npm scripts or bundlers.

## Gotchas / important notes

- The site relies on exact class names and data-attributes in `assets/js/script.js`. Renaming classes/attributes without updating JS breaks behavior.
- Typo to be aware of: `data-preaload` (instead of `data-preload`) — both HTML and JS use the same key. If you correct it, change both files.
- `assets/css/style.css` sets `html { font-size: 10px; }` and many sizes depend on that; changing root font-size affects layouts.
- Body initially uses `overflow: hidden` and `height: 300vh` until the preloader finishes. Be cautious when changing body scroll rules — header visibility and back-to-top rely on these classes (`body.loaded`, `body.nav-active`).

## Small examples (how to safely change common things)

- Add a hero slide: copy an existing `<li class="slider-item" data-hero-slider-item>...</li>` in `index.html` and add a matching `<link rel="preload" as="image" href="./assets/images/your.jpg">` in the head for best perceived performance.
- Add a nav link: insert a new `<li class="navbar-item">` inside the `.navbar-list`. The toggle behavior is wired via `[data-nav-toggler]` so no JS edits needed.

## Where to look when things break

- Interaction bugs: inspect `assets/js/script.js` — it contains the navbar toggle, header scroll hiding, hero slider logic (autoSlide interval = 7000ms), and parallax math.
- Visual/design regressions: check `assets/css/style.css` root variables and `.btn` / `.hover-underline` rules.

## Strapi integration (added)

- New file: `assets/js/strapi.js` — a minimal client that exposes `window.StrapiClient` with methods: `subscribe(email)`, `createReservation(payload)`, `fetchMenus()`, and `initForms()`.
- `index.html` now includes `assets/js/strapi.js` before `assets/js/script.js` so `script.js` can initialize form handlers.
- Assumptions made by the client (update if your Strapi differs):
	- Public REST base URL is set to `https://admin.thesailandanchor.co.nz` in `strapi.js` (change `StrapiClient.config.baseUrl` if your API origin is different).
	- Content-type slugs expected: `subscriptions` (POST /api/subscriptions) and `reservations` (POST /api/reservations). If your Strapi uses different slugs update `strapi.js` endpoints.
	- No authentication is used for the public POSTs; ensure Strapi permissions for these content-types allow public create.

If you want the integration to use GraphQL, JWT auth, or different content-type shapes, tell me which endpoints/fields your Strapi exposes and I will adapt `strapi.js` accordingly.
If any part of this is unclear or you'd like me to add examples for editing/adding components (e.g., how to add a new hero slide or wire a new interactive widget), tell me which area and I will expand the instructions.
