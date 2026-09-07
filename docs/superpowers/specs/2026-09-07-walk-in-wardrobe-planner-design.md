# Walk-in Wardrobe Planner — Design Spec

Date: 2026-09-07
Status: approved for implementation (autonomous run; decisions made by the implementer)
Sibling project: `../planner` (under-stairs closet planner) — same stack and core architecture; reusable modules are copied, not linked.

## 1. Goal

A browser-based, locally-run planner for a **walk-in wardrobe**: a rectangular room whose
walls are lined with open (doorless) wardrobe units. The user defines the room (all three
dimensions, door wall/position/size), picks which walls carry wardrobe, and fills each wall
with columns of shelves, drawers, hanging rails and open compartments — leaving gaps where
needed and a clearance between wardrobe top and ceiling. The tool shows the result in 3D and
in dimensioned 2D drawings (plan, per-wall elevations), produces a cut list, and exports a
PDF scheme and JSON project files.

The editing UI must make it obvious **where** a column is spawned: the user clicks a wall in
the plan, then clicks a "+" marker at the desired position in that wall's elevation and picks
a preset.

Non-goals (v1): doors on units, corner carousel/diagonal units, sloped ceilings, non-rectangular
rooms, windows, lighting, pricing, drawer box parts (fronts only), mobile layout, cloud storage.

Languages: English and Russian (UI, drawings, cut list, PDF), as in the sibling project.

## 2. Domain model

All lengths in millimetres. World coordinate system (three.js conventions):

- X: room width, `x = 0` at the **left** wall, `x = room.width` at the **right** wall.
- Y: up, `y = 0` floor.
- Z: room depth, `z = 0` at the **back** wall, `z = room.depth` at the **front** wall.

The plan is drawn from above with +X to the right and +Z downwards, so the back wall is at the
top of the plan and the front wall (where the door usually is) at the bottom.

```ts
type Wall = 'back' | 'right' | 'front' | 'left';   // clockwise on the plan, starting at the top
type ZoneType = 'open' | 'shelves' | 'drawers' | 'hanging';

interface Room { width: number; depth: number; height: number }

interface Door {
  wall: Wall;
  offset: number;   // along +X (back/front walls) or +Z (left/right walls), from the x=0 / z=0 corner
  width: number;
  height: number;   // drawing/3D only
}

interface Zone {
  id: string;
  type: ZoneType;
  height: number | null;  // clear interior height; null = auto (shares leftover with other auto zones)
  count: number;          // shelves: number of shelves (>= 1); drawers: number of fronts (>= 1); ignored otherwise
}

interface Unit { id: string; kind: 'unit'; width: number; zones: Zone[] }  // zones bottom -> top
interface Gap  { id: string; kind: 'gap';  width: number }                  // empty wall space, no parts
type Column = Unit | Gap;

interface WallPlan {
  enabled: boolean;
  depth: number;                   // unit depth on this wall
  segments: [Column[], Column[]];  // segments[1] is used only while the door is on this wall (space after the door)
}

interface Wardrobe {
  panelThickness: number;  // 18
  backThickness: number;   // 4
  plinthHeight: number;    // 100
  topGap: number;          // clearance between unit top and ceiling; may be 0
  doorMargin: number;      // free wall kept on each side of the door opening
  walls: Record<Wall, WallPlan>;
}

interface Project { name: string; room: Room; door: Door; wardrobe: Wardrobe }
```

Column and zone ids are unique across the whole project (`c…`, `z…` generated ids), so
actions address a column by id alone.

### 2.1 Wall frames

Every wall has a local frame used for its elevation drawing and for building parts:

- local `x` = **s**, running along the wall to the **right as seen by a person standing in the
  room facing that wall**, `s = 0` at the viewer's left corner, `s = wallLength` at the right
  corner. `wallLength` = `room.width` for back/front, `room.depth` for left/right.
- local `y` = up (world Y).
- local `z` = 0 at the wall surface, increasing **into the room**. Units occupy `z ∈ [0, depth]`;
  the back panel sits at `z ∈ [0, backThickness]`, the front face is at `z = depth`.

The frame is a rotation about Y by `yaw` plus a translation `origin`
(`world = origin + rotY(yaw) · local`):

