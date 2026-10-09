# Handoff: Walk-in Planner redesign (landing + app)

## Overview
A visual and UX redesign of walkinplanner.com (repo `bynov/wardrobe-planner`) covering:
- the **landing page** (`index.html`, `site/site.css`; mirror changes in `ru/index.html`)
- the **app** (`src/ui/*`, `src/styles.css`): app shell, Room / Design / 3D / Cut list modes, inspector, mobile layout
- **light and dark themes** for both. The default follows the OS (`prefers-color-scheme`), and the user can override it with an Auto → Light → Dark toggle that is persisted.

The chosen app layout is **option 2a** in `designs/Overview.dc.html`. It is the "guided" layout: wall tabs, large preset cards and a first-run hint bar, with a **mode switcher** (Room · Design · 3D · Cut list) instead of a stepper. Modes are not a flow. The user can switch between them at any time, in any order.

## About the design files
The files in `designs/` are **design references built in HTML**. They are prototypes that show the intended look and behaviour, not production code. Recreate them in the existing codebase: React + TypeScript + Vite, the zustand store in `src/store/store.ts`, and i18n keys in `src/i18n/en.ts` / `ru.ts`. Keep all existing model, geometry, drawing, PDF and persistence logic. This is a UI layer change.

To view them, open `designs/Overview.dc.html` in a browser served from the `designs/` folder (it needs `support.js` beside it). Every option is interactive.

- `Overview.dc.html`: canvas listing every screen. **2a/2b = the chosen design tab**, 1a/1b landing, 1g Room, 1h 3D, 1i Cut list, 1j/1k mobile. 1c/1d/1e are the rejected layout alternatives, kept for reference only.
- `App.dc.html`: the app. Prop `layout="modes"` is the chosen one; `screen` = `setup | design | 3d | cutlist`.
- `Inspector.dc.html`, `Elevation.dc.html`, `Plan.dc.html`: right panel, wall elevation and plan view.
- `Mobile.dc.html`: phone layout (390 × 844).
- `Landing.dc.html`: landing page.

## Fidelity
**High fidelity** for colours, typography, spacing, radii and component structure. Exceptions:
- The **3D viewport** is a placeholder. Keep the existing three.js `Viewport3D` and restyle only the chrome around it.
- **Elevation and plan drawings** show the intended styling (token colours, mono labels, selection treatment). Keep the existing generators in `src/drawing/views.ts` / `ElevationEditor.tsx` / `PlanEditor.tsx` and map their colours to the tokens below. Don't replace them with the prototype's simplified geometry.
- Cut list numbers in the prototype are approximate. Keep `src/cutlist/cutlist.ts`.

## Design tokens
Implement as CSS custom properties on `:root`, overridden for dark via `@media (prefers-color-scheme: dark)` and by a `data-theme="light|dark"` attribute on `<html>` (the user override wins over the media query).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `oklch(0.972 0.004 80)` | `oklch(0.17 0.005 70)` | app/page background, canvas |
| `--surface` | `oklch(0.995 0.002 80)` | `oklch(0.205 0.006 70)` | bars, panels, cards |
| `--surface2` | `oklch(0.955 0.005 80)` | `oklch(0.24 0.007 70)` | segmented track, hover |
| `--sunk` | `oklch(0.935 0.006 80)` | `oklch(0.15 0.005 70)` | plinth fill |
| `--line` | `oklch(0.905 0.006 80)` | `oklch(0.29 0.008 70)` | hairlines, card borders |
| `--line2` | `oklch(0.84 0.008 80)` | `oklch(0.37 0.01 70)` | input borders, off switches |
| `--ink` | `oklch(0.23 0.01 70)` | `oklch(0.95 0.005 80)` | primary text |
| `--ink2` | `oklch(0.43 0.01 70)` | `oklch(0.79 0.008 80)` | secondary text |
| `--ink3` | `oklch(0.56 0.01 70)` | `oklch(0.64 0.008 80)` | tertiary / labels |
| `--accent` | `oklch(0.55 0.13 48)` | `oklch(0.76 0.12 62)` | primary button, selection, active wall |
| `--accent-ink` | `oklch(0.99 0.005 60)` | `oklch(0.2 0.03 55)` | text on accent |
| `--accent-soft` | `oklch(0.94 0.035 60)` | `oklch(0.31 0.05 55)` | active tab/wall bg, hint bar |
| `--wood` | `oklch(0.94 0.018 78)` | `oklch(0.265 0.012 70)` | unit interior fill |
| `--wood2` | `oklch(0.895 0.025 75)` | `oklch(0.315 0.014 70)` | carcass, boards, drawer fronts |
| `--draw` | `oklch(0.36 0.012 70)` | `oklch(0.8 0.01 80)` | drawing strokes |
| `--ok` | `oklch(0.52 0.11 150)` | `oklch(0.76 0.11 150)` | status dot |
| `--danger` | `oklch(0.53 0.17 27)` | `oklch(0.72 0.15 27)` | errors, Remove |
| `--shadow` | `0 1px 2px oklch(0.3 0.02 70/.06), 0 10px 30px oklch(0.3 0.02 70/.08)` | `0 1px 2px #0006, 0 10px 30px #0005` | floating menus, tray |

