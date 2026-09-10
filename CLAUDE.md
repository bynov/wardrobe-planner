# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Browser-only planner for a walk-in wardrobe (rectangular room, open doorless units along chosen walls). Outputs: 3D preview, dimensioned plan + per-wall elevations, cut list, PDF. Sibling of `../planner` (under-stairs closet planner) with the same architecture and conventions; when in doubt about style, look there. Design spec: `docs/superpowers/specs/2026-09-07-walk-in-wardrobe-planner-design.md` (README covers user-facing behaviour).

## Commands

```
pnpm install
pnpm dev                                  # http://localhost:5173
pnpm test                                 # vitest run, all tests
pnpm test src/geometry/layout.test.ts     # one file
pnpm test -t "rail"                       # by test name (no `--`)
pnpm typecheck                            # tsc --noEmit
pnpm build                                # typecheck + vite build -> dist/
pnpm embed-font                           # regenerate src/pdf/fonts/ptsans.ts (only if the TTF changes)
```

`pnpm test`, `pnpm typecheck` and `pnpm build` must all pass before a task is called done; test output should be pristine. Tests are `src/**/*.test.ts` running in the `node` environment (no DOM), so everything under test must stay DOM-free.

Git: commit/push only when the user explicitly asks. CI (`.github/workflows/pages.yml`) runs test + build on push to `master` and deploys to GitHub Pages at the custom domain `walkinplanner.com` (`public/CNAME`); the app lives under `/app/`.

## Architecture

Pure-TS core with no DOM dependency, thin React UI on top. Data flows one way:

```
Project (model/types) ──validate──> errors
   │
   ├─ geometry/frames   wall frames, segments (where columns may go), door span/arc
   ├─ geometry/layout   heights, zone stacking, UnitLayout/GapLayout incl. rail placement
   └─ geometry/parts    Part[] (every board/rod with a 2D outline + 3D transform)
          │
          ├─ cutlist/       rows grouped from Part[]
          ├─ drawing/views  plan + elevations as a renderer-agnostic IR (drawing/ir: line/poly/text/dim)
          │     ├─ render/svg   IR -> SVG string (Design tab)
          │     └─ render/pdf   IR -> jsPDF (pdf/exportPdf composes pages, embeds PT Sans)
          └─ ui/three       Part[] -> R3F meshes
```

- `store/store.ts` (zustand): holds `project`, `errors`, `lastValid`, undo/redo history (`past`/`future`, limit 100), and `ui` (tab, selection, lang). Every edit goes through `commit()` which re-validates and keeps `lastValid` as the last error-free project. 3D, cut list and PDF render from `lastValid` (with a stale banner); Design-tab drawings render from the current project when it is still geometrically drawable (`ui/drawable.ts`). No-op edits must not create history entries (structural sharing is checked by identity).
- `store/persist.ts`: JSON file format with `FILE_VERSION` and shape validation; older versions are migrated on load. Optional fields (`rod`, `rodDir`, `rail`) are absent by default so old files keep the behaviour they were saved with. Autosaves to localStorage.
- `i18n`: every user-visible string is a `Msg` (`{key, params}`) translated with `t`/`tm`/`tmDeep`; `en.ts` defines the key set and a test enforces `ru.ts` parity (same keys, same placeholders) plus coverage of every `prefix × union` key built by casting (walls, zone types, presets, part names…). Add both languages together.

## Domain conventions (binding)

- All lengths in mm. World: X = room width (0 at left wall), Y up, Z = room depth (0 at the **back** wall). Plan is drawn from above with +X right, +Z down (back wall at the top); IR y = −world z.
- Walls: `back | right | front | left` (runtime list `WALLS`, clockwise). Wall-local `s` runs to the viewer's right when facing the wall from inside; local z = 0 at the wall surface, increasing into the room (units occupy z ∈ [0, depth]). Frames in `wallFrame()`; `world = origin + rotY(yaw)·local`.
- Part transforms are Euler XYZ exactly as `toWorld()` in `geometry/vec.ts`; parts only use rotations `(rx, ry, 0)`.
- Each wall has two segments (`[Column[], Column[]]`): index 1 is only non-empty on the door wall (door exclusion = door span ± `doorMargin`). Back/front walls own the corners; a side wall gives up `neighbour.depth` at a corner only when that back/front wall is enabled and its corner-touching segment is at least `minUnitWidth` long (`cornerClaim`).
- A column is a `Unit` (separate carcass: 2 sides, top, bottom, back, plinth; zones stack bottom→top separated by dividers of thickness `t`; auto-height zones share the leftover, otherwise the top zone absorbs it) or a `Gap` (empty, optionally carrying a wall-mounted `rail` along/across).
- Shelves zone `count` = compartments, not boards (`n` compartments → `n−1` shelves). Drawers zone `count` = fronts, rounded down to whole mm.
- Hanging rails clamp to `MAX_ROD_HEIGHT` 2000 mm above floor; an `along` gap rail spans the whole empty stretch it sits in (see `GapRailLayout` doc comment in `geometry/layout.ts`), which is the most intricate rule in the codebase.
- Unit tags `B1`, `R2`, `L1`… (`unitTag`) tie drawings and PDF to cut-list rows; keep them Latin in both languages.
- Named constants live at the top of `geometry/layout.ts` and `model/defaults.ts`; do not inline the numbers.

## Working notes

- `.superpowers/sdd/<plan>/` is a gitignored scratch area from the original SDD run (briefs, reports, `progress.md` with the known-open-items list, and `snap-package` for tree-snapshot review diffs). `global-constraints.md` there predates git and is stale on that point; the conventions above supersede it.
- `src/pdf/fonts/ptsans.ts` is generated (base64 PT Sans, SIL OFL); never hand-edit.
- `pnpm-workspace.yaml` pins `@types/react-reconciler` to a React-18-compatible version and allowlists the `core-js` postinstall; keep both when touching deps.