| wall  | origin            | yaw    | world(s, y, z)              | viewer's-left corner |
|-------|-------------------|--------|-----------------------------|----------------------|
| back  | (0, 0, 0)         | 0      | (s, y, z)                   | left wall            |
| right | (W, 0, 0)         | −π/2   | (W − z, y, s)               | back wall            |
| front | (W, 0, D)         | π      | (W − s, y, D − z)           | right wall           |
| left  | (0, 0, D)         | π/2    | (z, y, D − s)               | front wall           |

(`W = room.width`, `D = room.depth`.) Neighbours: `leftOf(wall)` is the wall at the viewer's
left corner (back←left, right←back, front←right, left←front), `rightOf(wall)` the one at the
viewer's right corner (the next wall clockwise).

Parts are built in local coordinates with rotations of the form `(rx, ry, 0)` and then mapped
to world by `rotation = (rx, ry + yaw, 0)`, `position = origin + rotY(yaw)(localPosition)`.
The 3D mesh applies the same Euler XYZ convention as the sibling (`toWorld` in `geometry/vec.ts`),
pinned by a matrix test.

The door opening on its wall, in that wall's `s` coordinate: `back: [offset, offset + width]`,
`right: [offset, offset + width]`, `front: [W − offset − width, W − offset]`,
`left: [D − offset − width, D − offset]`.

### 2.2 Segments (where columns may go)

For an enabled wall, the usable run is the wall length minus **corner claims** minus the
**door exclusion**:

