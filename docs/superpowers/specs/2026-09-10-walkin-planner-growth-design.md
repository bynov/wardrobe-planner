# Walk-in Planner — growth release (domain, SEO, units, projects, mobile, shoes) — Design Spec

Date: 2026-09-10. Builds on `2026-09-07-walk-in-wardrobe-planner-design.md`; that spec's domain
model and conventions stay in force except where this one says otherwise.

## 1. Goal

Make the planner findable and usable by the mainstream "walk-in closet / wardrobe planner"
searcher: a real domain with an indexable landing site, imperial units, an instant start
(templates + first-run hint), phone support, shareable links, several saved projects, shoe
shelves, a PDF that never needs a 3D visit, and a README that sells it.

Out of scope (decided): cut-list extras (CSV, sheets, cost), doors on units, non-rectangular
rooms, windows/obstructions, finishes/colours in 3D, more languages.

## 2. Product name and URLs

- Product name: **Walk-in Planner**. Used in `<title>`, meta, the app top bar, the PDF title
  block default and README. Repo name stays `wardrobe-planner`.
- Domain: `walkinplanner.com`, served by GitHub Pages from `master`.
  - `public/CNAME` contains `walkinplanner.com`.
  - `BASE_PATH` becomes `/` (workflow no longer sets the repo sub-path).
  - `www.walkinplanner.com` → GitHub Pages redirects to the apex once DNS is set.
  - DNS is the user's job: A `185.199.108.153/109/110/111`, CNAME `www` → `bynov.github.io`.
- URL map (all trailing-slash directories, so Pages serves `index.html`):

