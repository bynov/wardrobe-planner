# Walk-in wardrobe planner

Browser-based planner for a walk-in wardrobe: a rectangular room lined with open
(doorless) wardrobe units. Set the room size and door, pick which walls carry wardrobe,
and fill each wall with units made of hanging rails, shelves, drawers and open
compartments — or leave gaps. Get a 3D preview, dimensioned plan and per-wall
elevations, a cut list, and a PDF scheme. Runs entirely locally; the project autosaves
to localStorage and can be exported/imported as JSON.

Languages: English and Russian (switch in the top bar; the PDF embeds PT Sans, SIL OFL).

## Use

1. **Design** tab: click a wall in the plan (top-left), then click a **+** in the wall
   elevation to insert a unit preset (long hanging, double hanging, shelves, drawers +
   hanging, drawers + shelves, open compartment, or an empty gap) at that position.
2. Click a unit to edit its width and zones (bottom→top stack) in the inspector; click a
   zone *inside the already-selected unit* to drill down to that zone. `Delete` removes the
   selected zone when one is selected (never a unit's last zone) and the whole unit otherwise,
   `Esc` clears the selection, `Cmd/Ctrl+D` duplicates the unit, `Cmd/Ctrl+Z` undoes.
3. Room / door / wardrobe settings (gap to ceiling, plinth, panel thickness) are in the
   left panel. Back and front walls own the corners; side walls butt against them.
4. **3D** tab to orbit around the room; **Cut list** tab for the parts; Export PDF for the
   scheme (open the 3D tab first for the snapshot page).

## Scope

The model covers the carcass and what is visible in an elevation: sides, top, bottom, back,
dividers, shelves, drawer *fronts*, plinths and hanging rods. **Drawer boxes and hardware are
not modelled** — no runners, hinges, handles, edging or fixings — so the cut list covers drawer
fronts and carcass panels only, and the drawer depths a supplier needs must be chosen from the
unit's interior depth by hand. Doors on the units themselves are out of scope by design: this
plans an open, walk-in wardrobe.

## Develop

    pnpm install
    pnpm dev        # http://localhost:5173
    pnpm test       # vitest
    pnpm typecheck
    pnpm build      # dist/

## Layout

- `src/model` types, factory, presets, defaults, validation
- `src/geometry` wall frames + segments, unit/zone layout, `Part[]` builder
- `src/cutlist`, `src/drawing`, `src/render`, `src/pdf` pure outputs derived from the model / `Part[]`
- `src/store` zustand store (history, selection), persistence
- `src/ui` React components (Design tab editors, 3D viewport under `src/ui/three`)

Design spec: `docs/superpowers/specs/2026-09-07-walk-in-wardrobe-planner-design.md`.
Sibling project (same architecture): `../planner` (under-stairs closet planner).

## Deploy

Pushes to `master` build and publish to GitHub Pages via `.github/workflows/pages.yml`
(repository Settings → Pages → Source must be "GitHub Actions"). The workflow sets
`BASE_PATH=/<repo>/` so assets resolve under the project sub-path.