- Corner claims. Back and front walls own their corners and run the full wall. A side wall
  (left/right) gives way at a corner if the neighbouring back/front wall is enabled **and**
  that neighbour's segment touching the corner has usable length ≥ `minUnitWidth`; the
  claim equals the neighbour's `depth`. Otherwise the claim is 0. (`minUnitWidth =
  2 · panelThickness + 100`.)
- Door exclusion on the door wall: `[doorS0 − doorMargin, doorS1 + doorMargin]`.

Result: `segments(project, wall): Segment[]` with `Segment { wall, index: 0 | 1, s0, s1 }`:

- no door on this wall → one segment `[claimStart, L − claimEnd]` (index 0);
- door on this wall → `[claimStart, doorS0 − doorMargin]` (index 0) and
  `[doorS1 + doorMargin, L − claimEnd]` (index 1).

A segment with `s1 − s0 < minUnitWidth` is still returned (length may even be negative) so
validation can report columns that no longer fit; the UI shows it as "no room".

Columns of `walls[wall].segments[i]` are laid out from `segment.s0` left to right:
column `k` occupies `[s0 + Σ widths before k, … + width_k]`. Free width of a segment
= `(s1 − s0) − Σ widths`.

### 2.3 Heights

- Carcass bottom at `y = plinthHeight`, carcass top at `y = room.height − topGap`.
- `carcassHeight = room.height − topGap − plinthHeight`; `interiorHeight = carcassHeight − 2t`
  (`t = panelThickness`); `interiorWidth = width − 2t`; `interiorDepth = depth − backThickness`.

### 2.4 Units and zones

Each unit is a separate carcass (two sides, top, bottom, back, plinth board), exactly like
the sibling project's columns — adjacent units stand side by side with a double panel between
them (modular-frame construction). Zones stack from the bottom; consecutive zones are separated
by a fixed **divider** shelf of thickness `t` spanning the interior width and depth.

Zone heights: let `n` zones, `F` = sum of fixed heights, `A` = number of auto zones.
`leftover = interiorHeight − F − (n − 1)·t`.
- `A > 0`: every auto zone gets `leftover / A`.
- `A = 0`: the **top** zone absorbs `leftover` (its effective height = stated + leftover).
- `leftover < 0` → validation error (zones don't fit).

Zone `k` clear range `[yBot_k, yTop_k]` measured from the floor; `yBot_0 = plinth + t`.

Content (all in the unit's local coordinates; `iw` interior width, `id` interior depth):
- `open`: nothing.
- `shelves` (count `n ≥ 1`): **`count` is the number of COMPARTMENTS (openings)**, the same way
  `drawers.count` is the number of drawers — so `n` bays are separated by `n − 1` boards and
  `count = 1` is a single open bay with no board in it. `opening = (zoneH − (n − 1)·t) / n`;
  board `k` (1..n−1) has its underside at `yBot + k·opening + (k − 1)·t`. Shelf outline
  `iw × (id − 20)`, set back 20 mm from the front.
- `drawers` (count `n ≥ 1`): inset fronts within the zone, 2 mm reveal at every edge and 3 mm
  between fronts: `frontH = (zoneH − 4 − 3(n − 1)) / n`, `frontW = iw − 4`, front `k` from
  `yBot + 2 + (k−1)(frontH + 3)`; fronts occupy `z ∈ [depth − t, depth]`. Boxes are not modelled.
- `hanging`: one rod Ø25, length `iw`, axis at `yTop − 80`, `z = id / 2` from the wall.

Constants: `SHELF_SETBACK 20`, `REVEAL 2`, `DRAWER_GAP 3`, `ROD_DROP 80`, `ROD_DIAMETER 25`,
`PLINTH_SETBACK 40`, `MIN_ZONE_HEIGHT 100`, `MIN_DRAWER_FRONT 80`.

### 2.5 Validation

`validate(project) → ValidationError[]` (`{ path, message: Msg }`). The last valid project stays
rendered while errors exist.

- `room.width, depth, height > 0`; `room.height ≥ plinthHeight + topGap + 2t + MIN_ZONE_HEIGHT`.
- `door.width > 0`, `door.offset ≥ 0`, `door.offset + door.width ≤` door wall length,
  `0 < door.height ≤ room.height`.
- `panelThickness ≥ 1`, `backThickness ≥ 1`, `plinthHeight ≥ 0`, `topGap ≥ 0`, `doorMargin ≥ 0`.
- Every wall: `depth ≥ 200`. Enabled walls: for every segment, `Σ widths ≤ s1 − s0`
  (error names the wall and, if the door is on it, the segment).
- Every column (including on disabled walls, so hidden data cannot go stale): `width > 0`;
  units: `width ≥ minUnitWidth`, at least one zone, every zone's effective height
  ≥ `MIN_ZONE_HEIGHT`, `leftover ≥ 0`, `shelves.count ≥ 1`, `drawers.count ≥ 1` with
  `frontH ≥ MIN_DRAWER_FRONT`.

### 2.6 Presets

`presets.ts` exports a list used by the spawn menu (default width 600, clamped to the
segment's free width when smaller, disabled when free width < `minUnitWidth`):

| key              | zones bottom → top                                    |
|------------------|-------------------------------------------------------|
| `hanging`        | hanging (auto)                                        |
| `doubleHanging`  | hanging (auto), hanging (auto)                        |
| `shelves`        | shelves ×6 compartments (auto)                        |
| `drawersHanging` | drawers ×3 (600), hanging (auto)                      |
| `drawersShelves` | drawers ×4 (800), shelves ×4 compartments (auto)      |
| `open`           | open (auto)                                           |
| `gap`            | — (a `Gap` column; default 300, clamped to free width)|

### 2.7 Defaults

Room 2400 × 2000 × 2500; door on the front wall, offset 800, width 800, height 2100;
panel 18, back 4, plinth 100, topGap 150, doorMargin 80.
Walls: back (depth 600, enabled): 600 drawersHanging, 600 doubleHanging, 600 shelves,
600 drawersShelves. Left (600, enabled): 700 doubleHanging, 700 shelves. Right (600,
enabled): 300 gap, 500 hanging, 600 shelves. Front: disabled, depth 400, no columns.
(Side walls have 1400 usable: 2000 − 600 back claim.)

### 2.8 Internationalisation

Same mechanism as the sibling: `Lang = 'en' | 'ru'`, typed dictionaries `en.ts` (defines the
key set) and `ru.ts`, pure `t(lang, key, params?)`, `Msg = { key, params? }` for data that
carries text, language persisted in `localStorage` `wardrobe-planner:lang`, detected from
`navigator.language`, `EN | RU` switch in the top bar.

## 3. Architecture

```
model/     types, defaults, presets, validate(project) -> ValidationError[]
geometry/  vec (copied), frames (wall frames, door span, segments), layout (unit/zone layout),
           parts: buildParts(project) -> Part[]
