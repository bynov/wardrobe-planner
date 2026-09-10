# Walk-in Planner growth release — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship walkinplanner.com: an indexable static landing site around the planner app, plus imperial units, multiple projects, templates + first-run hint, share links, phone layout, shoe shelves, a PDF that renders its own 3D snapshot, and a selling README.

**Architecture:** Vite multi-page build — hand-written HTML pages at the site root, the React SPA moved to `/app/`. App features keep the existing shape: pure TS modules under `src/` with vitest node tests, zustand store, thin React UI. New pure modules: `src/units.ts`, `src/store/projects.ts`, `src/store/share.ts`, `src/model/templates.ts`.

**Tech Stack:** Vite 8, TypeScript 7, React 18, zustand 5, R3F 8, jsPDF 4, vitest 5, pnpm 11. Playwright via `npx` for screenshots only.

**Spec:** `docs/superpowers/specs/2026-09-10-walkin-planner-growth-design.md` — read it first; CLAUDE.md holds the binding domain conventions.

## Global Constraints

- **No git commits or pushes.** The user commits. Tasks end with verification, not a commit.
- `pnpm test`, `pnpm typecheck`, `pnpm build` green at the end of every task; test output pristine (no stray console output).
- All lengths in the model stay mm. Units are display-only.
- Every user-visible string in the app goes through `t()`/`Msg`; add EN + RU together (`src/i18n/en.ts`, `src/i18n/ru.ts`); the parity test enforces it.
- Product name: **Walk-in Planner**. Domain: `https://walkinplanner.com`. Analytics placeholder: `https://walkinplanner.goatcounter.com/count`.
- Constants belong at the top of `src/geometry/layout.ts` (geometry) or the module that owns them; never inline numbers.
- Follow existing code style: 2-space, single quotes, semicolons, doc comments that explain *why*.
- Tests run in the node environment: nothing under test may touch `document`/`window` unguarded.

---

## File map

| Path | Responsibility |
|---|---|
| `index.html` | EN landing (was the app shell) |
| `ru/index.html` | RU landing |
| `guides/<slug>/index.html` ×4 | guides |
| `app/index.html` | app shell (`#root` + `/src/main.tsx`) |
| `site/site.css` | landing + guide styles |
| `site/site.test.ts` | static-page guard test |
| `public/CNAME`, `robots.txt`, `sitemap.xml`, `llms.txt`, `favicon.svg`, `og.png`, `screenshots/` | static assets copied verbatim |
| `vite.config.ts` | MPA inputs |
| `.github/workflows/pages.yml` | drop `BASE_PATH` |
| `src/units.ts` (+test) | mm/in format + parse |
| `src/drawing/dim.ts`, `ir.ts`, `views.ts`, `render/svg.ts`, `render/pdf.ts` | units through drawings |
| `src/ui/fields.tsx` | units-aware inputs |
| `src/store/projects.ts` (+test) | multi-project storage |
| `src/store/share.ts` (+test) | share-link codec |
| `src/model/templates.ts` (+test) | example projects |
| `src/store/store.ts` | `ui.units`, `ui.projectId`, project actions, startup (hash / `?template`) |
| `src/ui/TopBar.tsx`, `ProjectsMenu.tsx`, `HintBar.tsx` | top bar, project menu, first-run hint |
| `src/styles.css`, `src/ui/SpawnMenu.tsx`, `DesignTab.tsx` | mobile layout |
| `src/model/types.ts`, `validate.ts`, `presets.ts`, `geometry/layout.ts`, `parts.ts`, `cutlist/cutlist.ts`, `drawing/views.ts`, `ui/Inspector.tsx` | shoe shelves |
| `src/ui/snapshot.ts`, `ui/three/Viewport3D.tsx` | off-screen snapshot |
| `scripts/screenshots.mjs`, `README.md` | screenshots + README |

---

### Task 1: Move the app to `/app/`, custom domain, product name

**Files:**
- Create: `app/index.html`, `public/CNAME`
- Modify: `index.html` (becomes a temporary stub — Task 2 replaces it), `vite.config.ts`, `.github/workflows/pages.yml`, `src/i18n/en.ts`, `src/i18n/ru.ts`, `src/pdf/exportPdf.ts` (default title), `README.md` (dev URL only)
- Test: existing suite; manual `pnpm build` output check

**Interfaces:**
- Produces: `dist/app/index.html`, `dist/index.html`, `dist/CNAME`. Vite `base` is `/`.

- [ ] **Step 1: Create `app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Walk-in Planner</title>
    <meta name="robots" content="noindex" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <script data-goatcounter="https://walkinplanner.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`noindex` on the app: the landing is the page we want ranked; the app has no text.

- [ ] **Step 2: Replace root `index.html` with a stub** that Task 2 overwrites: `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Walk-in Planner</title></head><body><a href="/app/">Open the planner</a></body></html>`.

- [ ] **Step 3: MPA config in `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const pages = ['index.html', 'app/index.html'];

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { rollupOptions: { input: Object.fromEntries(pages.map((p) => [p.replace(/\/?index\.html$/, '') || 'index', resolve(__dirname, p)])) } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'site/**/*.test.ts'], passWithNoTests: true },
});
```

Tasks 2–3 append pages to the `pages` array.

- [ ] **Step 4: `public/CNAME`** containing exactly `walkinplanner.com` (no newline issues: one line).

- [ ] **Step 5: Workflow** — remove the `env: BASE_PATH:` block from the build step in `.github/workflows/pages.yml`. Also remove the `BASE_PATH` comment from `vite.config.ts`.

- [ ] **Step 6: Product name** — `en.ts`: `'pdf.defaultTitle'` → `'Walk-in Planner'` (check its current value and any `ui.*` key that says "Walk-in Wardrobe Planner"; keep the RU wording as «Планировщик гардеробной» + latin "Walk-in Planner"). `defaultProject().name` stays `'Walk-in wardrobe'` (project name ≠ product name).

- [ ] **Step 7: README dev section** — dev URL becomes `http://localhost:5173/app/`; note the landing is at `/`. (Full README rewrite is Task 16.)

- [ ] **Step 8: Verify**

Run: `pnpm test && pnpm typecheck && pnpm build && ls dist/app/index.html dist/index.html dist/CNAME`
Expected: all green; three files exist; `dist/app/index.html` references hashed `/assets/*.js`.

---

### Task 2: EN landing, shared CSS, static SEO files, site test

**Files:**
- Create: `site/site.css`, `site/site.test.ts`, `site/pages.ts`, `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, `public/favicon.svg`, `public/og.png` (placeholder: 1200×630 solid PNG generated by the script in Step 6; Task 16 replaces it)
- Modify: `index.html`, `vite.config.ts` (nothing new yet — landing is already an input)

**Interfaces:**
- Produces: `site/pages.ts` exporting `PAGES: { file: string; url: string; lang: 'en' | 'ru'; kind: 'landing' | 'guide' }[]` — the single list the site test, sitemap and Vite inputs derive from (Vite config imports it).

- [ ] **Step 1: `site/pages.ts`**

```ts
export interface SitePage { file: string; url: string; lang: 'en' | 'ru'; kind: 'landing' | 'guide' }
export const ORIGIN = 'https://walkinplanner.com';
export const PAGES: SitePage[] = [
  { file: 'index.html', url: '/', lang: 'en', kind: 'landing' },
];
export const GOATCOUNTER = '<script data-goatcounter="https://walkinplanner.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>';
```

`vite.config.ts`: `const pages = ['app/index.html', ...PAGES.map((p) => p.file)]` (import from `./site/pages`).

- [ ] **Step 2: Write the failing site test `site/site.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { GOATCOUNTER, ORIGIN, PAGES } from './pages';