Update `<meta name="theme-color">` to match `--surface` in each theme.

**Typography**
- UI: **Schibsted Grotesk** 400/500/600/700 (Google Fonts). Body 14px app / 15–17px landing.
- Numbers/dimensions: **IBM Plex Mono** 400/500. Use it for every measurement, input value, free-length pill, cut-list number and drawing label.
- App scale: 11px uppercase labels (600, letter-spacing .07em, `--ink3`) · 12px meta · 13px controls · 14px body · 16px wall title (600, -0.01em) · 19px inspector title (600).
- Landing scale: H1 68/1.02, 600, -0.035em · H2 44/1.05, 600, -0.03em · lead 19/1.55 `--ink2` · card title 19/600 · body 14–15/1.55.

**Radii**: 6–8px controls · 10px zone cards, menus · 12–14px cards, floating panels · 16px landing cards · 24px landing feature blocks. Pills 999px.
**Spacing**: 4px base; common values 6, 8, 10, 12, 14, 16, 18, 22, 28. Landing sections are separated by 128px.
**Canvas background**: `radial-gradient(var(--line) 1px, transparent 1.2px) 0 0 / 20px 20px` on `--bg`.

## Screens

### App shell: top bar (all modes)
56px tall, `--surface`, bottom border `--line`, padding 0 14px 0 16px, gap 14px.
- **Left:** a 24px logo mark (`--ink` rounded square holding an accent U outline), then the project button showing the project name (14/600) with ▼ and the subline "Saved in this browser" (11px `--ink3`). Clicking it opens the **Projects** menu (replaces `ProjectsMenu`): recent projects with relative time, and "+ New project" (goes to Room mode).
- **Centre: mode switcher**, a segmented control. Track `--surface2`, 3px padding, radius 10. Items are 30px tall, padding 0 16px, 13/500. The active item gets a `--surface` bg and a subtle shadow. Items: **Room · Design · 3D · Cut list**. This replaces the current `TABS` in `TopBar.tsx` and adds `'setup'` (Room) to the `Tab` type.
- **Right:** Undo ↶ / Redo ↷ as 32px icon buttons (disabled = `--line2`) · divider · units segmented `mm | in` (mono 12px) · theme button (half-filled circle + "Auto/Light/Dark") · divider · **Share link** (secondary) · **Export PDF** (primary, `--accent`, 600) · **⋯** overflow.
- **Overflow menu (⋯):** 220px, radius 12, `--shadow`. Items: Import JSON, Export JSON, Language (EN · RU), Keyboard shortcuts, Source on GitHub. Language and JSON actions move here from the bar.
- When there are validation errors, Share and Export PDF render at 45% opacity with the title "Fix validation errors first" (same rule as today).

### Hint bar (first run, Design mode)
Full width, `--accent-soft`, padding 10px 18px. It shows three numbered steps (20px accent circles, mono numbers) with the existing `ui.hint.step1–3` copy, and a "Got it" button (`--ink` bg) on the right. Dismissal is persisted, as `HintBar.tsx` does today.