cutlist/   buildCutList(parts) -> CutRow[]
drawing/   ir + dim (copied); views: planView, wallElevation -> Drawing
render/    svg (copied + drawingToSvgParts), pdf (copied)
pdf/       exportPdf(project, opts) -> jsPDF/Blob, embedded PT Sans (copied)
store/     zustand store (project, selection, history), persist (localStorage, JSON)
ui/        React: TopBar, DesignTab (PlanEditor, ElevationEditor, Inspector, RoomForm),
           Viewport3D (three/), CutListTable, Toast, fields
```

### 3.1 Part

```ts
type PartKind = 'side' | 'top' | 'bottom' | 'back' | 'divider' | 'shelf' | 'drawerFront' | 'plinth' | 'rod';
type PartNameKey = 'sideL' | 'sideR' | 'top' | 'bottom' | 'back' | 'divider' | 'shelf' | 'drawerFront' | 'plinth' | 'rod';
interface Part {
  id: string;
  wall: Wall;
  columnIndex: number;   // 0-based index of the unit within its wall, counting across both segments
  unitId: string;
  nameKey: PartNameKey; index?: number; kind: PartKind;
  outline: Vec2[]; thickness: number; transform: Transform; material: 'panel' | 'back' | 'rod';
  notes?: Msg[];
}
```

Local placement per unit at `[s0, s1]` (`w = s1 − s0`), using the sibling's rotation
constants (`FLAT_ROT` top surface at position.y; `SIDE_ROT` position.x = right face of the
panel; `NO_ROT` extrusion towards +z):

- sideL: `rect(depth, carcassHeight)`, `SIDE_ROT`, at `(s0 + t, plinth, 0)`.
- sideR: same outline at `(s0 + w, plinth, 0)`.
- bottom: `rect(iw, depth)`, `FLAT_ROT`, at `(s0 + t, plinth + t, 0)`.
- top: `rect(iw, depth)`, `FLAT_ROT`, at `(s0 + t, plinth + carcassHeight, 0)`.
- back: `rect(iw, interiorHeight)`, `NO_ROT`, thickness `backThickness`, at `(s0 + t, plinth + t, 0)`.
- divider (between zones k and k+1): `rect(iw, id)`, `FLAT_ROT`, top surface at `yTop_k + t`,
  at `(s0 + t, yTop_k + t, backThickness)`.
- shelf: `rect(iw, id − 20)`, `FLAT_ROT`, top surface at underside + t, at
  `(s0 + t, y, backThickness)` (set back 20 mm from the front: the outline is shorter, the
  panel starts at the back).
- drawerFront: `rect(frontW, frontH)`, `NO_ROT`, at `(s0 + t + 2, y0, depth − t)`.
- rod: `circle(12.5, 24)`, `ROD_ROT`, thickness `iw`, material rod, at `(s0 + t, rodY, id / 2)`.
- plinth: `rect(w, plinth)`, `NO_ROT`, at `(s0, 0, depth − PLINTH_SETBACK − t)`.

Then every part transform is mapped through the wall frame (§2.1). Gaps produce no parts.

### 3.2 Drawings

Drawing IR, `dim` expansion, SVG and PDF renderers are copied from the sibling unchanged
(plus `drawingToSvgParts(d) → { viewBox, inner }` so the editors can wrap the same markup in a
React `<svg>` and overlay hit areas).

- **Plan** (`planView(project, lang)`, IR y = −world z): room rectangle (thick), door opening
  (gap in the wall line, leaf line + swing arc), every enabled wall's units as plan rectangles
  (panel fill) with the wall's depth, gaps as dashed rectangles, wall labels, dims: room width,
  room depth, door offset and width, each enabled wall's depth.
- **Wall elevation** (`wallElevation(project, wall, lang)`, IR in the wall's local `(s, y)`):
  floor and ceiling lines, wall rectangle `L × H` (thick), ceiling gap band label, the door
  opening on this wall (dashed rectangle + label), corner claims as dashed side-section
  rectangles labelled with the neighbouring wall, then every column: units drawn with carcass
  outline (panel fill), dividers, shelves (thick lines), drawer fronts (rectangles with a
  short handle line), rods (circle Ø25 and a dashed axis), gaps as dashed rectangles labelled
  "gap"; a text label per zone (`type · effective height`). Dims: segment length(s), each
  column width, carcass height, plinth, top gap, wall length. Disabled walls still draw the
  room outline with a "no wardrobe" label.

### 3.3 Cut list

`buildCutList(parts) → CutRow[]` grouped by identical `(kind, nameKey, length, width,
thickness, material, notes)`, with `locations: { wall, columnIndex }[]` (rendered as
"Back 2, Left 1"). Ordered by kind (`side, top, bottom, back, divider, shelf, drawerFront,
plinth, rod`).

### 3.4 PDF

A4 landscape via jsPDF with embedded PT Sans: 1) summary (parameters table incl. per-wall
column summary + 3D snapshot), 2) plan, 3…) one elevation page per enabled wall, then cut list
pages (27 rows per page). Page count = `2 + enabledWalls + ceil(rows / 27)` (min 1 cut-list page).

### 3.5 3D viewport

react-three-fiber + drei `OrbitControls`. `RoomMesh`: floor plane; four wall planes with
normals facing **into** the room and `FrontSide` material (walls between the camera and the room
are back-face culled, "dollhouse" view), light tint, edge lines, door opening drawn as a lighter
inset panel on its wall plus a swing arc on the floor; ceiling drawn as edge lines only. Every
`Part` → `ExtrudeGeometry` mesh (copied `PartMesh` with a per-kind colour table; rods are
cylinders via the circle outline). Toggles: dims (Html labels: unit widths at the units' front
bottom edge, wall names), room visibility, explode slider (fronts/shelves move out along the
wall's local +z). Camera starts above the front wall looking at the room centre, fitted to the
room size.

### 3.6 State, history, persistence

zustand store:

```ts
interface Selection { wall: Wall; columnId: string | null; zoneId: string | null }
interface UiState { tab: 'design' | '3d' | 'cutlist'; selection: Selection; showDims; showRoom; explode; toast; lang }
state: { project, errors, lastValid, past: Project[], future: Project[], ui }
actions: setProject(updater, {history?: true}), undo, redo,
  setName, setRoom(patch), setDoor(patch), setWardrobe(patch), setWall(wall, patch),
  insertColumn(wall, segment, index, column), updateColumn(id, patch), removeColumn(id),
  moveColumn(id, dir), duplicateColumn(id),
  addZone(columnId, zone), updateZone(columnId, zoneId, patch), removeZone(columnId, zoneId), moveZone(columnId, zoneId, dir),
  select(patch), newProject, loadProject, setUi, toast, setLang