| URL | What |
|---|---|
| `/` | EN landing |
| `/ru/` | RU landing |
| `/guides/wardrobe-dimensions/` | EN guide |
| `/guides/hanging-rail-height/` | EN guide |
| `/guides/shelf-depth-and-spacing/` | EN guide |
| `/guides/walk-in-closet-minimum-width/` | EN guide |
| `/app/` | the planner SPA (language toggle inside, unchanged) |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/og.png`, favicons | static |

- Old `bynov.github.io/wardrobe-planner/` redirects automatically once the custom domain is set
  in repo settings. Nothing to do in code.

## 3. Site (static pages)

### 3.1 Build

Vite multi-page build. `vite.config.ts` lists every HTML entry in `rollupOptions.input`:
`index.html` (EN landing), `ru/index.html`, `guides/<slug>/index.html` ×4, `app/index.html`.
Source layout:

```
index.html              EN landing
ru/index.html           RU landing
guides/<slug>/index.html
app/index.html          <div id="root"> + <script type="module" src="/src/main.tsx">
site/site.css           shared landing/guide styles (imported by each page via <link>)
public/                 CNAME, robots.txt, sitemap.xml, llms.txt, og.png, favicon.svg, favicon.ico,
                        apple-touch-icon.png, screenshots/*.png
```

Plain HTML, hand-written, header/footer duplicated per page (7 pages, no templating step). Vite
processes each page's `<link>`/`<script>` and hashes assets. `pnpm dev` serves all of them.

### 3.2 Page content

- Landing (`/`): H1 "Free walk-in wardrobe planner"; one paragraph what it does (3D, plan +
  elevations, cut list, PDF, runs in the browser, no account); "Open the planner" button →
  `/app/`; 3 screenshots (design tab, 3D, phone); feature list; "What it is not" (no doors, no
  drawer boxes/hardware, rectangular rooms only); FAQ (6 Q/A: is it free, does it save, mm or
  inches, can I share, does it work on a phone, what does the cut list cover); links to guides;
  footer with GitHub link and licence. RU landing is a translation of the same structure with
  RU keywords (гардеробная, планировщик гардеробной онлайн).
- Guides: 500–900 words each, plain factual text with one table each, a "try it in the planner"
  link that opens `/app/` with a matching template (`/app/?template=<key>`), and an FAQ block.
  Topics as in §2. Content is written by the implementing agent; numbers must match the
  planner's own constants where they overlap (e.g. rail height 2000 mm max, plinth 100 mm).
- Every page: `<title>` (≤ 60 chars, contains "walk-in"), `meta description` (≤ 155 chars),
  `link rel=canonical`, `meta viewport`, `theme-color`, OG (`og:title/description/url/image/type`)
  + `twitter:card=summary_large_image`, favicon links, GoatCounter script. Landings add
  `hreflang` en / ru / x-default. Landings carry JSON-LD `SoftwareApplication`
  (`applicationCategory: DesignApplication`, `operatingSystem: Web`, `offers: price 0 USD`) and
  `FAQPage`; guides carry `Article` + `FAQPage`.
- `robots.txt`: allow all, `Sitemap: https://walkinplanner.com/sitemap.xml`.
- `sitemap.xml`: the 7 pages with `lastmod`; landings list their `xhtml:link hreflang`
  alternates.
- `llms.txt`: 10–20 lines: what the tool is, what it is not, the page list.
- `og.png`: 1200×630, a screenshot of the design tab with the product name overlaid; produced by
  the screenshot script (§3.4).
- Analytics: GoatCounter `<script data-goatcounter="https://walkinplanner.goatcounter.com/count"
  async src="//gc.zgo.at/count.js">` on every page and in `app/index.html`. The site code is a
  placeholder until the user supplies theirs. With no templating the snippet is duplicated per
  page; the site test (§3.3) asserts all copies are identical so one edit cannot drift.

### 3.3 Site tests (`site/site.test.ts`)

Node test that reads every HTML entry and asserts: exactly one `<title>` ≤ 60 chars, one
`meta description` ≤ 155 chars, canonical equals the page's URL, OG image present, landings have
the three `hreflang` links, every internal link target exists on disk, `sitemap.xml` lists exactly
the HTML entries, the GoatCounter snippet is identical across pages, JSON-LD blocks parse.

### 3.4 Screenshots

`scripts/screenshots.mjs` drives the built site with Playwright (`npx playwright` — not added
as a dependency; the script prints install instructions if missing): serves `dist/`, opens
`/app/?template=uShape`, and captures `design.png` (design tab, 1440×900), `3d.png` (3D tab),
`cutlist.png` (cut-list tab) and `mobile.png` (design tab at 390×844). `og.png` is `design.png`
cropped to 1200×630 with the product name drawn on top. Output to `public/screenshots/` and
`public/og.png`. Run manually; the PNGs are committed.

## 4. Units (mm / in)

- `src/units.ts` (pure): `type Units = 'mm' | 'in'`; `formatLen(mm, units)`,
  `parseLen(text, units): number | null` (returns mm), `stepFor(units)`.
  - `in`: `mm / 25.4`, rounded to the nearest 1/16; rendered as `23 5/8″` (whole + reduced
    fraction, `″` suffix in drawings/cut list; no suffix inside input boxes). Fractions render
    as ASCII `5/8`. Values ≥ 12 in stay in inches (no feet) — that is what cabinet shops use.
  - `parseLen` accepts `23`, `23.625`, `23 5/8`, `23-5/8`, `5/8`, and for `mm` plain numbers.
    Returns `null` for anything else.
  - `mm`: current behaviour (`fmtLen`), unchanged.
- `ui.units` in `UiState`, persisted under `wardrobe-planner:units`; initial value: stored, else
  `in` when `navigator.language` is `en-US`, else `mm`. Toggle button pair `mm | in` next to the
  language toggle in the top bar.
- Inputs: `useNumberInput` gains a `units` mode: `<input type="text" inputmode="decimal">` when
  `in`, displaying `formatLen` without suffix and committing `parseLen` results; `min`/`step`
  are converted. `mm` mode stays `type="number"`.
- Drawings: `Drawing` gets `units`; `expandDim`/`expandPrims` take `units` and label dims via
  `formatLen`. `views.ts` functions take `{ lang, units }`. Text labels that embed lengths (rail
  height, zone labels) use `formatLen` too. SVG and PDF renderers pass `drawing.units` through.
- Cut list table and PDF cut list: lengths via `formatLen`; the header says `mm` or `in`.
- JSON files stay mm; the units choice is a UI preference, not project data.
- Tests: format/parse round-trips (incl. 1/16 rounding, `0`, negatives rejected), a views test
  asserting an `in` drawing carries no bare-mm labels, an input test for the parse path.

## 5. Projects, templates, first run, share

### 5.1 Multiple projects (`src/store/projects.ts`)

- Storage keys: `wardrobe-planner:projects` = JSON `[{ id, name, updatedAt }]` (most recent
  first), `wardrobe-planner:project:<id>` = serialized project (same format as export),
  `wardrobe-planner:current` = id. `id` = `p` + base36 timestamp + 4 random chars.
- Migration on first load: if the legacy `wardrobe-planner:project` key exists and no index
  exists, it becomes project 1 (id generated, name from the project), then the legacy key is
  removed.
- API (pure over `StorageLike`): `listProjects`, `loadProject(id)`, `saveProject(id, p)`,
  `deleteProject(id)`, `setCurrent(id)`, `getCurrent()`. Index `name` is refreshed on every
  save; `updatedAt` = `Date.now()`.
- Store: `ui.projectId`; the existing autosave writes the current id; `switchProject(id)`,
  `createProject(p, name)`, `deleteProject(id)` actions. History and snapshot are cleared on
  switch. Deleting the current project switches to the most recent other one, or to a fresh
  default project if none. `newProject` becomes `createProject(defaultProject())`.
- Top bar: the name field stays; a "Projects ▾" button opens a menu listing projects (name,
  relative date), with New (blank / from template ▸), Duplicate, Delete (confirm). The old
  "New" button folds into this menu.

### 5.2 Templates (`src/model/templates.ts`)

Three complete valid projects built with `makePreset`:

| key | room (W×D×H) | walls | door |
|---|---|---|---|
| `oneWall` | 3000×1800×2500 | back only, 600 deep | front, centred, 800 |
| `lShape` | 2500×2000×2500 | back + left | front, offset 300, 800 |
| `uShape` | 3000×2500×2500 | back + left + right | front, offset 900, 900 |

Each fills its walls with a sensible mix (hanging, double hanging, drawers + hanging, shelves,
one shoe rack) and validates with zero errors (a test asserts this for all three). Names:
"One-wall example", "L-shape example", "U-shape example" (i18n keys `template.*`).

### 5.3 First run

If no project index exists after migration, the app creates the `lShape` template as the first
project and shows a dismissible hint bar under the top bar with three steps ("1 Click a wall in
the plan · 2 Press + to add a unit · 3 Click a unit to edit it"). Dismissal is stored in
`wardrobe-planner:hint-dismissed`. `?template=<key>` on `/app/` creates that template as a new
project and strips the query.

### 5.4 Share link (`src/store/share.ts`)

- `encodeShare(p): Promise<string>` → `p=` + base64url(deflate-raw(JSON of `{version, project}`))
  via `CompressionStream('deflate-raw')`; `decodeShare(hash): Promise<ParseResult>`. Fallback
  when `CompressionStream` is undefined: `j=` + base64url(JSON). Both variants are decodable
  everywhere `DecompressionStream` exists; the `j=` form always.
- "Share" button in the top bar: builds `location.origin + location.pathname + '#' + encoded`,
  copies to the clipboard, toast "Link copied". Disabled while the project has errors.
- On app start, if `location.hash` matches `#p=` / `#j=`: decode, shape-validate, create as a
  new project named from the file (suffix " (shared)"), clear the hash with
  `history.replaceState`, toast. Bad data → toast, hash cleared, normal start.
- Test: round-trip in Node (has both streams), the `j=` fallback, garbage rejected.

## 6. Mobile

- One breakpoint: `@media (max-width: 820px)`.
- `.app` stays a two-row grid but the top bar wraps: row 1 name + tabs, row 2 the rest; the
  Undo/Redo/Projects/Share/Import/Export/PDF buttons collapse into a "⋯" menu below 600 px.
- `.design` becomes a single column: plan (max-height 40vh, sticky off), then the settings
  panel as a collapsed `<details>` ("Room & settings"), then the elevation (min-height 50vh),
  then the inspector. Selecting a unit scrolls the inspector into view.
- Spawn menu (`SpawnMenu`) renders as a bottom sheet (fixed, full width) below the breakpoint.
- Buttons and the `+` hit circles get ≥ 40 px touch targets; number inputs `font-size: 16px`
  to stop iOS zoom.
- 3D: full width, `touch-action: none` on the canvas; orbit controls already handle touch.
- Cut list: table inside an `overflow-x: auto` wrapper.
- No JS feature gating. A visual check on an iPhone-width viewport is part of the task
  (Playwright screenshot at 390 px, committed to `public/screenshots/mobile.png` and used on
  the landing).

## 7. Shoe shelves

- `ZoneType` gains `'shoes'`. `count` = number of tilted shelves (≥ 1). Constants in
  `geometry/layout.ts`: `SHOE_TILT = 15` (degrees), `SHOE_LIP = 40` (lip height),
  `MIN_SHOE_PITCH = 150`, `SHOE_SHELF_DEPTH = 350` (a tilted shoe board is shallow — a shoe is
  about 300 mm long — so it never reaches the back of a 600 mm unit; this also keeps the board's
  vertical drop (≈ 91 mm) plus the lip inside the minimum pitch at any unit depth).
- Layout: shelves spaced evenly over the zone height: pitch = zone height / count; shelf `k`
  (0-based, bottom up) has its back edge at `yBot + pitch·k + pitch/2 + drop/2` where `drop =
  depth·sin(tilt)` — so the tilted board is centred in its pitch. `ZoneLayout` gets
  `shoeShelves: { yBack: number; yFront: number; depth: number }[]` (absolute Y of the board's top surface at
  the back and front edges); board depth = min(`SHOE_SHELF_DEPTH`, interior depth − `SHELF_SETBACK`).
  The board is front-aligned: its front edge sits `SHELF_SETBACK` behind the unit's front, like a
  flat shelf, and the space behind the board stays open.
- Validation: zone height / count ≥ `MIN_SHOE_PITCH`, else `error.shoePitch`.
- Parts: per shelf a `shelf` part rotated `rx = −tilt` (front edge down) with note
  `note.tilted` ("tilted 15°"), plus a `lip` part (new `PartKind`/`PartNameKey` `lip`,
  material `panel`): `interiorWidth × SHOE_LIP × t`, standing on the front edge of the shelf,
  perpendicular to it. Cut list groups lips like any panel; `KIND_ORDER` gets `lip` after
  `shelf`.
- Elevation drawing: each shelf as a filled band of height `drop` (the tilted board seen from
  the front) plus the lip band above its front edge; zone label "Shoes ×n".
- Plan drawing: unchanged (shelves are inside the unit).
- 3D: `PartMesh` already applies `transform.rotation`; nothing new.
- Preset `shoes` ("Shoe rack"): `[Z('shoes', 900, 5), Z('shelves', null, 3)]`. Spawn menu and
  inspector zone-type select list it. i18n: `zone.shoes`, `preset.shoes`, `part.lip`,
  `note.tilted`, `error.shoePitch`, `drawing.shoes` (EN + RU).
- Persistence: `isZoneShape` accepts `'shoes'`; no version bump (older builds would reject the
  file, which is acceptable — the file format only ever moves forward).
- Tests: layout positions (pitch, drop), parts count and rotation, validation boundary, cut-list
  rows, elevation prims present, i18n coverage (automatic).

## 8. PDF snapshot without a 3D visit

- `ui/snapshot.ts` gains `renderSnapshot(project): Promise<string | null>`: creates an
  off-screen container (`position: fixed; left: -10000px; width: 1200px; height: 800px`),
  mounts a `<Viewport3D snapshotOnly />` React root into it, waits for the bridge to report a
  frame (`setSnapshotSource` + one `requestAnimationFrame` after the scene's first `useFrame`),
  encodes, unmounts, removes the container. 5 s timeout → `null`.
- `takeSnapshot()` → `cacheSnapshot()` result if any, else `await renderSnapshot(lastValid)`.
  The export button awaits it. `Viewport3D` accepts `snapshotOnly` to hide its controls overlay
  and skip the orbit controls.
- Failure keeps today's behaviour (PDF says the snapshot is missing).

## 9. Label collisions

Audit the plan and elevations of the three templates at the default text size, in both units
and both languages, and fix overlaps found: at minimum the rail-height label vs. the shelf-bay
dimension chain, the `⟂` rail label width guard, and the plan's unit tags vs. wall names.
Fixes go in `drawing/views.ts`; each fix gets a regression test on the prim positions.

## 10. README

Rewrite the top: product name, live link `https://walkinplanner.com`, three screenshots
(`public/screenshots/design.png`, `3d.png`, `mobile.png`), a one-paragraph pitch, "What it
does / What it does not", then the existing Use / Develop / Layout / Deploy sections updated
for the MPA layout, units, projects, share links and shoe shelves.

## 11. Error handling

- Storage quota exceeded on save → toast `toast.storageFull`, keep working in memory.
- Share decode failure → toast `toast.shareInvalid`, app starts normally.
- Off-screen snapshot failure → PDF without a picture, as today.
- Units parse failure → input keeps the draft, value unchanged (same as today's non-finite path).

## 12. Testing

Vitest, node environment, as today. New pure modules (`units`, `projects`, `share`,
`templates`, shoes geometry) are covered directly. `site/site.test.ts` guards the static pages.
`pnpm test`, `pnpm typecheck`, `pnpm build` green at the end of every task; the build must emit
all seven HTML pages under `dist/` with the expected paths (a build-output check in the site
test is acceptable when `dist/` exists, skipped otherwise).

## 13. Build order

1. Domain + MPA + landing + guides + SEO files + analytics + site test (no app changes).
2. Units.
3. Projects + templates + first run + share.
4. Mobile.
5. Shoe shelves.
6. Off-screen PDF snapshot, label collisions, screenshots script + PNGs, README.

Each step leaves the app fully working; steps 2–5 are independent of each other except that 3
and 4 both touch `TopBar.tsx`, so they run in that order, not in parallel.