### Design mode (2a): replaces `DesignTab.tsx`
1. **Wall tab row**: `--surface`, padding 12px 18px, gap 10px, bottom border.
   - An 84 × 64 plan thumbnail (clickable walls) comes first.
   - Then one tab per wall (Back, Left, Right, Front): flex 1, max 220px, radius 12, 1px border. Each shows the name (14/600) and a mono status line: `5 units · full`, `2 units · 600 mm free`, `over 50 mm` (`--danger`) or `off`.
   - The active tab has an `--accent` border on an `--accent-soft` bg.
2. **Body**: grid `minmax(0,1fr) 360px`.
   - **Canvas**: dotted background with the elevation inset 24px 32px. Spawn "+" markers are 54-unit circles with an accent stroke above the ceiling line at each column boundary. Clicking one sets the insert position. Unit tags (B1…) sit above the carcasses; the selected one is accent.
   - The **selected unit** gets a 14-unit accent outline around the whole column. The **selected zone** gets an accent stroke with a 16% accent tint.
   - When the wall is off, the canvas shows an empty state, "No wardrobe on this wall", with a "Use this wall" button.
   - **Preset tray** (below the canvas): `--surface`, top border, padding 12px 18px 14px. Its header reads "Add a unit" plus "after B4" or "at slot N", with the free-length readout on the right. Below is an 8-column grid of preset cards: radius 12, `--bg`, hover border `--accent`. Each card holds a 28 × 46 mini column diagram above the label.
   - Presets: Long hanging, Double hanging, Shelves, Drawers + hanging, Drawers + shelves, Shoe rack, Open, Gap (matches `model/presets.ts`).
   - Mini diagrams are CSS gradients: shelves = repeating horizontal lines, drawers = denser lines on `--wood2`, hanging = a short bar near the top, shoes = slanted lines, gap = diagonal hatching.
   - **Right panel**: `--bg`, padding 18px. An error banner sits on top when needed, then the Inspector.
3. Room settings are no longer in this mode. They live in Room mode.

### Inspector (replaces `Inspector.tsx`)
Vertical stack with an 18px gap.
- **Title**: "Unit B4" (19/600) + "on Back wall" (13px `--ink3`). Below it, the mono interior readout "Interior 564 × 2214 × 596 mm".
- **Width**: a stepper (− value +): 34px tall, mono 14/500, ±50 mm per click. Typing into the value should still work in production.
- **Actions**: a 4-column grid of 32px buttons: ← Move, Move →, Duplicate, Remove (`--danger` text).
- **Zones** header reads "Zones" plus "top to bottom", with an accent "+ Add zone" link on the right.
- **Zone cards** (top → bottom): radius 10, padding 12. Collapsed, a card shows a 22 × 28 type glyph, the name, the mono height and an AUTO badge when auto.
  - Only the **selected zone expands**, showing:
    - type chips (Open / Shelves / Drawers / Hanging / Shoes; active chip = `--ink` bg, `--bg` text)
    - an "Auto height" switch
    - a count stepper labelled Compartments / Drawers / Shelves for counted types
    - a hanging-rail sub-block for hanging zones (keep the `RailFields` logic: direction, auto, offset from top/bottom, resulting height)
    - a footer with ↑ Up, ↓ Down and "Remove zone"
  - The selected card has an `--accent` border on a `--surface` bg.
- **Gap columns** show "Gap L1", the width stepper, the actions and a card with the switch "Wall-mounted hanging rail" plus explanatory text. With the rail on, show the direction and height fields from `GapRailFields`.
- **Nothing selected**: a dashed column icon, "Nothing selected" and "Click a unit in the elevation to edit it, or a + to insert a new one."
- **Errors**: one banner at the top of the panel. Background is `--danger` at 10% on `--surface`, with a 35% danger border. The heading reads "N issues · PDF and share are off until they're fixed", followed by the error lines (keep the click-to-select behaviour and the ×N dedupe from `ErrorList`).