```

History: `setProject` pushes the previous project onto `past` (cap 100) and clears `future`;
`undo/redo` swap. Selection is cleaned when its column/zone disappears. Autosave `project` to
`localStorage` `wardrobe-planner:project` (debounced 300 ms); JSON files
`{ version: FILE_VERSION, project }` validated by shape on load and by `validate()` on import.
`FILE_VERSION` is **2**; a version-1 file (shelf counts meaning boards) is migrated on read by
`migrateProject`, which adds one to every `shelves` zone `count` and every corner's `shelves`,
reproducing exactly the geometry it was saved with. Autosaved v1 projects take the same path. Defaults from §2.7 when nothing is stored.

## 4. UI layout

- **Top bar**: project name, tabs `Design | 3D | Cut list`, `EN | RU`, Undo / Redo, New /
  Import JSON / Export JSON / Export PDF.
- **Design tab** — three columns:
  - **Left (300 px)**: *Plan editor* on top (SVG of `planView` + overlay: one clickable band per
    wall; the selected wall gets a blue outline, disabled walls show a dashed band with a
    "+" hint; hover highlights), then *Room* form (width, depth, height), *Door* form (wall,
    offset, width, height, margin), *Wardrobe* form (top gap, plinth, panel, back).
  - **Centre**: *Elevation editor* for the selected wall. Header: wall name, checkbox
    "Wardrobe on this wall", depth field, free width per segment. Body: SVG of
    `wallElevation` + overlay: a hit rectangle per column (click → select column; selected
    column outlined blue) and per zone (click → select zone; selected zone tinted), "+"
    circle buttons at every column boundary of every segment (including the segment start
    and end), each opening a **spawn menu** listing the presets (§2.6) with their default
    widths; picking one inserts at that index and selects the new column. A segment with no
    room shows a red "no room" note. Keyboard: `Delete` removes the selected zone (if any) else
    the selected column; `Escape` clears the selection; `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` undo/redo.
  - **Right (320 px)**: *Inspector*. Validation errors (red) on top. Then, for a selected unit:
    width, `◀ ▶` move, Duplicate, Remove, derived interior size, and the zone list rendered
    **top → bottom** (matching the drawing): each row has type select, height field
    (disabled while auto), Auto checkbox, count field (shelves/drawers), `▲ ▼ ✕`, and an
    "Add zone" button (adds an `open` auto zone at the top). Selected zone row highlighted;
    clicking a row selects the zone. For a gap: width, move, Remove. Nothing selected: a hint
    ("Click a wall in the plan, then a + in the elevation").
- **3D tab**: viewport with the toggles (§3.5).
- **Cut list tab**: table.
- Toast for import/PDF errors.

## 5. Error handling

As the sibling: `validate()` never throws; views use `lastValid`; PDF export shows a busy state
and a toast on failure, snapshot failure falls back to text; JSON import rejects bad files with a
toast; autosave is best-effort.

## 6. Testing

vitest (node environment) for: `frames` (world mapping of every wall, door spans, segments with
claims/door/disabled neighbours), `layout` (zone heights auto/fixed/top-absorbs, shelves,
drawers, rod), `parts` (count per unit, world bounds inside the room, matrix convention vs
three.js), `validate`, `cutlist` (grouping, locations), `views` (plan/elevation have dims, bounds,
disabled wall), `svg`, `pdf` (page count), `store` (insert/move/remove/undo/selection cleanup),
`persist` (round trip, bad input), `i18n` (key parity). Typecheck and `pnpm build` must pass.
The UI is verified in the browser (Playwright-driven review agent).

## 7. Stack

Vite, TypeScript strict, React 18, three + @react-three/fiber + @react-three/drei, zustand,
jsPDF, vitest; pnpm; scripts `dev`, `build`, `test`, `typecheck`. Same pinned versions and
`pnpm-workspace.yaml` overrides as the sibling.

## 8. Amendment 2026-09-07: corners

The v1 rule ("side walls butt against back/front runs") leaves the back/front run's corner unit
blocked by the side run's first unit. A corner can now instead carry an explicit L-shaped open
shelf unit. Scope note: an earlier draft of this amendment also defined `rail`, `void` and
`blind` modes, a `warnings()` API and a new default project; those were cut. What is
implemented, and what this section describes, is the two-mode version below — the runs are not
re-flowed automatically, so making room for a corner unit stays the user's job.

### 8.1 Model

```ts
export const CORNER_MODES = ['none', 'lshelf'] as const;
type CornerMode = (typeof CORNER_MODES)[number];
interface CornerPlan { mode: CornerMode; width: number; shelves: number }  // width = leg length along both walls; shelves = compartments >= 1
Wardrobe.corners: Record<Wall, CornerPlan>   // keyed by the ANCHOR wall: the wall whose s = 0 end is that corner
```

Corner ids: `back` = back-left corner (back wall's s=0 end = left wall's s=L end), `right` =
back-right, `front` = front-right, `left` = front-left. For a corner with anchor wall `A`, the
other wall is `B = leftOf(A)`; the corner lies at `A: s = 0` and `B: s = wallLength(B)`.

`none` is exactly the pre-amendment behaviour: nothing is built and the v1 claim rule applies.
Defaults for new projects: `{ mode: 'none', width: 1000, shelves: 6 }` at every corner (`shelves`
counts compartments, see §8.3), so the default project of §2.7 is unchanged. `wardrobe.corners`
is **optional** in the file shape check, and a file without it loads with four `none` plans —
i.e. the behaviour it was saved with.

### 8.2 Claims (extends the v1 corner rule)

A corner is *active* when both of its walls are enabled. Per corner (`dA`, `dB` = wall depths):

| mode     | claim on A's start | claim on B's end | corner parts            |
|----------|--------------------|------------------|-------------------------|
| `none`   | v1 rule: the side wall yields the back/front wall's depth (if that wall's corner segment is >= minUnitWidth); back/front claim 0 | | none |
| `lshelf` | `width`            | `width`          | one L-shaped open shelf unit |

An `lshelf` corner with a disabled wall is inactive: it claims nothing and produces nothing.
A `none` corner keeps the v1 asymmetry on purpose (only the side wall yields).

### 8.3 L-shaped corner unit

Built in the anchor wall's frame (u = s along A, v = local z into the room), then mapped
through `wallFrame(A)`. Footprint: `u ∈ [0, width] × v ∈ [0, dA]` ∪ `u ∈ [0, dB] × v ∈ [0, width]`.
The end panels are full height, so the horizontal slabs stop `t` short of each leg's end:
the **slab** outline is `(0,0) (w−t,0) (w−t,dA) (dB,dA) (dB,w−t) (0,w−t)`, while the full
footprint above is the outer outline used for the plan drawing and the hit shape. No two of
the unit's parts share volume (pinned by a test).

Parts (`Part.wall = A`, `Part.columnIndex = -1`, `Part.corner = A`, cut-list tag `BL/BR/FR/FL`):
- bottom / top: the slab polygon, FLAT_ROT, at `y = floorY` / `plinth + carcassHeight`, note `note.lShape`.
- end panel on leg A at `u ∈ [w−t, w]`: `rect(dA, carcassHeight)` SIDE_ROT at `(w, plinth, 0)`.
- end panel on leg B at `v ∈ [w−t, w]`: `rect(dB, carcassHeight)` NO_ROT at `(0, plinth, w−t)`.
- backs: along A `rect(w−t, ih)` NO_ROT thickness `bt` at `(0, floorY, 0)`; along B `rect(w−t−bt, ih)` SIDE_ROT thickness `bt` at `(bt, floorY, bt)` — B starts where A ends, so the two do not overlap in the corner.
- shelves: `CornerPlan.shelves` counts **compartments**, as a shelves zone's `count` does (§2.4), so `n` compartments give `n − 1` boards at `opening = (ih − (n−1)·t)/n`; L polygon inset `(bt,bt) (w−t,bt) (w−t,dA−20) (dB−20,dA−20) (dB−20,w−t) (bt,w−t)`, FLAT_ROT, note `note.lShape`.
- plinth boards: along A's open face `rect(w−dB, plinth)` NO_ROT at `(dB, 0, dA−40−t)`; along B's open face `rect(w−dA, plinth)` SIDE_ROT at `(dB−40, 0, dA)`.

Validation (`lshelf` only, whether or not the corner is active): `width` between
`ceil(max(dA, dB) + 100)` and `floor(min(wallLength(A), wallLength(B)) / 2)` — both bounds
rounded inwards so the range the inspector prints is exactly the range that is accepted
(`error.cornerWidth`, path `corners.<anchor>`) — and `shelves >= 1` (`error.cornerShelves`).
`validate()` keeps returning a single `ValidationError[]`; there is no separate warnings channel.

### 8.4 Drawings and UI

- Plan: the L polygon with panel fill plus the corner tag in the corner square; `none` unchanged.
- Elevation of A: `lshelf` → the corner unit spans `[0, width]`: solid end-panel face over `[0, dB]`
  (panel fill, labelled with wall B), open face with shelf lines over `[dB, width−t]`, tag text
  above and a width dimension below. Elevation of B mirrored at `[L − width, L]` (open
  `[L−width+t, L−dA]`, panel `[L−dA, L]`). `none` → the v1 dashed wall section.
- `Selection` gains `corner: Wall | null` (exclusive with column/zone; touching `columnId`
  clears it and vice versa). Corners are clickable in the plan — the L polygon where one is
  fitted, otherwise a square tab of `min(200, dA, dB)` mm in the corner (the `dB × dA` overlap of
  the two runs is far too big a target: it swallowed most of a short wall's band) — and in the
  elevation over whatever wall length the corner claims. Inspector for a corner: title
  `corner.<A>` ("Back-left corner"), mode select, leg length, compartment count, the allowed leg
  range, and — for `lshelf` only — the hint that both runs stop short of the corner.
  `Delete` does nothing on a corner.
- PDF: one summary row per built corner; the cut-list legend gains the corner codes it uses.
  Cut list: corner parts are located by the corner tag. Rows are grouped by the part's *outline*
  (rounded to 0.1 mm) rather than by which corner it came from, so a corner panel that is the
  same board as a run panel shares its row while two mirrored L slabs of equal bounding size
  stay apart.
