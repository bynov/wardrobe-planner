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
   zone *inside the already-selected unit* to drill down to that zone. A shelves zone is sized
   in **compartments**, not boards: *n* compartments are split by *n* − 1
   shelves, so `1` is a single open bay. Older project files are migrated on load. `Delete` removes the
   selected zone when one is selected (never a unit's last zone) and the whole unit otherwise,
   `Esc` clears the selection, `Cmd/Ctrl+D` duplicates the unit, `Cmd/Ctrl+Z` undoes.
3. A **gap** can carry a *hanging rail (wall-mounted)* — the usual answer for the stretch a run
   has to leave free in a corner: tick it on the gap, pick a direction and a height above the
   floor, and the rod (but not its brackets) joins the cut list. No carcass is built. An *along*
   rail spans the whole empty stretch its gap sits in: the plain gaps beside it and, after the
   last column, the free rest of the wall, up to the next unit or the next wall — and on through
   a corner left for the neighbouring run when that run keeps the corner empty (a plain gap, or
   nothing, where it meets our wall). No need to size the gap to fit.
4. A hanging zone's rail runs **along the wall** by default; switch its *Direction* to
   **front to back (corner)** for a unit boxed into a corner, where a wall-parallel rail
   cannot be reached. The plan shows every rail as a dashed line, so the two read apart.
5. Room / door / wardrobe settings (gap to ceiling, plinth, panel thickness) are in the
   left panel.
6. **3D** tab to orbit around the room; **Cut list** tab for the parts; Export PDF for the
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