### Room mode (1g): new, uses `RoomForm` logic
Grid `300px | 1fr | 380px`.
- **Left**: "New walk-in" (20/600) and its subline, then template cards for U-shape, L-shape, One wall and Empty room (`model/templates.ts`). Each card has a 76 × 62 plan thumbnail, a name and a description. The selected card has an accent border on `--accent-soft`. The footer link reads "Have a file? Import JSON".
- **Centre**: a large live plan with dimensions on the dotted canvas, captioned "Plan view · updates as you type".
- **Right**:
  - Room: W / D / H inputs, 42px tall, mono 16px.
  - Door: an "On wall" segmented control (Back/Right/Front/Left); Offset / Width / Height inputs; "Opens" segmented (Inwards/Outwards); "Hinge, from inside" segmented (Left/Right).
  - A "Carcass defaults" summary card with an Edit link that expands the ceiling gap, plinth, panel, back and door margin fields.
  - The sticky footer holds "Start designing →" (44px primary, switches to Design) and "Saved in this browser. Nothing is uploaded."
- When editing an existing project, Room mode edits that project in place. Template picking applies only to a new project, so confirm before replacing.

### 3D mode (1h)
- Keep the existing viewport, full bleed.
- Floating chrome (radius 10–12, `--surface`, `--shadow`):
  - top-left view presets: Iso · Back · Left · Right · Top (new; optional)
  - top-right toggle list: Dimensions, Room, Explode (existing controls as switches)
  - bottom-left plan mini-map
- The stale banner ("Showing the last valid design · N validation errors") is a full-width strip at the top in danger tint.
- The renderer's background and material colours should read the theme tokens.

### Cut list mode (1i)
- Centred, max-width 1100, padding 28. The title "Cut list" (22/600) has the summary "N parts · M sizes · tags match the drawings" beneath it. On the right: "Drawer boxes, runners and hardware are not included."
- The table is a card with radius 12. Columns: Part, Location, Qty, Length, Width, Thk, Material. Headers are 11px uppercase `--ink3`, numbers mono, rows separated by `--line`.

### Mobile (1j / 1k), below 600px
- **Header**: logo, project name + "Saved in this browser", Undo and theme buttons (44px hit targets).
- **Wall chips**: horizontally scrolling, 48px tall, name + mono status. Active chip has an accent border on accent-soft.
- **Elevation**: fills the remaining height. A 64 × 56 plan mini-map floats top-right and switches walls.
- **Bottom sheet** above the nav:
  - Collapsed (150px) shows "Unit B4", "600 mm wide · Back wall", an "Edit" button and zone summary chips.
  - Expanded (470px) shows the full Inspector.
  - Grabber 38 × 5. Tapping the grabber or Edit toggles the sheet; animate height with .25s ease.
  - Replace the current behaviour where the inspector sits below the elevation and the page auto-scrolls.
- **Bottom nav** (84px incl. home indicator): Design · 3D · Cut list · Export. Active = accent.
- Room settings: reach them from the project menu or a "Room" item. Don't keep them in the scroll flow.

### Landing (1a / 1b)
Max-width 1200, side padding 32. Sections in order:
1. **Sticky nav**, 64px, translucent `--bg` with a 10px blur: logo + "Walk-in Planner" · How it works, Guides, FAQ, GitHub · RU, theme toggle, "Open the planner" (`--ink` button).
2. **Hero**, centred:
   - pill "Free and open source · runs in your browser" (green dot)
   - H1 "Plan a walk-in wardrobe you can actually build."
   - lead paragraph
   - CTAs: "Open the planner →" (accent, 50px) and "Start from a template" (secondary)
   - meta line "No account · Saves in your browser · mm or inches"
3. **Live product preview**: an app window card (radius 18) containing plan, elevation and a zone summary, all clickable. In production, embed real screenshots or a lightweight live embed; a light/dark screenshot pair swapped by theme is fine.
4. **How it works**: three cards with visuals: Type in the room, Pick the walls, Stack the columns.
5. **What you take to the workshop**: bento grid on 6 columns:
   - Plan and elevations (span 4)
   - 3D preview (span 2)
   - Cut list with a mini table (span 3)
   - PDF and Share link stacked (span 3)