const root = resolve(__dirname, '..');
const read = (f: string) => readFileSync(resolve(root, f), 'utf8');
const one = (html: string, re: RegExp) => { const m = html.match(re); expect(m, String(re)).not.toBeNull(); return m![1]; };

describe('site pages', () => {
  for (const p of PAGES) {
    describe(p.url, () => {
      const html = read(p.file);
      it('has title, description, canonical, viewport, OG, twitter, favicon, analytics', () => {
        const title = one(html, /<title>([^<]+)<\/title>/);
        expect(title.length).toBeLessThanOrEqual(60);
        expect(title.toLowerCase()).toContain(p.lang === 'en' ? 'walk-in' : 'гардероб');
        expect((html.match(/<title>/g) ?? []).length).toBe(1);
        const desc = one(html, /<meta name="description" content="([^"]+)"/);
        expect(desc.length).toBeLessThanOrEqual(155);
        expect(one(html, /<link rel="canonical" href="([^"]+)"/)).toBe(ORIGIN + p.url);
        expect(html).toMatch(/<meta name="viewport"/);
        expect(html).toMatch(/<meta name="theme-color"/);
        for (const k of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type']) expect(html, k).toContain(`property="${k}"`);
        expect(one(html, /<meta property="og:url" content="([^"]+)"/)).toBe(ORIGIN + p.url);
        expect(html).toContain('name="twitter:card" content="summary_large_image"');
        expect(html).toContain('rel="icon"');
        expect(html).toContain(GOATCOUNTER);
        expect(html).toMatch(new RegExp(`<html lang="${p.lang}"`));
      });
      it('JSON-LD parses and matches the page kind', () => {
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
        const types = blocks.map((b) => b['@type']);
        expect(types).toContain('FAQPage');
        expect(types).toContain(p.kind === 'landing' ? 'SoftwareApplication' : 'Article');
      });
      it('internal links resolve to files', () => {
        const hrefs = [...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]);
        for (const h of hrefs) {
          if (h === '/app/') continue; // built by Vite from app/index.html
          const file = h.endsWith('/') ? `${h.slice(1)}index.html` : h.slice(1);
          const inPublic = existsSync(resolve(root, 'public', file));
          expect(inPublic || existsSync(resolve(root, file)), h).toBe(true);
        }
      });
      if (p.kind === 'landing') it('has hreflang en, ru, x-default', () => {
        for (const l of ['en', 'ru', 'x-default']) expect(html).toContain(`hreflang="${l}"`);
      });
    });
  }
  it('sitemap lists exactly the pages', () => {
    const xml = read('public/sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    expect(locs).toEqual(PAGES.map((p) => ORIGIN + p.url).sort());
  });
  it('robots points at the sitemap', () => {
    expect(read('public/robots.txt')).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
  it('llms.txt exists and names the product', () => {
    expect(read('public/llms.txt')).toContain('Walk-in Planner');
  });
});
```

- [ ] **Step 3: Run** `pnpm test site` — expected: FAIL (stub landing has none of it).

- [ ] **Step 4: Write `index.html`** (EN landing). Required structure — write real copy, no lorem:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Walk-in Planner – Free Walk-in Wardrobe & Closet Planner</title>
  <meta name="description" content="Plan a walk-in wardrobe in your browser: 3D preview, dimensioned plan and elevations, cut list and PDF. Free, no account, works in mm or inches." />
  <link rel="canonical" href="https://walkinplanner.com/" />
  <link rel="alternate" hreflang="en" href="https://walkinplanner.com/" />
  <link rel="alternate" hreflang="ru" href="https://walkinplanner.com/ru/" />
  <link rel="alternate" hreflang="x-default" href="https://walkinplanner.com/" />
  <meta name="theme-color" content="#2b6cb0" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Walk-in Planner – free walk-in wardrobe planner" />
  <meta property="og:description" content="3D preview, plan and elevations, cut list and PDF. Free, in the browser." />
  <meta property="og:url" content="https://walkinplanner.com/" />
  <meta property="og:image" content="https://walkinplanner.com/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/site/site.css" />
  <script type="application/ld+json">{ "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Walk-in Planner", "applicationCategory": "DesignApplication", "operatingSystem": "Web", "url": "https://walkinplanner.com/", "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }, "description": "Free browser planner for walk-in wardrobes: 3D, plans, elevations, cut list, PDF." }</script>
  <script type="application/ld+json">{ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [ /* the 6 FAQ Q/As below, as Question/Answer objects */ ] }</script>
  <script data-goatcounter="https://walkinplanner.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</head>
<body>
  <header class="nav"><a class="brand" href="/">Walk-in Planner</a><nav><a href="/guides/wardrobe-dimensions/">Guides</a><a href="/ru/">RU</a><a class="cta" href="/app/">Open the planner</a></nav></header>
  <main>
    <section class="hero"><h1>Free walk-in wardrobe planner</h1><p>…one paragraph…</p><a class="cta big" href="/app/">Open the planner</a><p class="sub">No account. Saves in your browser. mm or inches.</p><img src="/screenshots/design.png" alt="Walk-in Planner design tab: plan, wall elevation and inspector" width="1440" height="900" /></section>
    <section class="features"><h2>What you get</h2><ul>…6 items: 3D, plan + elevations, cut list, PDF, templates, share link…</ul><div class="shots"><img src="/screenshots/3d.png" …/><img src="/screenshots/mobile.png" …/></div></section>
    <section class="not"><h2>What it is not</h2><p>No doors on units, no drawer boxes or hardware, rectangular rooms only. It plans an open walk-in.</p></section>
    <section class="faq"><h2>FAQ</h2><details><summary>Is it free?</summary><p>…</p></details> ×6</section>
    <section class="guides"><h2>Guides</h2><ul>4 links</ul></section>
  </main>
  <footer><a href="https://github.com/bynov/wardrobe-planner">Source on GitHub</a> · MIT</footer>
</body>
</html>
```

Guide links point at the four URLs from the spec; Task 3 creates them, so until then the "internal links resolve" assertion fails for those — **create empty placeholder guide files in this task** (`guides/<slug>/index.html` with only a title) is NOT allowed (they would break the meta test). Instead, add the guide links in Task 3. In this task the Guides section lists nothing yet.

- [ ] **Step 5: `site/site.css`** — mobile-first, max-width 960px container, system font stack, `.cta` button (#2b6cb0), `.hero img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 6px }`, `.shots { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }` collapsing to 1 column under 700px, `details` FAQ styling, footer muted. Under 120 lines.

- [ ] **Step 6: Static files**
  - `public/robots.txt`: `User-agent: *\nAllow: /\nSitemap: https://walkinplanner.com/sitemap.xml\n`
  - `public/sitemap.xml`: urlset with `xmlns:xhtml`, one `<url>` for `/` with `<lastmod>2026-09-10</lastmod>` and two `xhtml:link` alternates (en, ru — ru URL is added to PAGES in Task 3; until then include only `/` and its self-alternate). Keep `<loc>` set equal to `PAGES`.
  - `public/llms.txt`: `# Walk-in Planner` + 10–15 lines: what it does, what it does not, page list.
  - `public/favicon.svg`: simple SVG — 32×32 rounded square #2b6cb0 with a white hanger/rail glyph (two lines).
  - `public/og.png`: generate a 1200×630 placeholder with `node -e` using zlib + a hand-built PNG (solid #2b6cb0). Simplest: `python3 -c` with `zlib`/`struct` writing a solid PNG. Task 16 replaces it.
  - `public/screenshots/design.png`, `3d.png`, `mobile.png`: same placeholder generator, sizes 1440×900, 1440×900, 390×844. Task 16 replaces them.

- [ ] **Step 7: Verify** — `pnpm test && pnpm typecheck && pnpm build`; open `pnpm preview` and load `/`, `/app/`.

---

### Task 3: RU landing and four guides

**Files:**
- Create: `ru/index.html`, `guides/wardrobe-dimensions/index.html`, `guides/hanging-rail-height/index.html`, `guides/shelf-depth-and-spacing/index.html`, `guides/walk-in-closet-minimum-width/index.html`
- Modify: `site/pages.ts` (add 5 pages), `public/sitemap.xml`, `index.html` (guide links + RU link), `public/llms.txt` (page list)

- [ ] **Step 1: Add pages to `PAGES`** (`url` `/ru/` lang ru kind landing; the four `/guides/<slug>/` lang en kind guide). Run `pnpm test site` — FAIL: files missing.

- [ ] **Step 2: `ru/index.html`** — same head set as EN with `lang="ru"`, canonical `/ru/`, the same three hreflang links, RU title `Планировщик гардеробной онлайн – Walk-in Planner` (≤ 60 chars), RU description, RU JSON-LD (`inLanguage: "ru"`), same sections translated. CTA → `/app/` (the app auto-detects RU). Nav link "EN" → `/`.

- [ ] **Step 3: Guides** — each: head set (canonical, OG, twitter, favicon, analytics, `Article` JSON-LD with `headline`, `datePublished: "2026-09-10"`, `author: {"@type":"Person","name":"Alexey Vilenski"}`, `FAQPage` with 3 Q/As), nav, `<article>` with H1, 500–900 words, exactly one `<table>`, an FAQ `<details>` block, a CTA `<a href="/app/?template=<key>">Try it in the planner</a>` (`oneWall` for dimensions, `lShape` for rail height, `uShape` for shelf depth and minimum width). Numbers to use (they match the app):

| Guide | Table content |
|---|---|
| wardrobe-dimensions | unit depth 500–650 mm (600 default), width 400–1000 mm per unit, plinth 100 mm, ceiling gap 150 mm, panel 18 mm |
| hanging-rail-height | long hanging 1600–1800 mm rail, double hanging 1000 + 2000 mm, max comfortable 2000 mm (planner clamps there), 80 mm below the shelf above, 40 mm end clearance |
| shelf-depth-and-spacing | folded clothes 300–350 mm pitch, shoes 150–200 mm pitch (angled 15°), shelf depth = unit depth − 20 mm setback, max span 900 mm for 18 mm board |
| walk-in-closet-minimum-width | one-wall: 1500 mm room depth (600 units + 900 aisle); two walls: 2100; U-shape: 2100 × 2400 min; door 700–900 |

- [ ] **Step 4: Sitemap** — add the 5 URLs (`lastmod` 2026-09-10); both landings carry `xhtml:link` alternates for en/ru/x-default. Add the guide links to the EN landing's Guides section and RU landing (guides are EN-only; label them "(EN)").

- [ ] **Step 5: Verify** — `pnpm test && pnpm build && ls dist/ru/index.html dist/guides/*/index.html`.

---

### Task 4: `src/units.ts` — format and parse

**Files:**
- Create: `src/units.ts`, `src/units.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Units = 'mm' | 'in';
  export const UNITS: Units[];
  export const isUnits: (v: unknown) => v is Units;
  export function formatLen(mm: number, units: Units, opts?: { suffix?: boolean }): string; // 'in' → '23 5/8' or '23 5/8″' with suffix
  export function parseLen(text: string, units: Units): number | null; // returns mm
  export function stepFor(units: Units): number; // 1 for mm, 0.0625 for in (in *display* units)
  export function toDisplay(mm: number, units: Units): number; // mm→in decimal (unrounded) or identity
  export function fromDisplay(v: number, units: Units): number; // in→mm or identity
  export const IN_MM = 25.4;
  ```

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { formatLen, parseLen, stepFor, toDisplay, fromDisplay } from './units';

describe('formatLen', () => {
  it('mm keeps fmtLen behaviour', () => {
    expect(formatLen(600, 'mm')).toBe('600');
    expect(formatLen(600.25, 'mm')).toBe('600.3');
    expect(formatLen(600, 'mm', { suffix: true })).toBe('600');
  });
  it('inches to the nearest 1/16, reduced', () => {
    expect(formatLen(600, 'in')).toBe('23 5/8');         // 23.622 → 23 10/16 → 23 5/8
    expect(formatLen(25.4, 'in')).toBe('1');
    expect(formatLen(12.7, 'in')).toBe('1/2');
    expect(formatLen(0, 'in')).toBe('0');
    expect(formatLen(2540, 'in')).toBe('100');             // no feet
    expect(formatLen(600, 'in', { suffix: true })).toBe('23 5/8″');
    expect(formatLen(25.3, 'in')).toBe('1');               // rounds up across the integer
  });
});
describe('parseLen', () => {
  it.each([['23', 584.2], ['23.625', 600.075], ['23 5/8', 600.075], ['23-5/8', 600.075], ['5/8', 15.875], [' 1 ', 25.4]])('in %s', (s, mm) => {
    expect(parseLen(s, 'in')).toBeCloseTo(mm, 3);
  });
  it('mm plain numbers only', () => {
    expect(parseLen('600', 'mm')).toBe(600);
    expect(parseLen('600.5', 'mm')).toBe(600.5);
    expect(parseLen('23 5/8', 'mm')).toBeNull();
  });
  it('rejects garbage and negatives', () => {
    for (const s of ['', '-', 'abc', '1/0', '-5', '5/', '1e3x']) expect(parseLen(s, 'in'), s).toBeNull();
    expect(parseLen('-5', 'mm')).toBeNull();
  });
});
it('step and conversions', () => {
  expect(stepFor('mm')).toBe(1);
  expect(stepFor('in')).toBe(0.0625);
  expect(toDisplay(25.4, 'in')).toBeCloseTo(1);
  expect(fromDisplay(1, 'in')).toBeCloseTo(25.4);
  expect(toDisplay(7, 'mm')).toBe(7);
});
```

- [ ] **Step 2: Run** `pnpm test src/units.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
export type Units = 'mm' | 'in';
export const UNITS: Units[] = ['mm', 'in'];
export const isUnits = (v: unknown): v is Units => v === 'mm' || v === 'in';
export const IN_MM = 25.4;
const SIXTEENTHS = 16;

const fmtMm = (n: number): string => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Fractional inches the way a shop reads them: whole number plus a reduced sixteenth. No feet. */
export function formatLen(mm: number, units: Units, opts: { suffix?: boolean } = {}): string {
  if (units === 'mm') return fmtMm(mm);
  const total = Math.round((mm / IN_MM) * SIXTEENTHS);
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(total);
  const whole = Math.floor(abs / SIXTEENTHS);
  let num = abs % SIXTEENTHS, den = SIXTEENTHS;
  const g = num ? gcd(num, den) : 1;
  num /= g; den /= g;
  const body = num === 0 ? String(whole) : whole === 0 ? `${num}/${den}` : `${whole} ${num}/${den}`;
  return `${sign}${body}${opts.suffix ? '″' : ''}`;
}

const IN_RE = /^(?:(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?|(\d+)\/(\d+))$/;

/** Parses a typed length in `units` and returns millimetres; null when the text is not a length. */
export function parseLen(text: string, units: Units): number | null {
  const s = text.trim();
  if (units === 'mm') {
    if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
    return Number(s);
  }
  const m = IN_RE.exec(s);
  if (!m) return null;
  let inches: number;
  if (m[4] !== undefined) { const d = Number(m[5]); if (d === 0) return null; inches = Number(m[4]) / d; }
  else { inches = Number(m[1]); if (m[2] !== undefined) { const d = Number(m[3]); if (d === 0) return null; inches += Number(m[2]) / d; } }
  return inches * IN_MM;
}

export const stepFor = (units: Units): number => (units === 'mm' ? 1 : 1 / SIXTEENTHS);
export const toDisplay = (mm: number, units: Units): number => (units === 'mm' ? mm : mm / IN_MM);
export const fromDisplay = (v: number, units: Units): number => (units === 'mm' ? v : v * IN_MM);
```

Note: `parseLen('1 ', 'in')` → whole `1`. `mm` parse rejects negatives by regex (the current `type=number` inputs allowed them; validation catches them anyway, and the spec says negatives rejected).

- [ ] **Step 4: Run** `pnpm test src/units.test.ts` — PASS. Then `pnpm typecheck`.

---

### Task 5: Units in UI state, persistence, top bar, inputs

**Files:**
- Modify: `src/store/persist.ts` (add `UNITS_KEY`, `loadUnits`, `saveUnits`), `src/store/store.ts` (`ui.units`, `setUnits`, autosave, initial detection), `src/ui/fields.tsx` (units-aware inputs), `src/ui/TopBar.tsx` (toggle), `src/i18n/en.ts`/`ru.ts` (`ui.units.mm`, `ui.units.in`), every caller of `NumberField`/`NumberInput` that edits a *length* (RoomForm, Inspector, ElevationEditor head width field, SpawnMenu width) — pass `units`; counts stay unit-less.
- Test: `src/store/persist.test.ts` (units load/save), `src/store/store.test.ts` (`setUnits`), `src/ui/fields.test.ts` (new: pure draft logic)

**Interfaces:**
- Produces: `UiState.units: Units`; `setUnits(u: Units)`; `createPlannerStore(initial, lang, units = 'mm')`; `NumberField`/`NumberInput` accept `units?: Units` (default `'mm'` = today's behaviour) and `min`/`step` remain in **mm**; `detectUnits(navLang: string | undefined): Units` in `src/units.ts` (`en-US` → `in`, else `mm`).

- [ ] **Step 1: Tests first**
  - `persist.test.ts`: `saveUnits(storage,'in')` then `loadUnits(storage)` → `'in'`; garbage → `null`.
  - `store.test.ts`: `createPlannerStore(defaultProject(), 'en', 'in').getState().ui.units === 'in'`; `setUnits('mm')` flips; `startAutosave` writes `wardrobe-planner:units` when it changes (mirror the lang test that exists).
  - `units.test.ts`: `detectUnits('en-US') === 'in'`, `detectUnits('en-GB') === 'mm'`, `detectUnits(undefined) === 'mm'`.
  - `src/ui/fields.test.ts`: extract the draft/commit logic from `useNumberInput` into a pure helper `commitDraft(text: string, units: Units): number | null` (mm mode: finite number; in mode: `parseLen`) and test both modes.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
  - `persist.ts`: `export const UNITS_KEY = 'wardrobe-planner:units';` `loadUnits`/`saveUnits` mirroring `loadLang`/`saveLang` with `isUnits`.
  - `store.ts`: `ui.units`; `setUnits`; autosave `if (s.ui.units !== prev.ui.units) saveUnits(storage, s.ui.units);` initial: `(browserStorage && loadUnits(browserStorage)) ?? detectUnits(navigator.language)`.
  - `fields.tsx`: `useNumberInput(value, onChange, units: Units = 'mm')` — display `units === 'in' ? formatLen(value, 'in') : String(value)`; on change `const v = commitDraft(text, units); if (v !== null) onChange(v)`. `NumberInput`/`NumberField` render `type="text" inputMode="decimal"` when `in`, with `min`/`step` omitted (they are validated by the model), else the existing `type="number"` with `min`/`step` in mm.
  - Length fields: RoomForm (width/depth/height, door offset/width/height, door margin, top gap, plinth, thicknesses, wall depth), Inspector (unit width, zone height, rail offset, gap rail height), ElevationEditor head (column width, if present), SpawnMenu (width). Pass `units={units}` from `useStore((s) => s.ui.units)`. Counts (`compartments`, drawers) do not get `units`.
  - TopBar: after the lang toggle, `<nav className="tabs units">` with two buttons `mm` / `in` (labels via `t('ui.units.mm')`).
  - Labels that say "(mm)" in EN/RU strings (grep `mm` in `en.ts`): replace with `{u}` param and pass `t(key, { u: t(`ui.units.${units}`) })`, or drop the unit from the label where the toggle makes it obvious. Keep RU parity.

- [ ] **Step 4: Verify** — `pnpm test && pnpm typecheck && pnpm build`; in `pnpm dev`, switch to `in`, type `23 5/8` in unit width → 600.075 mm stored (inspector shows `23 5/8`).

---

### Task 6: Units in drawings, cut list, PDF

**Files:**
- Modify: `src/drawing/dim.ts` (`fmtLen` → delegate; `expandDim(d, textSize, units)`), `src/drawing/ir.ts` (`Drawing.units`, `makeDrawing(title, prims, textSize, units)`, `expandPrims(prims, textSize, units)`), `src/drawing/views.ts` (`planView(p, lang, units)`, `wallElevation(p, wall, lang, units)`; every embedded length label uses `formatLen(x, units)`), `src/render/svg.ts`, `src/render/pdf.ts` (pass `d.units`), `src/ui/ElevationEditor.tsx`, `src/ui/PlanEditor.tsx`, `src/ui/CutListTable.tsx`, `src/pdf/exportPdf.ts` (`PdfOptions.units`), `src/ui/TopBar.tsx` (pass units to export), `src/i18n` (`table.length` etc. gain `{u}` or a header note "lengths in mm/in")
- Test: `src/drawing/views.test.ts` (an `in` elevation contains `23 5/8` style labels and no label equals a bare mm number of a known dimension), `src/render/pdf.test.ts`/`svg.test.ts` (units pass-through), `src/pdf/exportPdf.test.ts` (summary rows in inches)

- [ ] **Step 1: Tests**

```ts
it('labels dimensions in inches when asked', () => {
  const d = wallElevation(defaultProject(), 'back', 'en', 'in');
  const texts = expandPrims(d.prims, d.textSize, d.units).filter((p) => p.t === 'text').map((p) => (p as Extract<Prim, { t: 'text' }>).text);
  expect(texts).toContain('23 5/8');      // 600 mm unit width
  expect(texts).not.toContain('600');
  expect(d.units).toBe('in');
});
```

Plus a `planView` twin (room width 2400 → `94 1/2`).

- [ ] **Step 2: Run** — FAIL (signature).

- [ ] **Step 3: Implement** — thread `units` (default `'mm'` everywhere so existing tests keep passing). In `views.ts` grep for `fmtLen(` and any template literal that prints a number of mm (rail height labels, zone labels like `${h}`), route them through `formatLen(x, units)`. `summaryRows(p, lang, date, units)` prints room and door sizes with `formatLen(...,{suffix:true})` for `in`. Cut list: `CutListTable` and `cutListPages` format `length/width/thickness` with `formatLen`; header cells get the unit: `t('table.length')` + ` (${units})`.

- [ ] **Step 4: Verify** — full suite, typecheck, build; visually check an `in` elevation in dev.

---

### Task 7: `src/store/projects.ts` — multi-project storage

**Files:**
- Create: `src/store/projects.ts`, `src/store/projects.test.ts`
- Modify: `src/store/persist.ts` (export `STORAGE_KEY` stays for migration; `StorageLike` gains `removeItem`)

**Interfaces:**
- Produces:
  ```ts
  export interface ProjectMeta { id: string; name: string; updatedAt: number }
  export const INDEX_KEY = 'wardrobe-planner:projects';
  export const CURRENT_KEY = 'wardrobe-planner:current';
  export const HINT_KEY = 'wardrobe-planner:hint-dismissed';
  export const projectKey = (id: string) => `wardrobe-planner:project:${id}`;
  export function newProjectId(now?: number): string;
  export function listProjects(s: StorageLike): ProjectMeta[];           // most recent first
  export function loadProjectById(s: StorageLike, id: string): Project | null;
  export function saveProject(s: StorageLike, id: string, p: Project, now?: number): boolean; // false on quota error
  export function deleteProject(s: StorageLike, id: string): void;
  export function getCurrent(s: StorageLike): string | null;
  export function setCurrent(s: StorageLike, id: string): void;
  export function migrateLegacy(s: StorageLike, now?: number): string | null; // returns new id if it migrated
  ```
- `StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>` — update the memory-storage helper used in `persist.test.ts`/`store.test.ts`.

- [ ] **Step 1: Tests** (use a `memStorage()` helper returning a Map-backed `StorageLike`):
  - save two projects → `listProjects` returns both, newest first, names from the project.
  - `saveProject` updates `updatedAt` and index name on rename.
  - `deleteProject` removes key + index entry; deleting current clears `CURRENT_KEY`.
  - `migrateLegacy`: legacy key present + no index → index has 1 entry, legacy key removed, current set; second call returns `null`; no legacy → `null`.
  - `saveProject` returns `false` when `setItem` throws (quota).
  - `loadProjectById` returns `null` for missing / corrupt.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — index stored as JSON array; `saveProject` writes the project first, then the index (so a quota failure on the index leaves a readable project); `newProjectId = 'p' + now.toString(36) + Math.random().toString(36).slice(2, 6)`. Wrap every storage access in try/catch like `persist.ts`.

- [ ] **Step 4: Verify** — suite, typecheck.

---

### Task 8: Store integration and Projects menu

**Files:**
- Modify: `src/store/store.ts` (`ui.projectId`, actions, autosave, bootstrap), `src/ui/TopBar.tsx` (replace New with Projects menu), `src/i18n` (`ui.projects`, `ui.newBlank`, `ui.newFromTemplate`, `ui.duplicateProject`, `ui.deleteProject`, `ui.confirmDelete`, `ui.storageFull`, `ui.justNow`, `ui.minutesAgo`, `ui.hoursAgo`, `ui.daysAgo`)
- Create: `src/ui/ProjectsMenu.tsx`
- Test: `src/store/store.test.ts`

**Interfaces:**
- Produces on the store: `ui.projectId: string`, `projects: ProjectMeta[]` (mirror of the index, refreshed after every save/switch/delete), `switchProject(id)`, `createProject(p: Project, opts?: { select?: boolean })`, `duplicateProject(id)`, `deleteProject(id)`. `createPlannerStore(initial, lang, units, projectId = 'p0')`. `startAutosave(store, storage)` writes `projectKey(ui.projectId)` and refreshes `projects`. `newProject()` → `createProject(defaultProject())`.
- `bootstrap(storage: StorageLike | null): { project: Project; projectId: string; firstRun: boolean }` exported from `store.ts` — runs `migrateLegacy`, then loads `getCurrent()` or the newest project; when the index is empty returns `{ project: defaultProject(), projectId: newProjectId(), firstRun: true }`. (Task 9 swaps the default for the L-shape template.)

- [ ] **Step 1: Tests** — with `memStorage()`:
  - `bootstrap` on empty storage → `firstRun: true`; after `saveProject` → `firstRun: false`, loads it.
  - `createProject` adds to `projects`, selects it, clears `past/future`, resets selection.
  - `switchProject` loads that project; `deleteProject` of current selects the newest other; deleting the last one creates a fresh default.
  - autosave persists under the current id and updates `projects[0].name` after `setName`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — the store receives `storage` via `startAutosave` today; project actions need storage too, so `createPlannerStore(initial, lang, units, projectId, storage: StorageLike | null = null)`. Actions call `projects.ts` directly and `clearSnapshot()` (import from `ui/snapshot` is a DOM module — instead expose a `onProjectChange` callback set by the UI; simplest: `TopBar` calls `clearSnapshot()` before invoking the action, as it does today).
  - `ProjectsMenu.tsx`: button "Projects ▾" → absolute `.menu` (reuse `.menu` styles) listing `projects` (name + relative time), current highlighted; footer buttons New (blank), New from template ▸ (Task 9 fills; render nothing until then), Duplicate, Delete (confirm). Closes on outside click / Esc.
  - Remove the standalone New button from `TopBar`.

- [ ] **Step 4: Verify** — suite, typecheck, build; in dev: create two projects, reload, both listed, current restored; legacy key from an old build migrates (set `localStorage['wardrobe-planner:project']` manually to test).

---

### Task 9: Templates, first-run hint, `?template=`

**Files:**
- Create: `src/model/templates.ts`, `src/model/templates.test.ts`, `src/ui/HintBar.tsx`
- Modify: `src/store/store.ts` (`bootstrap` uses `lShape` on first run; `?template` handling in a new `src/store/startup.ts`), `src/ui/ProjectsMenu.tsx` (template submenu), `src/App.tsx` (HintBar), `src/i18n` (`template.oneWall`, `template.lShape`, `template.uShape`, `ui.hint.step1..3`, `ui.hint.dismiss`), `src/styles.css` (`.hintbar`)

**Interfaces:**
- Produces: `export type TemplateKey = 'oneWall' | 'lShape' | 'uShape'; export const TEMPLATE_KEYS: TemplateKey[]; export function makeTemplate(key: TemplateKey, name: string): Project;` and `export const isTemplateKey`.
- `src/store/startup.ts`: `export function consumeTemplateParam(search: string): TemplateKey | null` (pure) and `export function applyStartupUrl(store, loc: { search: string; hash: string }, replace: (url: string) => void): Promise<void>` (Task 10 extends with the hash).

- [ ] **Step 1: Tests**
  - each template: `validate(makeTemplate(key, 'x')).length === 0`; room and walls as in the spec table; at least one `shoes`-free until Task 13 — write the templates without shoes now and **Task 13 adds a shoe rack to each** (its test then asserts one).
  - `consumeTemplateParam('?template=uShape') === 'uShape'`, unknown → `null`.
  - `bootstrap` first run: project equals `makeTemplate('lShape', ...)` shape (room 2500×2000).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** templates with `makePreset`/`emptyWall`:

```ts
export function makeTemplate(key: TemplateKey, name: string): Project {
  const base = defaultProject();
  const W = (depth: number, enabled: boolean, cols: Column[] = []) => { const w = emptyWall(depth, enabled); w.segments[0] = cols; return w; };
  switch (key) {
    case 'oneWall': return { ...base, name, room: { width: 3000, depth: 1800, height: 2500 },
      door: { wall: 'front', offset: 1100, width: 800, height: 2100, swing: 'in', hinge: 'left' },
      wardrobe: { ...base.wardrobe, walls: { back: W(600, true, [makePreset('drawersHanging', 600), makePreset('doubleHanging', 600), makePreset('hanging', 600), makePreset('shelves', 600), makePreset('drawersShelves', 600)]), left: W(600, false), right: W(600, false), front: W(400, false) } } };
    case 'lShape': return { ...base, name, room: { width: 2500, depth: 2000, height: 2500 },
      door: { wall: 'front', offset: 300, width: 800, height: 2100, swing: 'in', hinge: 'left' },
      wardrobe: { ...base.wardrobe, walls: { back: W(600, true, [makePreset('doubleHanging', 600), makePreset('drawersHanging', 600), makePreset('shelves', 600), makePreset('hanging', 600)]), left: W(600, true, [makePreset('drawersShelves', 700), makePreset('doubleHanging', 700)]), right: W(600, false), front: W(400, false) } } };
    case 'uShape': return { ...base, name, room: { width: 3000, depth: 2500, height: 2500 },
      door: { wall: 'front', offset: 900, width: 900, height: 2100, swing: 'in', hinge: 'left' },
      wardrobe: { ...base.wardrobe, walls: { back: W(600, true, [makePreset('drawersHanging', 600), makePreset('doubleHanging', 600), makePreset('shelves', 600), makePreset('drawersShelves', 600), makePreset('hanging', 600)]), left: W(600, true, [makePreset('gap', 300), makePreset('doubleHanging', 700), makePreset('shelves', 700)]), right: W(600, true, [makePreset('gap', 300), makePreset('hanging', 700), makePreset('drawersShelves', 700)]), front: W(400, false) } } };
  }
}
```

Adjust widths until `validate` is empty (side walls lose 600 to each enabled back-wall corner: left/right usable = 2000 − 600 = 1400 for lShape's left; uShape sides = 2500 − 600 = 1900 minus the door… the door is on the front wall so sides are whole). The test is the arbiter.

  - `bootstrap`: first run → `createProject(makeTemplate('lShape', t(lang,'template.lShape')))` and `firstRun: true`.
  - `HintBar`: renders when `firstRun && !storage[HINT_KEY]`; three numbered steps + dismiss; dismiss writes `HINT_KEY = '1'`. Also hidden once the user has inserted a column (`past.length > 0`) — cheap and non-annoying.
  - `?template=`: in `main.tsx` before render, `applyStartupUrl(useStore, location, (u) => history.replaceState(null, '', u))`: if a template key is present, `createProject(makeTemplate(key, name))` and strip the query.
  - ProjectsMenu: "New from template" lists the three names.

- [ ] **Step 4: Verify** — suite, typecheck, build; dev: clear localStorage → L-shape loads + hint; `/app/?template=uShape` creates the U-shape.

---

### Task 10: Share links

**Files:**
- Create: `src/store/share.ts`, `src/store/share.test.ts`
- Modify: `src/store/startup.ts` (`#p=`/`#j=`), `src/ui/TopBar.tsx` (Share button), `src/i18n` (`ui.share`, `toast.linkCopied`, `toast.shareInvalid`, `toast.sharedImported`, `ui.sharedSuffix`)

**Interfaces:**
- Produces: `encodeShare(p: Project): Promise<string>` → `'p=...'` or `'j=...'`; `decodeShare(hash: string): Promise<ParseResult>` (accepts with or without leading `#`); `shareUrl(loc: { origin: string; pathname: string }, encoded: string): string`.

- [ ] **Step 1: Tests**
  - round-trip `defaultProject()` through `encodeShare`/`decodeShare` → `ok` and deep-equal.
  - `encodeShare` output starts with `p=` in Node (CompressionStream exists) and contains only `[A-Za-z0-9_-=]`.
  - `decodeShare('#j=' + base64url(JSON))` works.
  - `decodeShare('#p=@@@')` → `ok: false`; `decodeShare('')` → `ok: false`.
  - compressed length for the default project < 1500 chars.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — base64url via `btoa`/`atob` on a binary string (both exist in Node ≥ 16 and browsers); deflate via `new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))` then `new Response(stream).arrayBuffer()`; decode symmetric with `DecompressionStream`. Reuse `parseProjectShape` on the JSON text. `startup.ts`: if `hash` decodes → `createProject({ ...project, name: project.name + t('ui.sharedSuffix') })`, toast, `replace(pathname)`; if it fails → toast `toast.shareInvalid`, `replace(pathname)`.
  - TopBar: Share button (disabled when `errors.length > 0`), `await navigator.clipboard.writeText(url)`, toast `toast.linkCopied`; on clipboard failure show the URL in `window.prompt` as fallback.

- [ ] **Step 4: Verify** — suite, typecheck, build; dev: Share → open the copied URL in a private window → project appears named "… (shared)".

---

### Task 11: Mobile layout

**Files:**
- Modify: `src/styles.css`, `src/ui/DesignTab.tsx` (settings panel in `<details>` under the breakpoint via CSS only — keep DOM: wrap `RoomForm` in `<details className="settings" open>`; CSS hides the summary on desktop), `src/ui/SpawnMenu.tsx` (class `sheet` under breakpoint is CSS-only: `.menu` becomes fixed bottom sheet), `src/ui/TopBar.tsx` (group secondary actions in `<div className="actions">`; below 600px a "⋯" button toggles it — small `useState`), `src/ui/Inspector.tsx` (`scrollIntoView({ block: 'nearest' })` on selection change when `matchMedia('(max-width: 820px)').matches`), `src/ui/CutListTable.tsx` (wrap in `<div className="tablewrap">`)
- Test: none automatable in node; manual + screenshot in Task 16.

- [ ] **Step 1: CSS** (append to `styles.css`):

```css
@media (max-width: 820px) {
  .app { grid-template-rows: auto 1fr; }
  .topbar { flex-wrap: wrap; padding: 6px 8px; row-gap: 6px; }
  .topbar input.name { width: 100%; order: -1; }
  .design { grid-template-columns: 1fr; grid-template-rows: auto auto minmax(50vh, auto) auto; overflow: auto; height: auto; }
  .panel { border-right: 0; border-bottom: 1px solid #ddd; }
  .plan { position: static; }
  .plan svg { max-height: 40vh; }
  details.settings > summary { display: block; padding: 8px 10px; font-weight: 600; cursor: pointer; }
  .elevation { min-height: 50vh; }
  .inspector { border-left: 0; border-top: 1px solid #ddd; }
  .menu { position: fixed; left: 0; right: 0; bottom: 0; top: auto; border-radius: 12px 12px 0 0; max-height: 60vh; overflow: auto; padding-bottom: env(safe-area-inset-bottom); }
  .menu button, .topbar button, .tabs button { min-height: 40px; }
  input, select { font-size: 16px; }
  .plus circle { r: 18; }
  .viewport canvas { touch-action: none; }
  .tablewrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
@media (min-width: 821px) { details.settings > summary { display: none; } details.settings:not([open]) > *:not(summary) { display: block; } }
@media (max-width: 600px) { .topbar .actions { display: none; width: 100%; flex-wrap: wrap; gap: 6px; } .topbar .actions.open { display: flex; } .topbar .more { display: inline-block; } }
@media (min-width: 601px) { .topbar .more { display: none; } }
```

Note `details:not([open]) > *` on desktop: the panel must always show, so on desktop force the content visible regardless of the `open` attribute (the rule above) and keep `open` set by default in JSX.

- [ ] **Step 2: JSX changes** as listed in Files. The `+` circle radius is set inline in `ElevationEditor`; make it a CSS-driven `r` only if the SVG uses `r` attribute — otherwise pass a larger radius when `matchMedia` matches (store `isNarrow` in a tiny `useMediaQuery(query)` hook in `src/ui/useMediaQuery.ts`).

- [ ] **Step 3: Verify** — suite, typecheck, build; in dev with DevTools at 390×844: all three tabs usable, spawn menu appears as a bottom sheet, no horizontal scroll on the page body, inputs don't zoom on iOS (font-size 16).

---

### Task 12: Shoe shelves — model, validation, layout

**Files:**
- Modify: `src/model/types.ts` (`ZONE_TYPES` + `'shoes'`), `src/geometry/layout.ts` (constants, `ZoneLayout.shoeShelves`, layout branch), `src/model/validate.ts` (`error.shoePitch`), `src/store/persist.ts` (`isZoneShape` accepts `'shoes'`), `src/i18n` (`zone.shoes`, `error.shoePitch`)
- Test: `src/geometry/layout.test.ts`, `src/model/validate.test.ts`, `src/store/persist.test.ts`

**Interfaces:**
- Produces: `SHOE_TILT_DEG = 15`, `SHOE_LIP = 40`, `MIN_SHOE_PITCH = 150` (exported from `layout.ts`); `ZoneLayout.shoeShelves: { yBack: number; yFront: number; depth: number }[]` (absolute Y of the board's **top surface** at the back and front edges; `depth` = board depth = `interiorDepth − SHELF_SETBACK`).

- [ ] **Step 1: Tests**

```ts
it('lays out tilted shoe shelves centred in their pitch', () => {
  const p = defaultProject();
  p.wardrobe.walls.back.segments[0] = [makeUnit(600, [makeZone('shoes', 900, 5)])];
  const L = layoutWall(p, 'back')[0] as UnitLayout;
  const z = L.zones[0];
  expect(z.shoeShelves).toHaveLength(5);
  const pitch = z.height / 5;
  const depth = L.interiorDepth - SHELF_SETBACK;
  const drop = depth * Math.sin((SHOE_TILT_DEG * Math.PI) / 180);
  expect(z.shoeShelves[0].depth).toBeCloseTo(depth);
  expect(z.shoeShelves[0].yBack - z.shoeShelves[0].yFront).toBeCloseTo(drop);
  expect((z.shoeShelves[0].yBack + z.shoeShelves[0].yFront) / 2).toBeCloseTo(z.yBot + pitch / 2);
  expect(z.shoeShelves[4].yBack).toBeLessThan(z.yTop);
});
```

validate: `makeZone('shoes', 500, 5)` → error path `...zones.0` key `error.shoePitch`; `('shoes', 900, 5)` → no error; `count < 1` → `error.shelfCount` reused. persist: a file with a `shoes` zone parses.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — in `layoutUnit`: `else if (zone.type === 'shoes' && zone.count >= 1) { const depth = interiorDepth - SHELF_SETBACK; const drop = depth * Math.sin(rad(SHOE_TILT_DEG)); const pitch = height / zone.count; for (let k = 0; k < zone.count; k++) { const mid = yBot + pitch * k + pitch / 2; zl.shoeShelves.push({ yBack: mid + drop / 2, yFront: mid - drop / 2, depth }); } }`. `ZoneLayout` initialiser gets `shoeShelves: []`. Validation: `if (z.type === 'shoes' && zh[zi] / z.count < MIN_SHOE_PITCH) push(zp, 'error.shoePitch', { ...U, n: MIN_SHOE_PITCH })`. `ZONE_TYPES = ['open', 'shelves', 'drawers', 'hanging', 'shoes']`. EN `error.shoePitch`: `'{unit}: shoe shelves need at least {n} mm each'` (RU parity).

- [ ] **Step 4: Verify** — suite, typecheck.

---

### Task 13: Shoe shelves — parts, cut list, drawing, UI, preset, templates

**Files:**
- Modify: `src/geometry/parts.ts` (`PartKind`/`PART_NAME_KEYS` + `'lip'`; shelf + lip parts), `src/cutlist/cutlist.ts` (`KIND_ORDER` + `'lip'` after `'shelf'`), `src/drawing/views.ts` (elevation bands + label), `src/model/presets.ts` (`'shoes'` preset), `src/model/templates.ts` (one shoe rack per template), `src/ui/Inspector.tsx` (zone type select lists `shoes`; `count` label "shelves" for shoes), `src/ui/SpawnMenu.tsx` (preset appears automatically if it iterates `PRESET_KEYS`), `src/i18n` (`preset.shoes`, `part.lip`, `note.tilted`, `drawing.shoes`, `ui.shoeShelves`)
- Test: `src/geometry/parts.test.ts`, `src/cutlist/cutlist.test.ts`, `src/drawing/views.test.ts`, `src/model/templates.test.ts`, `src/model/model.test.ts` (preset)

- [ ] **Step 1: Tests**
  - parts: a 600-wide unit with `shoes` 900/5 yields 5 `shelf` parts with `transform.rotation.x` ≈ `−SHOE_TILT_DEG` in radians (on the back wall, world = local) and note `note.tilted`, and 5 `lip` parts `interiorWidth × SHOE_LIP` thickness `t` whose `partBounds().min.y` ≥ the shelf's front edge y (lip sits on the front edge). Bounds of every shelf stay inside the carcass box.
  - cutlist: rows include `lip` qty 5 grouped, ordered after `shelf`.
  - views: elevation of that unit contains 5 `poly` prims with fill `panel` of height ≈ `drop` (within the zone) and a text prim `Shoes ×5` (via `t('drawing.shoes', { n })`).
  - presets: `makePreset('shoes', 600)` → zones `[shoes 900 ×5, shelves auto ×3]`.
  - templates: each template has ≥ 1 `shoes` zone and still validates clean.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
  - parts: per `shoeShelves[k]`: board `rect(iw, depth)` thickness `t`, position `v3(s0 + t, sh.yBack, w.backThickness)` (back edge, top surface), rotation `v3(-(SHOE_TILT_DEG * Math.PI) / 180 + FLAT_ROT.x, 0, 0)` — check `FLAT_ROT` (a flat shelf is `rect(w, depth)` in XY rotated by `rx = −π/2` so local y runs into the room; tilt subtracts a further 15° so the front edge drops). Verify with `partBounds` in the test rather than by reasoning: front-edge y must equal `sh.yFront ± t`. Lip: `rect(iw, SHOE_LIP)` thickness `t`, standing on the front edge: position at the shelf's front-top edge, rotation `v3(-(SHOE_TILT_DEG) rad, 0, 0)` (perpendicular to the board = same tilt as the board's normal plane) — again pin with bounds in the test. Notes: shelf gets `[msg('note.tilted', { deg: SHOE_TILT_DEG })]`.
  - cutlist: `partDims` for a rect outline is unchanged; `lip` rows group naturally.
  - views (elevation): for each shoe shelf, `rectPrim(x0, sh.yFront, iw, sh.yBack - sh.yFront, 'thin', 'panel')` and the lip `rectPrim(x0, sh.yFront, iw, SHOE_LIP, 'thick', 'none')`; zone label via the existing `zoneLabelY` logic (treat shoe bands like shelf slabs for label placement); label text `t(lang, 'drawing.shoes', { n: zone.count })`.
  - preset: `case 'shoes': return makeUnit(width, [Z('shoes', 900, 5), Z('shelves', null, 3)]);` add to `PRESET_KEYS` before `'open'`.
  - Inspector: the zone-type `<select>` iterates `ZONE_TYPES` — confirm and add the count label branch: `zone.type === 'shoes' ? t('ui.shoeShelves') : ...`.
  - templates: replace one `shelves` preset per template with `makePreset('shoes', …)`; re-run the validate test.

- [ ] **Step 4: Verify** — suite, typecheck, build; dev: insert "Shoe rack", check elevation, 3D tilt, cut list rows (shelf ×5 tilted, lip ×5).

---

### Task 14: Off-screen PDF snapshot

**Files:**
- Modify: `src/ui/snapshot.ts` (`renderSnapshot`, async `takeSnapshot`), `src/ui/three/Viewport3D.tsx` (`snapshotOnly` prop, `onFirstFrame` callback), `src/ui/TopBar.tsx` (await), `src/App.tsx`/`README` no change
- Test: none in node (WebGL); manual.

- [ ] **Step 1: `Viewport3D` props** — `{ project?: Project; snapshotOnly?: boolean; onFirstFrame?: () => void }`. When `project` is given, render it instead of the store's `lastValid`; `snapshotOnly` hides the `.controls` overlay and skips `OrbitControls`; `onFirstFrame` fires from `useFrame` once (ref flag) after the parts mesh mounted.

- [ ] **Step 2: `renderSnapshot`**

```ts
export async function renderSnapshot(project: Project, timeoutMs = 5000): Promise<string | null> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const first = new Promise<void>((resolve) => {
      root.render(createElement(Viewport3D, { project, snapshotOnly: true, onFirstFrame: resolve }));
    });
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), timeoutMs));
    if ((await Promise.race([first, timeout])) === 'timeout') return null;
    await new Promise(requestAnimationFrame); // one more frame so the first draw is on the buffer
    const canvas = host.querySelector('canvas');
    return canvas ? encode(canvas) : null;
  } catch { return null; } finally {
    root.unmount();
    host.remove();
  }
}
export async function takeSnapshot(project: Project): Promise<string | null> {
  return cacheSnapshot() ?? renderSnapshot(project);
}
```

Beware the circular import (`snapshot.ts` ↔ `Viewport3D.tsx`): `Viewport3D` imports `setSnapshotSource`/`cacheSnapshot`; move the off-screen renderer into a new `src/ui/three/offscreenSnapshot.ts` that imports both, and have `TopBar` call `takeSnapshot` from there.

- [ ] **Step 3: TopBar** — `const snapshotPng = await takeSnapshot(lastValid);` before `exportPdfBlob`. Keep the busy state.

- [ ] **Step 4: Verify** — suite, typecheck, build; dev: fresh load, never open 3D, Export PDF → snapshot page present. Then open 3D, orbit, export → the orbited view is used (cache wins).

---

### Task 15: Label collisions

**Files:**
- Modify: `src/drawing/views.ts`
- Test: `src/drawing/views.test.ts`

- [ ] **Step 1: Audit** — write a scratch script (`scratchpad/labels.ts`, not committed) that for each template × lang × units renders `planView` and every `wallElevation`, expands prims, computes text bounding boxes (reuse `primPoints` logic by exporting a `textBox(prim, textSize)` helper from `ir.ts`) and prints overlapping pairs. Run with `pnpm vitest run` on a throwaway test or `npx tsx`.

- [ ] **Step 2: Fix** the reported overlaps in `views.ts` — expected classes: rail-height label vs shelf-bay dimension chain (offset the rail label to the other side of the rod or shift the dim chain one step further out), `⟂` across-rail label overflowing a narrow unit (drop the text when `unit width < text width`, keep the dashed line), plan unit tags vs wall names (push tags inward by one text size). For each fix, add a test asserting the two specific prims no longer intersect using `textBox`.

- [ ] **Step 3: Verify** — suite, typecheck; re-run the audit script: zero overlaps for the three templates.

---

### Task 16: Screenshots script, og image, README

**Files:**
- Create: `scripts/screenshots.mjs`
- Modify: `README.md`, `public/og.png`, `public/screenshots/*.png`, `package.json` (`"screenshots": "node scripts/screenshots.mjs"`)

- [ ] **Step 1: Script** — requires `dist/` (`pnpm build` first). Uses `import('playwright')` from the global npx cache: instruct `npx playwright@1 install chromium` if missing and exit 1 with that message. Serves `dist/` with a tiny `http` static server on a free port (must map `/x/` → `/x/index.html`). Steps: goto `/app/?template=uShape`, wait for `.design svg`, dismiss the hint bar, screenshot `public/screenshots/design.png` at 1440×900; click the 3D tab, wait 1500 ms, `3d.png`; cut list tab → `cutlist.png`; new context 390×844 (`isMobile: true`) → design tab → `mobile.png`. `og.png`: load `design.png` in a page as `<img>` with an overlaid title block ("Walk-in Planner — free walk-in wardrobe planner"), viewport 1200×630, screenshot.

- [ ] **Step 2: Run it**, look at the PNGs (Read them), fix anything visibly broken in the site/app, re-run.

- [ ] **Step 3: README** — rewrite per spec §10: title "Walk-in Planner", live link, three images (`public/screenshots/design.png`, `3d.png`, `mobile.png` via relative paths), pitch, "What it does / What it does not", then Use (update for templates, projects menu, share, units, shoe rack), Develop (`/app/` dev URL, `pnpm screenshots`), Layout (add `site/`, `app/`, `guides/`, new modules), Deploy (custom domain, DNS records, `public/CNAME`).

- [ ] **Step 4: Verify** — `pnpm test && pnpm typecheck && pnpm build`; `pnpm preview` and click through `/`, `/ru/`, a guide, `/app/`.

---

## Self-review notes

- Spec §2–3 → Tasks 1–3, 16 (screenshots). §4 → 4–6. §5.1 → 7–8. §5.2–5.3 → 9. §5.4 → 10. §6 → 11. §7 → 12–13. §8 → 14. §9 → 15. §10 → 16. §11 error handling: quota → Task 7/8 (`saveProject` false → toast `ui.storageFull` in autosave), share invalid → 10, snapshot → 14, units parse → 5.
- Names used across tasks: `Units`, `formatLen`, `parseLen`, `detectUnits` (4/5/6); `ProjectMeta`, `saveProject`, `migrateLegacy`, `newProjectId` (7/8/9); `TemplateKey`, `makeTemplate` (9/13/16); `encodeShare`/`decodeShare` (10); `shoeShelves`, `SHOE_TILT_DEG`, `SHOE_LIP`, `MIN_SHOE_PITCH` (12/13); `takeSnapshot(project)` (14).
- Task 3 and 4–15 are independent; 5→6, 7→8→9→10, 12→13 are ordered; 8 and 11 both edit `TopBar.tsx` (do 11 after 10).