6. **Private by design**: dark block (fixed dark in both themes) with four points: Nothing is uploaded, Saved on this device, Yours to move, Open source MIT.
7. **Start from a layout**: three template cards linking to `/app/?template=oneWall|lShape|uShape`.
8. **What it doesn't do**: three dashed cards.
9. **Guides**: four cards (01–04) linking to the existing guide pages.
10. **FAQ**: an accordion with one item open at a time, using the existing six Q&As verbatim.
11. **Closing CTA** card, then the **footer**.

Restyle the guide pages and `/ru/` with the same tokens and nav.

## Interactions & behaviour
- **Theme**: `ui.theme: 'auto' | 'light' | 'dark'` in the store, persisted with the other UI prefs. The button cycles auto → light → dark. Set `document.documentElement.dataset.theme` (remove it for auto). Apply it before first paint (inline script in `index.html` / `app/index.html`) to avoid a flash.
- **Selection**: clicking a zone selects unit + zone. Clicking the plinth or empty unit area selects the unit only. Clicking a "+" sets the insert slot, and the next preset click inserts there. Without a slot, insert after the selected unit, or at the end.
- **Insert with no room**: keep the existing toast `toast.noRoom`. Toasts are `--ink` bg / `--bg` text, radius 10, bottom centre.
- **Free length** is shown live on the wall tab and in the tray header. Overflow turns it `--danger` and raises the error banner.
- Switching a zone's type resets its count to the type's default (drawers 3, shelves 4, shoes 5).
- Hover: secondary buttons → `--surface2`; preset cards → `--accent` border; links → `--ink`.
- Keyboard shortcuts in `useKeyboard.ts` stay as they are. The "Keyboard shortcuts" menu item should list them.
- Focus: visible 2px `--accent` outline on all controls.

## State changes (zustand)
- `Tab`: add `'setup'` (Room mode).
- `ui.theme` (new, persisted).
- `ui.insertAt: number | null` (new, transient).
- `ui.sheetOpen` (mobile, transient).
- Everything else already exists: selection, units, project, errors, past/future.

## i18n
Add EN and RU keys for every new string: mode names, "Saved in this browser", "Add a unit", "after {label}", "at slot {n}", "Nothing selected" and its hint, "Auto height", "Wall-mounted hanging rail" and its hint, "New walk-in", "Start designing", "Carcass defaults", theme labels, landing copy. Reuse existing keys wherever the meaning is the same.

## Assets
- No raster assets are required for the app.
- The logo mark is two CSS boxes: an `--ink` 24px rounded square holding a 12 × 10 accent U outline (2.5px). Ship it as an SVG favicon to replace `public/favicon.svg`.
- Fonts come from Google Fonts. Self-host them if you prefer; the PDF fonts in `src/pdf/fonts/` are unaffected.
- Retake the landing screenshots / OG image from the new UI in both themes.

## Files
- `designs/Overview.dc.html`: all screens; **2a/2b are canonical for the Design mode**
- `designs/App.dc.html`: app shell and modes (`layout="modes"`)
- `designs/Inspector.dc.html`, `designs/Elevation.dc.html`, `designs/Plan.dc.html`
- `designs/Mobile.dc.html`
- `designs/Landing.dc.html`
- `designs/support.js`: runtime needed to open the design files

## Suggested order of work
1. Tokens + theme switching in `src/styles.css`, `site/site.css` and the no-flash script.
2. Top bar + mode switcher + overflow menu (`TopBar.tsx`, `ProjectsMenu.tsx`).
3. Design mode layout: wall tabs, canvas, preset tray (`DesignTab.tsx`, `SpawnMenu.tsx`, `ElevationEditor.tsx` colours).
4. Inspector.
5. Room mode (`RoomForm.tsx` moved out of the Design tab).
6. 3D and Cut list chrome.
7. Mobile layout.
8. Landing + guides + `/ru/`.
