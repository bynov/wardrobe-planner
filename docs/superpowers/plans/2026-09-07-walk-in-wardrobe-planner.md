# Walk-in Wardrobe Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local browser app that plans a walk-in wardrobe room (rect room, door, per-wall doorless units of shelves/drawers/hanging/open zones, gaps, ceiling clearance) with an interactive plan + elevation editor, 3D view, cut list, JSON and PDF export.

**Architecture:** Pure TypeScript core (`model → geometry → Part[] → cutlist / drawing / pdf`) with no DOM dependency, thin React UI around a zustand store. Everything downstream derives from `buildParts(project)`. Interactive editors reuse the print drawings (SVG markup) and add React overlays for hit-testing.

**Tech Stack:** Vite 8, TypeScript 7 strict, React 18, three 0.185 + @react-three/fiber 8 + @react-three/drei 9, zustand 5, jsPDF 4, vitest 5, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-07-walk-in-wardrobe-planner-design.md` — read it first; every task argues from it.

## Global Constraints

- **No git commits** — the user forbade commits. Skip every "commit" step; leave the working tree dirty.
- All lengths in mm. World: X = room width (0 at the left wall), Y up, Z = room depth (0 at the **back** wall, `room.depth` at the front wall).
- Wall local frame: `s` (local x) runs to the viewer's right when facing the wall from inside; local z = 0 at the wall surface, increasing into the room (units occupy `z ∈ [0, depth]`, front face at `z = depth`).
- Part transforms use Euler XYZ applied X→Y→Z exactly as `toWorld()` in `src/geometry/vec.ts`; parts only use rotations of the form `(rx, ry, 0)`.
- Every user-visible string goes through `t(lang, key)` / `Msg`; `src/i18n/en.ts` defines the key set (already complete after Task 1 — do not add keys unless a task says so; `ru.ts` must keep parity, checked by a test).
- Constants: `panelThickness 18`, `backThickness 4`, `plinthHeight 100`, `topGap 150`, `doorMargin 80`, `SHELF_SETBACK 20`, `REVEAL 2`, `DRAWER_GAP 3`, `ROD_DROP 80`, `ROD_DIAMETER 25`, `PLINTH_SETBACK 40`, `MIN_ZONE_HEIGHT 100`, `MIN_DRAWER_FRONT 80`, `minUnitWidth = 2·t + 100`.
- Tests: `pnpm test` (vitest, node env, `src/**/*.test.ts`), `pnpm typecheck`, `pnpm build` must pass at the end of every task.
- Reference implementation for style and copied modules: `/Users/bynov/go/src/github.com/bynov/planner` (the "sibling"). Copy, don't symlink.
- Project root: `/Users/bynov/go/src/github.com/bynov/wardrobe-planner`.

## File structure

```
package.json, pnpm-workspace.yaml, tsconfig.json, vite.config.ts, index.html, .gitignore, README.md
src/main.tsx, src/App.tsx, src/styles.css
src/i18n/{index.ts, en.ts, ru.ts, i18n.test.ts}            typed dictionaries, t/tm/msg
src/model/types.ts                                         domain types
src/model/factory.ts                                       ids + zone/unit/gap constructors
src/model/presets.ts                                       spawn-menu presets
src/model/defaults.ts                                      defaultProject()
src/model/validate.ts (+test)                              validate(project)
src/geometry/vec.ts (+vec.test, matrix.test)               copied from sibling
src/geometry/frames.ts (+test)                             WALLS, wallLength, wallFrame, localToWorld, frameTransform, leftOf/rightOf, doorSpan, minUnitWidth, wallSegments
src/geometry/layout.ts (+test)                             heights, zoneHeights, layoutUnit, layoutWall, layoutAll
src/geometry/parts.ts (+test)                              Part, buildParts
src/cutlist/cutlist.ts (+test)                             buildCutList
src/drawing/ir.ts, dim.ts                                  copied from sibling
src/drawing/views.ts (+test)                               planView, wallElevation
src/render/svg.ts (+test), pdf.ts (+test)                  copied (+ drawingToSvgParts)
src/pdf/font.ts, fonts/ptsans.ts, fonts/OFL.txt, fonts/PT_Sans-Web-Regular.ttf   copied
src/pdf/exportPdf.ts (+test)                               buildPdf/exportPdfBlob
src/store/store.ts (+test), persist.ts (+test)             zustand store with history + selection; localStorage/JSON
src/ui/fields.tsx, useT.ts, Toast.tsx, download.ts, snapshot.ts   copied
src/ui/TopBar.tsx                                          name, tabs, lang, undo/redo, file actions
src/ui/DesignTab.tsx                                       3-column layout
src/ui/PlanEditor.tsx                                      interactive plan (wall selection)
src/ui/RoomForm.tsx                                        room / door / wardrobe forms
src/ui/ElevationEditor.tsx                                 interactive elevation (column/zone selection, + buttons)
src/ui/SpawnMenu.tsx                                       preset popover
src/ui/Inspector.tsx                                       errors, column + zone editing
src/ui/CutListTable.tsx
src/ui/useKeyboard.ts                                      Delete / Escape / undo-redo keys
src/ui/three/Viewport3D.tsx, PartMesh.tsx, RoomMesh.tsx
```

---

### Task 1: Scaffold + copied modules + full i18n dictionaries

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx` (placeholder), `src/styles.css` (placeholder)
- Copy verbatim from sibling `/Users/bynov/go/src/github.com/bynov/planner/src/…`: `geometry/vec.ts`, `geometry/vec.test.ts`, `drawing/ir.ts`, `drawing/dim.ts`, `render/pdf.ts`, `pdf/font.ts`, `pdf/fonts/ptsans.ts`, `pdf/fonts/OFL.txt`, `pdf/fonts/PT_Sans-Web-Regular.ttf`, `ui/download.ts`, `ui/snapshot.ts`, `ui/useT.ts`, `ui/Toast.tsx`, `ui/fields.tsx`, `i18n/index.ts`; `scripts/embed-font.mjs`
- Copy + modify: `render/svg.ts` (add `drawingToSvgParts`), `render/svg.test.ts`, `geometry/matrix.test.ts`
- Create: `src/i18n/en.ts`, `src/i18n/ru.ts`, `src/i18n/i18n.test.ts`

**Interfaces:**
- Produces: `drawingToSvgParts(d: Drawing): { viewBox: string; inner: string }` and `drawingToSvg(d): string`; `MessageKey` (keyof en), `t`, `tm`, `msg`, `Msg`, `Lang`, `LANGS`, `isLang`, `detectLang` from `src/i18n`.

- [ ] **Step 1: package.json and configs**

`package.json` (name `wardrobe-planner`, otherwise identical dependency versions to the sibling):

```json
{
  "name": "wardrobe-planner",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "embed-font": "node scripts/embed-font.mjs"
  },
  "dependencies": {
    "@react-three/drei": "^9.122.0",
    "@react-three/fiber": "^8.18.0",
    "jspdf": "^4.2.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.185.1",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@types/node": "^26.4.1",
    "@types/react": "^18.3.31",
    "@types/react-dom": "^18.3.7",
    "@types/three": "^0.185.4",
    "@vitejs/plugin-react": "^6.1.1",
    "typescript": "^7.0.2",
    "vite": "^8.2.2",
    "vitest": "^5.0.0"
  }
}
```

Copy `pnpm-workspace.yaml`, `tsconfig.json`, `vite.config.ts`, `.gitignore` from the sibling unchanged. `index.html` as the sibling with `<title>Walk-in Wardrobe Planner</title>`. `src/main.tsx` as the sibling. Placeholder `src/App.tsx`:

```tsx
export function App() {
  return <div className="app">wardrobe planner</div>;
}
```

Run `pnpm install` (copy `pnpm-lock.yaml` from the sibling first so versions resolve identically).

- [ ] **Step 2: Copy the listed modules verbatim** (`cp` each file; keep paths). In `render/svg.ts` split `drawingToSvg` so that:

```ts
export function drawingToSvgParts(d: Drawing): { viewBox: string; inner: string } {
  const b = d.bounds;
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  const out: string[] = [];
  for (const p of expandPrims(d.prims, d.textSize)) {
    const s = primToSvg(p, d.textSize);
    if (s) out.push(s);
  }
  return { viewBox: `${f(b.min.x)} ${f(-b.max.y)} ${f(w)} ${f(h)}`, inner: out.join('\n') };
}

export function drawingToSvg(d: Drawing): string {
  const { viewBox, inner } = drawingToSvgParts(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" font-family="Helvetica, Arial, sans-serif">\n<title>${esc(d.title)}</title>\n${inner}\n</svg>`;
}
```

Copy `render/svg.test.ts` and `geometry/matrix.test.ts` from the sibling; where they import project-specific modules (`../model/defaults`, `../drawing/views`, `../geometry/parts`), replace those tests with self-contained ones: `svg.test.ts` builds a Drawing via `makeDrawing('t', [rectPrim(0,0,100,50), dim(v2(0,0), v2(100,0), -30)], 10)` and asserts `<svg`, `<polygon`, `viewBox`, and that `drawingToSvgParts(d).inner` has no `<svg`; `matrix.test.ts` keeps only the `toWorld` vs three.js `Matrix4` comparison for rotations `[0,0,0]`, `[π/2,0,0]`, `[0,-π/2,0]`, `[0,π/2,0]`, `[π/2, π, 0]` (import `three` directly).

- [ ] **Step 3: i18n dictionaries.** `src/i18n/en.ts` (complete key set — copy exactly):

```ts
export const en = {
  // top bar
  'ui.tab.design': 'Design',
  'ui.tab.3d': '3D',
  'ui.tab.cutlist': 'Cut list',
  'ui.projectName': 'Project name',
  'ui.new': 'New',
  'ui.importJson': 'Import JSON',
  'ui.exportJson': 'Export JSON',
  'ui.exportPdf': 'Export PDF',
  'ui.exporting': 'Exporting...',
  'ui.confirmNew': 'Replace the current project with the defaults?',
  'ui.lang.en': 'EN',
  'ui.lang.ru': 'RU',
  'ui.undo': 'Undo',
  'ui.redo': 'Redo',
  // forms
  'ui.section.room': 'Room',
  'ui.section.door': 'Door',
  'ui.section.wardrobe': 'Wardrobe',
  'ui.width': 'Width',
  'ui.depth': 'Depth',
  'ui.height': 'Height',
  'ui.doorWall': 'Wall',
  'ui.doorOffset': 'Offset from corner',
  'ui.doorWidth': 'Opening width',
  'ui.doorHeight': 'Opening height',
  'ui.doorMargin': 'Margin beside door',
  'ui.topGap': 'Gap to ceiling',
  'ui.plinthHeight': 'Plinth height',
  'ui.panelThickness': 'Panel thickness',
  'ui.backThickness': 'Back thickness',
  // walls
  'wall.back': 'Back wall',
  'wall.right': 'Right wall',
  'wall.front': 'Front wall',
  'wall.left': 'Left wall',
  'ui.wallEnabled': 'Wardrobe on this wall',
  'ui.wallDepth': 'Unit depth',
  'ui.freeWidth': 'free {n} mm',
  'ui.segment': 'Segment {n}',
  'ui.noRoom': 'No room for units here',
  'ui.noWardrobe': 'No wardrobe on this wall',
  'ui.enableHint': 'Tick "Wardrobe on this wall" to start placing units.',
  'ui.selectHint': 'Click a wall in the plan, then a + in the elevation to place a unit.',
  'ui.spawnTitle': 'Insert here',
  'ui.spawnWidth': '{n} mm',
  // presets
  'preset.hanging': 'Long hanging',
  'preset.doubleHanging': 'Double hanging',
  'preset.shelves': 'Shelves',
  'preset.drawersHanging': 'Drawers + hanging',
  'preset.drawersShelves': 'Drawers + shelves',
  'preset.open': 'Open compartment',
  'preset.gap': 'Gap (leave empty)',
  // inspector
  'ui.column': 'Unit {n}',
  'ui.gapColumn': 'Gap {n}',
  'ui.onWall': 'on {wall}',
  'ui.moveLeft': '◀ Left',
  'ui.moveRight': 'Right ▶',
  'ui.duplicate': 'Duplicate',
  'ui.remove': 'Remove',
  'ui.interior': 'Interior {w} × {h} × {d} mm',
  'ui.zones': 'Zones (top → bottom)',
  'ui.zoneType': 'Type',
  'ui.zoneHeight': 'Height',
  'ui.auto': 'auto',
  'ui.count': 'Count',
  'ui.addZone': 'Add zone on top',
  'ui.moveUp': '▲',
  'ui.moveDown': '▼',
  'ui.zoneEffective': '{n} mm',
  'zone.open': 'Open',
  'zone.shelves': 'Shelves',
  'zone.drawers': 'Drawers',
  'zone.hanging': 'Hanging rail',
  // 3D controls
  'ui.dims': 'Dims',
  'ui.room': 'Room',
  'ui.explode': 'Explode',
  // cut list table
  'table.num': '#',
  'table.part': 'Part',
  'table.location': 'Location',
  'table.qty': 'Qty',
  'table.length': 'Length',
  'table.width': 'Width',
  'table.thk': 'Thk',
  'table.material': 'Material',
  'table.notes': 'Notes',
  'table.total': 'Total parts',
  'location.unit': '{wall} {n}',
  // parts / materials / notes
  'part.sideL': 'Side L',
  'part.sideR': 'Side R',
  'part.top': 'Top',
  'part.bottom': 'Bottom',
  'part.back': 'Back',
  'part.divider': 'Divider',
  'part.shelf': 'Shelf',
  'part.drawerFront': 'Drawer front',
  'part.plinth': 'Plinth',
  'part.rod': 'Rod',
  'material.panel': 'Panel',
  'material.back': 'Back panel',
  'material.rod': 'Rod',
  'note.rodDia': 'Ø{d} mm',
  // drawings
  'drawing.plan': 'Plan',
  'drawing.elevation': '{wall} — elevation',
  'drawing.door': 'Door {w} × {h}',
  'drawing.gap': 'gap',
  'drawing.topGap': 'ceiling gap {n}',
  'drawing.noWardrobe': 'no wardrobe',
  'drawing.wallSection': '{wall}',
  'drawing.zone': '{type} {n}',
  // pdf
  'pdf.scale': 'Scale 1:{n}',
  'pdf.defaultTitle': 'Walk-in wardrobe',
  'pdf.date': 'Date',
  'pdf.room': 'Room W × D × H',
  'pdf.door': 'Door',
  'pdf.doorValue': '{wall}, offset {offset}, {w} × {h}',
  'pdf.thickness': 'Panel / back thickness',
  'pdf.plinthHeight': 'Plinth height',
  'pdf.topGap': 'Gap to ceiling',
  'pdf.wallSummary': '{wall} (depth {depth})',
  'pdf.unitSummary': '{w} {zones}',
  'pdf.gapSummary': 'gap {w}',
  'pdf.none': '—',
  'pdf.disabled': 'no wardrobe',
  'pdf.cutList': 'Cut list',
  'pdf.cutListCont': 'Cut list (page {n})',
  'pdf.total': 'Total parts: {n}',
  'pdf.snapshotFailed': '(3D snapshot failed)',
  'pdf.snapshotMissing': '(open the 3D tab before export for a snapshot)',
  // validation
  'error.roomDims': 'Room width, depth and height must be positive',
  'error.roomHeight': 'Room is too low for plinth, ceiling gap and a unit',
  'error.doorWidth': 'Door width must be positive',
  'error.doorFits': 'Door does not fit on the {wall}',
  'error.doorHeight': 'Door height must be between 1 and the room height',
  'error.thickness': 'Panel and back thickness must be at least 1 mm',
  'error.negative': 'Plinth, ceiling gap and door margin cannot be negative',
  'error.wallDepth': '{wall}: unit depth must be at least 200 mm',
  'error.segmentOverflow': '{wall}{segment}: units exceed the available length by {n} mm',
  'error.columnWidth': '{wall}: a unit is narrower than {n} mm',
  'error.gapWidth': '{wall}: a gap must be wider than 0',
  'error.noZones': '{wall}: a unit has no zones',
  'error.zonesOverflow': '{wall}: zones of a unit exceed its interior height by {n} mm',
  'error.zoneHeight': '{wall}: a zone is lower than {n} mm',
  'error.shelfCount': '{wall}: a shelves zone needs at least 1 shelf',
  'error.drawerCount': '{wall}: a drawers zone needs at least 1 drawer',
  'error.drawerHeight': '{wall}: drawer fronts would be lower than {n} mm',
  'error.notJson': 'File is not valid JSON',
  'error.badVersion': 'Unsupported file version (expected {version})',
  'error.badShape': 'File does not contain a wardrobe project',
  'error.failsValidation': 'Project fails validation: {reason}',
  // toasts
  'toast.imported': 'Project imported',
  'toast.importFailed': 'Import failed: {error}',
  'toast.pdfFailed': 'PDF export failed: {error}',
  'toast.noRoom': 'No room for another unit on this segment',
} as const;

export type MessageKey = keyof typeof en;
```

`src/i18n/ru.ts` — `export const ru: Record<MessageKey, string> = { ... }` with the same keys, Russian text (e.g. `'ui.tab.design': 'Проект'`, `'ui.tab.cutlist': 'Раскрой'`, `'wall.back': 'Задняя стена'`, `'wall.right': 'Правая стена'`, `'wall.front': 'Передняя стена'`, `'wall.left': 'Левая стена'`, `'preset.hanging': 'Длинная штанга'`, `'preset.doubleHanging': 'Две штанги'`, `'preset.shelves': 'Полки'`, `'preset.drawersHanging': 'Ящики + штанга'`, `'preset.drawersShelves': 'Ящики + полки'`, `'preset.open': 'Открытая ниша'`, `'preset.gap': 'Пропуск (пусто)'`, `'zone.hanging': 'Штанга'`, `'ui.topGap': 'Зазор до потолка'`, `'part.divider': 'Перегородка'`, `'part.drawerFront': 'Фасад ящика'`, `'pdf.defaultTitle': 'Гардеробная'`; translate every other key sensibly, keep `{placeholders}` identical). Copy `i18n/index.ts` from the sibling as is.

`src/i18n/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ru } from './ru';
import { detectLang, msg, t, tm } from './index';

describe('i18n', () => {
  it('ru has exactly the en keys', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });
  it('placeholders match between languages', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(ru[k]), k).toEqual(ph(en[k]));
    }
  });
  it('interpolates and falls back', () => {
    expect(t('en', 'ui.freeWidth', { n: 120 })).toBe('free 120 mm');
    expect(tm('ru', msg('ui.freeWidth', { n: 5 }))).toContain('5');
    expect(detectLang('ru-RU')).toBe('ru');
    expect(detectLang(undefined)).toBe('en');
  });
});
```

- [ ] **Step 4: Verify** — `pnpm test`, `pnpm typecheck`, `pnpm build` all pass (the placeholder App builds).

---

### Task 2: Model — types, factory, presets, defaults

**Files:**
- Create: `src/model/types.ts`, `src/model/factory.ts`, `src/model/presets.ts`, `src/model/defaults.ts`, `src/model/model.test.ts`

**Interfaces (Produces):**

```ts
// types.ts — exactly as spec §2
export type Wall = 'back' | 'right' | 'front' | 'left';
export type ZoneType = 'open' | 'shelves' | 'drawers' | 'hanging';
export interface Room { width: number; depth: number; height: number }
export interface Door { wall: Wall; offset: number; width: number; height: number }
export interface Zone { id: string; type: ZoneType; height: number | null; count: number }
export interface Unit { id: string; kind: 'unit'; width: number; zones: Zone[] }
export interface Gap { id: string; kind: 'gap'; width: number }
export type Column = Unit | Gap;
export interface WallPlan { enabled: boolean; depth: number; segments: [Column[], Column[]] }
export interface Wardrobe { panelThickness: number; backThickness: number; plinthHeight: number; topGap: number; doorMargin: number; walls: Record<Wall, WallPlan> }
export interface Project { name: string; room: Room; door: Door; wardrobe: Wardrobe }
export interface ValidationError { path: string; message: Msg }   // Msg from '../i18n'

// factory.ts
export function newId(prefix: string): string;              // `${prefix}${Date.now().toString(36)}-${seq}`
export function makeZone(type: ZoneType, height: number | null = null, count = 1): Zone;
export function makeUnit(width: number, zones: Zone[]): Unit;
export function makeGap(width: number): Gap;
export function cloneColumn(c: Column): Column;              // fresh ids for column and zones

// presets.ts
export type PresetKey = 'hanging' | 'doubleHanging' | 'shelves' | 'drawersHanging' | 'drawersShelves' | 'open' | 'gap';
export const PRESET_KEYS: PresetKey[];                       // in the table order of spec §2.6
export const PRESET_DEFAULT_WIDTH = 600;
export const GAP_DEFAULT_WIDTH = 300;
export function makePreset(key: PresetKey, width: number): Column;

// defaults.ts
export function emptyWall(depth: number, enabled: boolean): WallPlan;
export function defaultProject(): Project;                   // spec §2.7
```

- [ ] **Step 1: Test** `src/model/model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makePreset, PRESET_KEYS } from './presets';
import { defaultProject } from './defaults';
import { cloneColumn, makeUnit, makeZone } from './factory';

describe('presets', () => {
  it('every preset builds a column of the requested width', () => {
    for (const k of PRESET_KEYS) {
      const c = makePreset(k, 555);
      expect(c.width).toBe(555);
      if (k === 'gap') expect(c.kind).toBe('gap');
      else expect(c.kind === 'unit' && c.zones.length > 0).toBe(true);
    }
  });
  it('drawersHanging = fixed drawers zone under an auto hanging zone', () => {
    const c = makePreset('drawersHanging', 600);
    expect(c.kind === 'unit' && c.zones.map((z) => [z.type, z.height, z.count])).toEqual([['drawers', 600, 3], ['hanging', null, 1]]);
  });
});

describe('defaults', () => {
  it('matches the spec sample', () => {
    const p = defaultProject();
    expect(p.room).toEqual({ width: 2400, depth: 2000, height: 2500 });
    expect(p.door).toEqual({ wall: 'front', offset: 800, width: 800, height: 2100 });
    expect(p.wardrobe.topGap).toBe(150);
    expect(p.wardrobe.walls.back.segments[0].map((c) => c.width)).toEqual([600, 600, 600, 600]);
    expect(p.wardrobe.walls.right.segments[0][0].kind).toBe('gap');
    expect(p.wardrobe.walls.front.enabled).toBe(false);
    const ids = new Set<string>();
    for (const w of Object.values(p.wardrobe.walls)) for (const seg of w.segments) for (const c of seg) {
      expect(ids.has(c.id)).toBe(false); ids.add(c.id);
      if (c.kind === 'unit') for (const z of c.zones) { expect(ids.has(z.id)).toBe(false); ids.add(z.id); }
    }
  });
});

describe('factory', () => {
  it('cloneColumn gives fresh ids', () => {
    const u = makeUnit(500, [makeZone('shelves', null, 3)]);
    const c = cloneColumn(u);
    expect(c.id).not.toBe(u.id);
    expect(c.kind === 'unit' && c.zones[0].id).not.toBe(u.zones[0].id);
    expect(c.kind === 'unit' && c.zones[0].count).toBe(3);
  });
});
```

- [ ] **Step 2: Run** `pnpm test src/model` → fails (modules missing).
- [ ] **Step 3: Implement** the four modules. `makePreset`:

```ts
const Z = makeZone;
export function makePreset(key: PresetKey, width: number): Column {
  switch (key) {
    case 'hanging': return makeUnit(width, [Z('hanging')]);
    case 'doubleHanging': return makeUnit(width, [Z('hanging'), Z('hanging')]);
    case 'shelves': return makeUnit(width, [Z('shelves', null, 5)]);
    case 'drawersHanging': return makeUnit(width, [Z('drawers', 600, 3), Z('hanging')]);
    case 'drawersShelves': return makeUnit(width, [Z('drawers', 800, 4), Z('shelves', null, 3)]);
    case 'open': return makeUnit(width, [Z('open')]);
    case 'gap': return makeGap(width);
  }
}
```

`defaultProject()` builds walls with `makePreset` per spec §2.7: back `[drawersHanging 600, doubleHanging 600, shelves 600, drawersShelves 600]`, left `[doubleHanging 700, shelves 700]`, right `[gap 300, hanging 500, shelves 600]`, front disabled depth 400 `[]`; `segments[1]` empty everywhere; name `'Walk-in wardrobe'`.

- [ ] **Step 4: Run** tests → pass; `pnpm typecheck`.

---

### Task 3: Geometry — wall frames, door span, segments

**Files:**
- Create: `src/geometry/frames.ts`, `src/geometry/frames.test.ts`

**Interfaces:**
- Consumes: `Project, Wall, Room, Wardrobe` (Task 2), `Vec3, Transform, rotY, v3` from `vec.ts`.
- Produces:

```ts
export const WALLS: Wall[] = ['back', 'right', 'front', 'left'];
export interface Frame { origin: Vec3; yaw: number }
export function wallLength(room: Room, wall: Wall): number;          // width for back/front, depth for left/right
export function wallFrame(room: Room, wall: Wall): Frame;            // spec §2.1 table
export function localToWorld(f: Frame, p: Vec3): Vec3;               // origin + rotY(yaw)(p)
export function frameTransform(f: Frame, t: Transform): Transform;   // { position: localToWorld(f, t.position), rotation: (rx, ry + yaw, 0) }
export function leftOf(wall: Wall): Wall;                            // back→left, right→back, front→right, left→front
export function rightOf(wall: Wall): Wall;                           // back→right, right→front, front→left, left→back
export function isSideWall(wall: Wall): boolean;                     // left | right
export interface DoorSpan { wall: Wall; s0: number; s1: number }
export function doorSpan(p: Project): DoorSpan;                      // spec §2.1 last paragraph
export function minUnitWidth(w: Wardrobe): number;                   // 2 * panelThickness + 100
export interface Segment { wall: Wall; index: 0 | 1; s0: number; s1: number }
export function wallSegments(p: Project, wall: Wall): Segment[];     // spec §2.2 (ignores `enabled` of `wall` itself)
export function cornerClaim(p: Project, wall: Wall, side: 'start' | 'end'): number;
export function segmentUsed(p: Project, seg: Segment): number;       // Σ widths of columns in walls[wall].segments[index]
export function segmentFree(p: Project, seg: Segment): number;       // (s1 - s0) - used
```

- [ ] **Step 1: Test** `frames.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { v3 } from './vec';
import { cornerClaim, doorSpan, frameTransform, localToWorld, wallFrame, wallLength, wallSegments, segmentFree } from './frames';

const room = { width: 2400, depth: 2000, height: 2500 };
const near = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6); expect(a.y).toBeCloseTo(b.y, 6); expect(a.z).toBeCloseTo(b.z, 6);
};

describe('wall frames', () => {
  it('maps local (s, y, z) to world per the spec table', () => {
    const p = v3(100, 50, 30);
    near(localToWorld(wallFrame(room, 'back'), p), v3(100, 50, 30));
    near(localToWorld(wallFrame(room, 'right'), p), v3(2400 - 30, 50, 100));
    near(localToWorld(wallFrame(room, 'front'), p), v3(2400 - 100, 50, 2000 - 30));
    near(localToWorld(wallFrame(room, 'left'), p), v3(30, 50, 2000 - 100));
  });
  it('wall lengths', () => {
    expect(wallLength(room, 'back')).toBe(2400);
    expect(wallLength(room, 'left')).toBe(2000);
  });
  it('frameTransform adds yaw to ry and moves the position', () => {
    const t = frameTransform(wallFrame(room, 'right'), { position: v3(10, 0, 0), rotation: v3(Math.PI / 2, 0, 0) });
    near(t.position, v3(2400, 0, 10));
    expect(t.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(t.rotation.x).toBeCloseTo(Math.PI / 2);
  });
});

describe('door span', () => {
  const base = defaultProject();
  it('front wall is mirrored', () => {
    expect(doorSpan(base)).toEqual({ wall: 'front', s0: 2400 - 800 - 800, s1: 2400 - 800 });
  });
  it('back and right walls are direct, left is mirrored', () => {
    expect(doorSpan({ ...base, door: { ...base.door, wall: 'back' } })).toEqual({ wall: 'back', s0: 800, s1: 1600 });
    expect(doorSpan({ ...base, door: { ...base.door, wall: 'right' } })).toEqual({ wall: 'right', s0: 800, s1: 1600 });
    expect(doorSpan({ ...base, door: { ...base.door, wall: 'left' } })).toEqual({ wall: 'left', s0: 2000 - 1600, s1: 2000 - 800 });
  });
});

describe('segments', () => {
  const p = defaultProject(); // back+left+right enabled, front disabled, door on front
  it('back wall runs full length', () => {
    expect(wallSegments(p, 'back')).toEqual([{ wall: 'back', index: 0, s0: 0, s1: 2400 }]);
  });
  it('side walls give way to the back wall only', () => {
    expect(wallSegments(p, 'left')).toEqual([{ wall: 'left', index: 0, s0: 0, s1: 2000 - 600 }]);   // back corner is on the viewer's right
    expect(wallSegments(p, 'right')).toEqual([{ wall: 'right', index: 0, s0: 600, s1: 2000 }]);    // back corner is on the viewer's left
  });
  it('front wall (disabled here) with the door splits into two segments with margins', () => {
    expect(wallSegments(p, 'front')).toEqual([
      { wall: 'front', index: 0, s0: 0, s1: 800 - 80 },
      { wall: 'front', index: 1, s0: 1600 + 80, s1: 2400 },
    ]);
  });
  it('enabling the front wall claims the side walls\' front corners', () => {
    const q = { ...p, wardrobe: { ...p.wardrobe, walls: { ...p.wardrobe.walls, front: { ...p.wardrobe.walls.front, enabled: true } } } };
    expect(wallSegments(q, 'left')[0]).toEqual({ wall: 'left', index: 0, s0: 400, s1: 1400 });
    expect(cornerClaim(q, 'right', 'end')).toBe(400);
  });
  it('a door in the back-left corner removes that claim', () => {
    const q = { ...p, door: { ...p.door, wall: 'back' as const, offset: 0 } };
    expect(cornerClaim(q, 'left', 'end')).toBe(0);
    expect(cornerClaim(q, 'right', 'start')).toBe(600);
  });
  it('disabled neighbour claims nothing', () => {
    const q = { ...p, wardrobe: { ...p.wardrobe, walls: { ...p.wardrobe.walls, back: { ...p.wardrobe.walls.back, enabled: false } } } };
    expect(wallSegments(q, 'left')[0].s1).toBe(2000);
  });
  it('segmentFree', () => {
    expect(segmentFree(p, wallSegments(p, 'back')[0])).toBe(0);
    expect(segmentFree(p, wallSegments(p, 'left')[0])).toBe(0);
    expect(segmentFree(p, wallSegments(p, 'right')[0])).toBe(0);
  });
});
```

- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement** `frames.ts`:

```ts
import type { Project, Room, Wall, Wardrobe, Segment as _S } from '../model/types'; // (define Segment here, not in types)
import { rotY, v3, type Transform, type Vec3 } from './vec';

export const WALLS: Wall[] = ['back', 'right', 'front', 'left'];
export interface Frame { origin: Vec3; yaw: number }

export function wallLength(room: Room, wall: Wall): number {
  return wall === 'back' || wall === 'front' ? room.width : room.depth;
}
export function wallFrame(room: Room, wall: Wall): Frame {
  const { width: W, depth: D } = room;
  switch (wall) {
    case 'back': return { origin: v3(0, 0, 0), yaw: 0 };
    case 'right': return { origin: v3(W, 0, 0), yaw: -Math.PI / 2 };
    case 'front': return { origin: v3(W, 0, D), yaw: Math.PI };
    case 'left': return { origin: v3(0, 0, D), yaw: Math.PI / 2 };
  }
}
export function localToWorld(f: Frame, p: Vec3): Vec3 {
  const r = rotY(p, f.yaw);
  return v3(r.x + f.origin.x, r.y + f.origin.y, r.z + f.origin.z);
}
export function frameTransform(f: Frame, t: Transform): Transform {
  return { position: localToWorld(f, t.position), rotation: v3(t.rotation.x, t.rotation.y + f.yaw, 0) };
}
export const leftOf = (w: Wall): Wall => WALLS[(WALLS.indexOf(w) + 3) % 4];
export const rightOf = (w: Wall): Wall => WALLS[(WALLS.indexOf(w) + 1) % 4];
export const isSideWall = (w: Wall) => w === 'left' || w === 'right';

export interface DoorSpan { wall: Wall; s0: number; s1: number }
export function doorSpan(p: Project): DoorSpan {
  const { wall, offset, width } = p.door;
  const L = wallLength(p.room, wall);
  const mirrored = wall === 'front' || wall === 'left';
  return mirrored ? { wall, s0: L - offset - width, s1: L - offset } : { wall, s0: offset, s1: offset + width };
}
export const minUnitWidth = (w: Wardrobe) => 2 * w.panelThickness + 100;

export interface Segment { wall: Wall; index: 0 | 1; s0: number; s1: number }

function rawSegments(p: Project, wall: Wall, claimStart: number, claimEnd: number): Segment[] {
  const L = wallLength(p.room, wall);
  const d = doorSpan(p);
  if (d.wall !== wall) return [{ wall, index: 0, s0: claimStart, s1: L - claimEnd }];
  const m = p.wardrobe.doorMargin;
  return [
    { wall, index: 0, s0: claimStart, s1: d.s0 - m },
    { wall, index: 1, s0: d.s1 + m, s1: L - claimEnd },
  ];
}

export function cornerClaim(p: Project, wall: Wall, side: 'start' | 'end'): number {
  if (!isSideWall(wall)) return 0;
  const n = side === 'start' ? leftOf(wall) : rightOf(wall);
  const plan = p.wardrobe.walls[n];
  if (!plan.enabled) return 0;
  const segs = rawSegments(p, n, 0, 0);
  const touching = side === 'start' ? segs[segs.length - 1] : segs[0]; // our start corner = neighbour's end corner and vice versa
  return touching.s1 - touching.s0 >= minUnitWidth(p.wardrobe) ? plan.depth : 0;
}

export function wallSegments(p: Project, wall: Wall): Segment[] {
  return rawSegments(p, wall, cornerClaim(p, wall, 'start'), cornerClaim(p, wall, 'end'));
}
export function segmentUsed(p: Project, seg: Segment): number {
  return p.wardrobe.walls[seg.wall].segments[seg.index].reduce((s, c) => s + c.width, 0);
}
export function segmentFree(p: Project, seg: Segment): number {
  return seg.s1 - seg.s0 - segmentUsed(p, seg);
}
```
(Drop the bogus `Segment as _S` import — `Segment` is defined in this file.)

- [ ] **Step 4: Run** → pass; typecheck.

---

### Task 4: Geometry — unit/zone layout

**Files:**
- Create: `src/geometry/layout.ts`, `src/geometry/layout.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `wallSegments` (Task 3).
- Produces:

```ts
export const SHELF_SETBACK = 20, REVEAL = 2, DRAWER_GAP = 3, ROD_DROP = 80, ROD_DIAMETER = 25, PLINTH_SETBACK = 40, MIN_ZONE_HEIGHT = 100, MIN_DRAWER_FRONT = 80;
export interface Heights { carcassHeight: number; interiorHeight: number; floorY: number; topY: number } // floorY = plinth + t (bottom panel top), topY = room.height - topGap
export function heights(p: Project): Heights;
export function zoneHeights(unit: Unit, interiorHeight: number, t: number): { heights: number[]; leftover: number };
   // heights[k] = effective clear height of zone k (auto zones share leftover; if no auto zone the top zone absorbs it); leftover = interiorHeight - Σfixed - (n-1)*t (may be negative; then auto zones get max(0, share) and heights of fixed zones are as stated)
export interface DrawerFront { y0: number; y1: number }   // absolute Y
export interface ZoneLayout { zone: Zone; index: number; yBot: number; yTop: number; height: number; shelfYs: number[] /* absolute underside Y */; drawerFronts: DrawerFront[]; frontW: number; frontH: number; rodY: number | null }
export interface UnitLayout { kind: 'unit'; unit: Unit; wall: Wall; segment: 0 | 1; columnIndex: number; s0: number; s1: number; width: number; depth: number; carcassHeight: number; interiorWidth: number; interiorDepth: number; interiorHeight: number; floorY: number; topY: number; zones: ZoneLayout[]; dividerYs: number[] /* absolute top-surface Y of each divider between zones */; leftover: number }
export interface GapLayout { kind: 'gap'; gap: Gap; wall: Wall; segment: 0 | 1; columnIndex: number; s0: number; s1: number; width: number }
export type ColumnLayout = UnitLayout | GapLayout;
export function layoutUnit(p: Project, wall: Wall, segment: 0 | 1, columnIndex: number, unit: Unit, s0: number): UnitLayout;
export function layoutWall(p: Project, wall: Wall): ColumnLayout[];   // [] when the wall is disabled; columnIndex counts across both segments (0-based)
export function layoutAll(p: Project): ColumnLayout[];                // WALLS order
```

- [ ] **Step 1: Test** `layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { makeUnit, makeZone } from '../model/factory';
import { heights, layoutAll, layoutUnit, layoutWall, zoneHeights } from './layout';

const p = defaultProject(); // t 18, plinth 100, topGap 150, height 2500 → carcass 2250, interior 2214

describe('heights', () => {
  it('carcass and interior', () => {
    expect(heights(p)).toEqual({ carcassHeight: 2250, interiorHeight: 2214, floorY: 118, topY: 2350 });
  });
});

describe('zoneHeights', () => {
  it('auto zones share leftover', () => {
    const u = makeUnit(600, [makeZone('drawers', 600, 3), makeZone('hanging'), makeZone('hanging')]);
    const r = zoneHeights(u, 2214, 18);
    expect(r.leftover).toBe(2214 - 600 - 36);
    expect(r.heights).toEqual([600, 789, 789]);
  });
  it('top zone absorbs leftover when nothing is auto', () => {
    const u = makeUnit(600, [makeZone('drawers', 600, 3), makeZone('open', 500)]);
    expect(zoneHeights(u, 2214, 18).heights).toEqual([600, 500 + 2214 - 1100 - 18]);
  });
  it('negative leftover is reported', () => {
    const u = makeUnit(600, [makeZone('drawers', 2000, 3), makeZone('open', 500)]);
    expect(zoneHeights(u, 2214, 18).leftover).toBeLessThan(0);
  });
});

describe('layoutUnit', () => {
  it('stacks zones with dividers and places content', () => {
    const u = makeUnit(600, [makeZone('drawers', 600, 3), makeZone('shelves', null, 2), makeZone('hanging', 900)]);
    const L = layoutUnit(p, 'back', 0, 0, u, 100);
    expect(L.s1).toBe(700);
    expect(L.interiorWidth).toBe(564);
    expect(L.interiorDepth).toBe(596);
    const [d, s, h] = L.zones;
    expect(d.yBot).toBe(118); expect(d.yTop).toBe(718);
    expect(L.dividerYs).toEqual([736, 736 + s.height + 18]);
    expect(s.yBot).toBe(736);
    expect(h.yTop).toBeCloseTo(2350 - 18);
    expect(h.rodY).toBeCloseTo(2332 - 80);
    // drawers: 3 fronts, reveal 2, gap 3
    expect(d.frontH).toBeCloseTo((600 - 4 - 6) / 3);
    expect(d.drawerFronts[0].y0).toBe(120);
    expect(d.drawerFronts[2].y1).toBeCloseTo(716);
    expect(d.frontW).toBe(560);
    // shelves: 2 shelves, 3 equal openings
    const opening = (s.height - 36) / 3;
    expect(s.shelfYs).toEqual([s.yBot + opening, s.yBot + 2 * opening + 18]);
  });
});

describe('layoutWall / layoutAll', () => {
  it('places columns from the segment start and skips disabled walls', () => {
    const right = layoutWall(p, 'right');
    expect(right.map((c) => [c.kind, c.s0, c.s1, c.columnIndex])).toEqual([['gap', 600, 900, 0], ['unit', 900, 1400, 1], ['unit', 1400, 2000, 2]]);
    expect(layoutWall(p, 'front')).toEqual([]);
    expect(layoutAll(p).length).toBe(4 + 2 + 3);
  });
  it('counts columnIndex across both segments of a door wall', () => {
    const q = structuredClone(p);
    q.door = { wall: 'back', offset: 1000, width: 800, height: 2100 };
    q.wardrobe.walls.back.segments = [[makeUnit(500, [makeZone('open')])], [makeUnit(500, [makeZone('open')])]];
    expect(layoutWall(q, 'back').map((c) => [c.segment, c.columnIndex, c.s0])).toEqual([[0, 0, 0], [1, 1, 1880]]);
  });
});
```

- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement** `layout.ts` (core):

```ts
export function heights(p: Project): Heights {
  const t = p.wardrobe.panelThickness;
  const topY = p.room.height - p.wardrobe.topGap;
  const carcassHeight = topY - p.wardrobe.plinthHeight;
  return { carcassHeight, interiorHeight: carcassHeight - 2 * t, floorY: p.wardrobe.plinthHeight + t, topY };
}

export function zoneHeights(unit: Unit, interiorHeight: number, t: number) {
  const n = unit.zones.length;
  const fixed = unit.zones.reduce((s, z) => s + (z.height ?? 0), 0);
  const autos = unit.zones.filter((z) => z.height === null).length;
  const leftover = interiorHeight - fixed - Math.max(0, n - 1) * t;
  const share = autos > 0 ? Math.max(0, leftover) / autos : 0;
  const heights = unit.zones.map((z, i) => {
    if (z.height === null) return share;
    if (autos === 0 && i === n - 1) return z.height + leftover;
    return z.height;
  });
  return { heights, leftover };
}

export function layoutUnit(p: Project, wall: Wall, segment: 0 | 1, columnIndex: number, unit: Unit, s0: number): UnitLayout {
  const w = p.wardrobe, t = w.panelThickness;
  const H = heights(p);
  const depth = w.walls[wall].depth;
  const interiorWidth = unit.width - 2 * t;
  const interiorDepth = depth - w.backThickness;
  const { heights: zh, leftover } = zoneHeights(unit, H.interiorHeight, t);
  const zones: ZoneLayout[] = [];
  const dividerYs: number[] = [];
  let y = H.floorY;
  unit.zones.forEach((zone, index) => {
    const height = zh[index];
    const yBot = y, yTop = y + height;
    const zl: ZoneLayout = { zone, index, yBot, yTop, height, shelfYs: [], drawerFronts: [], frontW: interiorWidth - 2 * REVEAL, frontH: 0, rodY: null };
    if (zone.type === 'shelves' && zone.count >= 1) {
      const opening = (height - zone.count * t) / (zone.count + 1);
      for (let k = 1; k <= zone.count; k++) zl.shelfYs.push(yBot + k * opening + (k - 1) * t);
    } else if (zone.type === 'drawers' && zone.count >= 1) {
      zl.frontH = (height - 2 * REVEAL - DRAWER_GAP * (zone.count - 1)) / zone.count;
      for (let k = 0; k < zone.count; k++) {
        const y0 = yBot + REVEAL + k * (zl.frontH + DRAWER_GAP);
        zl.drawerFronts.push({ y0, y1: y0 + zl.frontH });
      }
    } else if (zone.type === 'hanging') {
      zl.rodY = yTop - ROD_DROP;
    }
    zones.push(zl);
    if (index < unit.zones.length - 1) { dividerYs.push(yTop + t); y = yTop + t; }
  });
  return { kind: 'unit', unit, wall, segment, columnIndex, s0, s1: s0 + unit.width, width: unit.width, depth, carcassHeight: H.carcassHeight, interiorWidth, interiorDepth, interiorHeight: H.interiorHeight, floorY: H.floorY, topY: H.topY, zones, dividerYs, leftover };
}

export function layoutWall(p: Project, wall: Wall): ColumnLayout[] {
  const plan = p.wardrobe.walls[wall];
  if (!plan.enabled) return [];
  const out: ColumnLayout[] = [];
  let columnIndex = 0;
  for (const seg of wallSegments(p, wall)) {
    let s = seg.s0;
    for (const c of plan.segments[seg.index]) {
      if (c.kind === 'unit') out.push(layoutUnit(p, wall, seg.index, columnIndex, c, s));
      else out.push({ kind: 'gap', gap: c, wall, segment: seg.index, columnIndex, s0: s, s1: s + c.width, width: c.width });
      s += c.width; columnIndex += 1;
    }
  }
  return out;
}
export const layoutAll = (p: Project) => WALLS.flatMap((w) => layoutWall(p, w));
```
Note `dividerYs` must hold the divider **top surface** (`yTop + t`); the test expects `736` for the first divider (718 + 18). The shelf `k` underside formula: `yBot + k·opening + (k−1)·t`.

- [ ] **Step 4: Run** → pass; typecheck.

---

### Task 5: Validation

**Files:**
- Create: `src/model/validate.ts`, `src/model/validate.test.ts`

**Interfaces:**
- Consumes: types, `wallLength, doorSpan, wallSegments, minUnitWidth, WALLS, segmentUsed` (Task 3), `heights, zoneHeights, MIN_ZONE_HEIGHT, MIN_DRAWER_FRONT, REVEAL, DRAWER_GAP` (Task 4), `msg` (i18n).
- Produces: `validate(p: Project): ValidationError[]` implementing spec §2.5 with the `error.*` keys from Task 1. `{wall}` params carry the **translated wall name is not available here** — pass `wall: msg key`? No: pass `wall` as the raw `Wall` id and let the UI translate? Simpler and consistent: params are plain values, so pass `wall: WALL_NAME_EN[wall]`… **Decision:** `ValidationError.message.params.wall` holds the i18n key `wall.<wall>`; `tm()` cannot nest, so add to `src/i18n/index.ts` a helper `tmDeep(lang, m)` that, for params whose value is a string starting with `wall.`, replaces it with `t(lang, value)` first. Export it and use it everywhere errors are displayed (Inspector, persist error text). Also add `segment` param `''` or `' / segment 2'` literal → use `segment: ' #2'` for index 1, `''` for index 0.

- [ ] **Step 1: Test** `validate.test.ts` (each case builds from `defaultProject()` via `structuredClone`, expects `validate(q).some(e => e.message.key === '<key>')`; also `validate(defaultProject())` is `[]`): cases for `error.roomDims` (width 0), `error.roomHeight` (height 300), `error.doorFits` (offset 2000), `error.doorHeight` (0), `error.wallDepth` (back depth 100), `error.segmentOverflow` (back: push a 600 unit → 600 over), `error.columnWidth` (unit width 100), `error.gapWidth` (gap 0), `error.noZones`, `error.zonesOverflow` (drawers 3000 fixed), `error.zoneHeight` (fixed 50 zone), `error.shelfCount` (0), `error.drawerCount` (0), `error.drawerHeight` (drawers 200 high with count 3 → frontH < 80); a disabled front wall with an overflowing unit is still reported (`error.segmentOverflow` with wall 'wall.front'); `tmDeep('en', err.message)` renders `Back wall` inside the text.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement.** Skeleton:

```ts
export function validate(p: Project): ValidationError[] {
  const errs: ValidationError[] = [];
  const push = (path: string, key: MessageKey, params?: Params) => errs.push({ path, message: msg(key, params) });
  const w = p.wardrobe, t = w.panelThickness;
  if (!(p.room.width > 0 && p.room.depth > 0 && p.room.height > 0)) push('room', 'error.roomDims');
  if (!(t >= 1 && w.backThickness >= 1)) push('wardrobe.panelThickness', 'error.thickness');
  if (w.plinthHeight < 0 || w.topGap < 0 || w.doorMargin < 0) push('wardrobe', 'error.negative');
  if (p.room.height < w.plinthHeight + w.topGap + 2 * t + MIN_ZONE_HEIGHT) push('room.height', 'error.roomHeight');
  if (!(p.door.width > 0)) push('door.width', 'error.doorWidth');
  if (p.door.offset < 0 || p.door.offset + p.door.width > wallLength(p.room, p.door.wall)) push('door.offset', 'error.doorFits', { wall: `wall.${p.door.wall}` });
  if (!(p.door.height > 0 && p.door.height <= p.room.height)) push('door.height', 'error.doorHeight');
  const H = heights(p);
  for (const wall of WALLS) {
    const plan = w.walls[wall];
    const W = { wall: `wall.${wall}` };
    if (plan.depth < 200) push(`walls.${wall}.depth`, 'error.wallDepth', W);
    const segs = wallSegments(p, wall);
    segs.forEach((seg) => {
      const over = segmentUsed(p, seg) - (seg.s1 - seg.s0);
      if (over > 0 && plan.segments[seg.index].length > 0) push(`walls.${wall}.segments.${seg.index}`, 'error.segmentOverflow', { ...W, segment: seg.index === 1 ? ' #2' : '', n: Math.round(over) });
    });
    plan.segments.forEach((cols, si) => cols.forEach((c, ci) => {
      const path = `walls.${wall}.segments.${si}.${ci}`;
      if (c.kind === 'gap') { if (!(c.width > 0)) push(path, 'error.gapWidth', W); return; }
      if (c.width < minUnitWidth(w)) push(path, 'error.columnWidth', { ...W, n: minUnitWidth(w) });
      if (c.zones.length === 0) { push(path, 'error.noZones', W); return; }
      const { heights: zh, leftover } = zoneHeights(c, H.interiorHeight, t);
      if (leftover < 0) push(path, 'error.zonesOverflow', { ...W, n: Math.round(-leftover) });
      c.zones.forEach((z, zi) => {
        const zp = `${path}.zones.${zi}`;
        if (zh[zi] < MIN_ZONE_HEIGHT) push(zp, 'error.zoneHeight', { ...W, n: MIN_ZONE_HEIGHT });
        if (z.type === 'shelves' && z.count < 1) push(zp, 'error.shelfCount', W);
        if (z.type === 'drawers') {
          if (z.count < 1) push(zp, 'error.drawerCount', W);
          else if ((zh[zi] - 2 * REVEAL - DRAWER_GAP * (z.count - 1)) / z.count < MIN_DRAWER_FRONT) push(zp, 'error.drawerHeight', { ...W, n: MIN_DRAWER_FRONT });
        }
      });
    }));
  }
  return errs;
}
```
`tmDeep` in `i18n/index.ts`:

```ts
export function tmDeep(lang: Lang, m: Msg): string {
  if (!m.params) return t(lang, m.key);
  const params: Params = {};
  for (const [k, v] of Object.entries(m.params)) params[k] = typeof v === 'string' && v.startsWith('wall.') ? t(lang, v as MessageKey) : v;
  return t(lang, m.key, params);
}
```
Also change `ru.ts`/`en.ts` nothing. Note `error.segmentOverflow` text uses `{wall}{segment}`.

- [ ] **Step 4: Run** → pass; typecheck.

---

### Task 6: Parts builder

**Files:**
- Create: `src/geometry/parts.ts`, `src/geometry/parts.test.ts`

**Interfaces:**
- Consumes: `layoutAll, UnitLayout, constants` (Task 4), `wallFrame, frameTransform` (Task 3), vec helpers.
- Produces:

```ts
export type PartKind = 'side' | 'top' | 'bottom' | 'back' | 'divider' | 'shelf' | 'drawerFront' | 'plinth' | 'rod';
export type PartNameKey = 'sideL' | 'sideR' | 'top' | 'bottom' | 'back' | 'divider' | 'shelf' | 'drawerFront' | 'plinth' | 'rod';
export type Material = 'panel' | 'back' | 'rod';
export interface Part { id: string; wall: Wall; columnIndex: number; unitId: string; nameKey: PartNameKey; index?: number; kind: PartKind; outline: Vec2[]; thickness: number; transform: Transform; material: Material; notes?: Msg[] }
export function rect(w: number, h: number): Vec2[];
export function circle(r: number, n: number): Vec2[];
export function partBounds(part: Part): Box3;                 // world AABB (as sibling)
export function buildUnitParts(L: UnitLayout, p: Project): Part[];   // local (wall) coordinates, transforms NOT yet framed
export function buildParts(p: Project): Part[];               // all enabled walls, transforms mapped through the wall frame
```

- [ ] **Step 1: Test** `parts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { makeUnit, makeZone } from '../model/factory';
import { layoutUnit } from './layout';
import { buildParts, buildUnitParts, partBounds } from './parts';

const p = defaultProject();

describe('buildUnitParts', () => {
  it('produces carcass + content for a drawers/shelves/hanging unit', () => {
    const u = makeUnit(600, [makeZone('drawers', 600, 3), makeZone('shelves', null, 2), makeZone('hanging')]);
    const parts = buildUnitParts(layoutUnit(p, 'back', 0, 0, u, 0), p);
    const kinds = parts.map((x) => x.kind);
    const count = (k: string) => kinds.filter((x) => x === k).length;
    expect(count('side')).toBe(2); expect(count('top')).toBe(1); expect(count('bottom')).toBe(1);
    expect(count('back')).toBe(1); expect(count('plinth')).toBe(1);
    expect(count('divider')).toBe(2); expect(count('shelf')).toBe(2);
    expect(count('drawerFront')).toBe(3); expect(count('rod')).toBe(1);
    const side = parts.find((x) => x.nameKey === 'sideL')!;
    const b = partBounds(side);
    expect(b.min.x).toBeCloseTo(0); expect(b.max.x).toBeCloseTo(18);
    expect(b.min.y).toBeCloseTo(100); expect(b.max.y).toBeCloseTo(2350);
    expect(b.min.z).toBeCloseTo(0); expect(b.max.z).toBeCloseTo(600);
    const front = parts.find((x) => x.kind === 'drawerFront')!;
    const fb = partBounds(front);
    expect(fb.min.z).toBeCloseTo(600 - 18); expect(fb.max.z).toBeCloseTo(600);
    expect(fb.min.x).toBeCloseTo(20); expect(fb.max.x).toBeCloseTo(580);
    const rod = parts.find((x) => x.kind === 'rod')!;
    const rb = partBounds(rod);
    expect(rb.min.x).toBeCloseTo(18); expect(rb.max.x).toBeCloseTo(582);
    expect(rb.min.z).toBeCloseTo(298 - 12.5, 0); // interiorDepth/2 = 298
    const shelf = parts.find((x) => x.kind === 'shelf')!;
    const sb = partBounds(shelf);
    expect(sb.min.z).toBeCloseTo(4); expect(sb.max.z).toBeCloseTo(580);
  });
});

describe('buildParts', () => {
  it('keeps every part inside the room and on its wall', () => {
    const parts = buildParts(p);
    expect(parts.length).toBeGreaterThan(50);
    for (const part of parts) {
      const b = partBounds(part);
      expect(b.min.x).toBeGreaterThanOrEqual(-1e-6); expect(b.max.x).toBeLessThanOrEqual(2400 + 1e-6);
      expect(b.min.z).toBeGreaterThanOrEqual(-1e-6); expect(b.max.z).toBeLessThanOrEqual(2000 + 1e-6);
      expect(b.max.y).toBeLessThanOrEqual(2350 + 1e-6);
      if (part.wall === 'left') expect(b.max.x).toBeLessThanOrEqual(600 + 1e-6);
      if (part.wall === 'right') expect(b.min.x).toBeGreaterThanOrEqual(2400 - 600 - 1e-6);
      if (part.wall === 'back') expect(b.max.z).toBeLessThanOrEqual(600 + 1e-6);
    }
    expect(parts.some((x) => x.wall === 'front')).toBe(false);
  });
  it('gap columns produce no parts and column indexes are per wall', () => {
    const right = buildParts(p).filter((x) => x.wall === 'right');
    expect(new Set(right.map((x) => x.columnIndex))).toEqual(new Set([1, 2]));
  });
});
```

- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement** — follow spec §3.1 exactly. Core of `buildUnitParts`:

```ts
export function buildUnitParts(L: UnitLayout, p: Project): Part[] {
  const w = p.wardrobe, t = w.panelThickness, plinth = w.plinthHeight;
  const { s0, width: cw, depth, interiorWidth: iw, interiorDepth: id, carcassHeight: ch, interiorHeight: ih, floorY } = L;
  const parts: Part[] = [];
  const add = (key: string, nameKey: PartNameKey, kind: PartKind, outline: Vec2[], thickness: number, position: Vec3, rotation: Vec3, material: Material = 'panel', notes?: Msg[], index?: number) =>
    parts.push({ id: `${L.wall}-${L.columnIndex}-${key}`, wall: L.wall, columnIndex: L.columnIndex, unitId: L.unit.id, nameKey, index, kind, outline, thickness, transform: { position, rotation }, material, notes });
  add('sideL', 'sideL', 'side', rect(depth, ch), t, v3(s0 + t, plinth, 0), SIDE_ROT);
  add('sideR', 'sideR', 'side', rect(depth, ch), t, v3(s0 + cw, plinth, 0), SIDE_ROT);
  add('bottom', 'bottom', 'bottom', rect(iw, depth), t, v3(s0 + t, floorY, 0), FLAT_ROT);
  add('top', 'top', 'top', rect(iw, depth), t, v3(s0 + t, plinth + ch, 0), FLAT_ROT);
  add('back', 'back', 'back', rect(iw, ih), w.backThickness, v3(s0 + t, floorY, 0), NO_ROT, 'back');
  L.dividerYs.forEach((y, k) => add(`divider${k + 1}`, 'divider', 'divider', rect(iw, id), t, v3(s0 + t, y, w.backThickness), FLAT_ROT, 'panel', undefined, k + 1));
  let shelfN = 0, drawerN = 0;
  for (const z of L.zones) {
    for (const y of z.shelfYs) add(`shelf${++shelfN}`, 'shelf', 'shelf', rect(iw, id - SHELF_SETBACK), t, v3(s0 + t, y + t, w.backThickness), FLAT_ROT, 'panel', undefined, shelfN);
    for (const d of z.drawerFronts) add(`drawer${++drawerN}`, 'drawerFront', 'drawerFront', rect(z.frontW, d.y1 - d.y0), t, v3(s0 + t + REVEAL, d.y0, depth - t), NO_ROT, 'panel', undefined, drawerN);
    if (z.rodY !== null) add(`rod${z.index}`, 'rod', 'rod', circle(ROD_DIAMETER / 2, 24), iw, v3(s0 + t, z.rodY, id / 2), ROD_ROT, 'rod', [msg('note.rodDia', { d: ROD_DIAMETER })]);
  }
  add('plinth', 'plinth', 'plinth', rect(cw, plinth), t, v3(s0, 0, depth - PLINTH_SETBACK - t), NO_ROT);
  return parts;
}

export function buildParts(p: Project): Part[] {
  const out: Part[] = [];
  for (const L of layoutAll(p)) {
    if (L.kind !== 'unit') continue;
    const frame = wallFrame(p.room, L.wall);
    for (const part of buildUnitParts(L, p)) out.push({ ...part, transform: frameTransform(frame, part.transform) });
  }
  return out;
}
```
Rod: with `ROD_ROT` (rotY π/2) the circle's local x maps to world −z, so the rod's z extent is `[id/2 − r, id/2 + r]` — the test allows that. Note the back panel sits at `z ∈ [0, backThickness]` and dividers/shelves start at `z = backThickness`.

- [ ] **Step 4: Run** → pass; typecheck.

---

### Task 7: Cut list

**Files:**
- Create: `src/cutlist/cutlist.ts`, `src/cutlist/cutlist.test.ts`

**Interfaces:**
- Consumes: `Part, PartKind, PartNameKey, Material` (Task 6), `ROD_DIAMETER`, `bounds2`.
- Produces:

```ts
export interface Location { wall: Wall; columnIndex: number }   // 0-based, display as columnIndex + 1
export interface CutRow { nameKey: PartNameKey; kind: PartKind; locations: Location[]; qty: number; length: number; width: number; thickness: number; material: Material; notes: Msg[] }
export function partDims(part: Part): { length: number; width: number };
export function buildCutList(parts: Part[]): CutRow[];   // grouped as spec §3.3, KIND_ORDER = side, top, bottom, back, divider, shelf, drawerFront, plinth, rod; locations sorted by WALLS order then columnIndex, deduplicated
```

- [ ] **Step 1: Test**: from `buildParts(defaultProject())`: rows non-empty; every row `qty ≥ 1`; sum of qty = parts.length; first row kind `side`; the 4 identical back-wall sides (600 units share depth 600 → `sideL` 600×2250 qty 4 with locations back 0..3 — plus right wall unit 600 → 5) — assert the `sideL` row with length 2250 & width 600 has `qty` = 5 and locations containing `{wall:'back', columnIndex:0}`; rod rows carry a `note.rodDia` note and thickness 25; `partDims` of a `rect(300, 700)` part gives `{length: 700, width: 300}`.
- [ ] **Step 2: Run** → fails. **Step 3: Implement** by adapting the sibling's `cutlist.ts` (replace `columns` with `locations`, key by `wall:columnIndex`). **Step 4: Run** → pass.

---

### Task 8: Drawings — plan and wall elevation

**Files:**
- Create: `src/drawing/views.ts`, `src/drawing/views.test.ts`

**Interfaces:**
- Consumes: IR helpers (`makeDrawing, line, poly, rectPrim, text, dim, textSizeFor, Prim`), `layoutWall, heights, ROD_DIAMETER, SHELF_SETBACK` (Task 4), `wallLength, wallSegments, doorSpan, cornerClaim, WALLS, leftOf, rightOf, isSideWall` (Task 3), `t` (i18n).
- Produces:

```ts
export function planView(p: Project, lang: Lang): Drawing;
export function wallElevation(p: Project, wall: Wall, lang: Lang): Drawing;
export function wallName(lang: Lang, wall: Wall): string;   // t(lang, `wall.${wall}`)
```

**Plan** (IR coordinates `x = world x`, `y = −world z`, so the back wall is at `y = 0` on top and the front wall at `y = −D`):
- room rectangle thick; wall labels (`wallName`) just outside each wall (rotated 90 for side walls);
- door: draw the opening as a `panel`-free gap: overdraw the door span with a white-ish fill? The IR has no white fill — instead draw the room outline as four separate wall lines, splitting the door wall's line at the opening; leaf as a thin line perpendicular to the wall from `s0` of length `door.width` into the room; swing arc as a 12-segment polyline (quarter circle radius `door.width` centred on the hinge = the `s0` end). Label `drawing.door` next to it (`{w} × {h}`).
- units: for each `layoutWall` column: unit → filled rectangle `width × depth` in plan (map local `(s, z)` → world via `localToWorld(frame, v3(s, 0, z))` then to IR) plus a thin front-edge line; gap → dashed rectangle with the `drawing.gap` label; 
- dims: room width below the front wall (offset outward −), room depth on the right side, door offset & width along the door wall (outside), each enabled wall's depth (small dim at the wall's start corner);
- `textSize = textSizeFor(W, D)`; title `t(lang, 'drawing.plan')`.

**Elevation** (IR = wall local `(s, y)`):
- wall rectangle `L × H` thick; floor line; ceiling gap band: dashed line at `topY` with label `drawing.topGap` when `topGap > 0`;
- door on this wall: dashed rect `[s0, s1] × [0, door.height]` + label;
- corner claims (`cornerClaim(p, wall, 'start'|'end') > 0`): dashed rect at `[0, claim]` / `[L − claim, L]` × `[plinth, topY]` with the neighbour's `wallName` rotated 90;
- disabled wall: only the room rect + centred `drawing.noWardrobe` text; return early;
- each unit: outer rect (panel fill) `[s0, s1] × [plinth, topY]`; plinth line at `y = plinth`; inner interior rect thin; dividers as thick lines at `dividerYs − t … dividerYs` (draw as filled thin rects height `t`); shelves as filled rects `iw × t` at `shelfY`; drawer fronts as rects with a centred horizontal handle line 120 mm long at 60 % of the front height; rod as a circle Ø25 (poly of 16 pts) at `(s0 + w/2, rodY)` plus a dashed line across the interior at `rodY`; zone label centred: `t(lang, 'drawing.zone', { type: t(lang, `zone.${type}`), n: Math.round(height) })` with `size = textSize * 0.8` (skip the label when the zone width < 4·textSize);
- each gap: dashed rect `[s0, s1] × [0, topY]` + `drawing.gap` label;
- dims (below the floor, offsets negative and stacked): every column width at offset `−1.5·textSize`, each segment length `[seg.s0, seg.s1]` at `−4·textSize`, wall length `[0, L]` at `−6.5·textSize`; on the right side (`x = L`, offset positive): plinth `[0, plinth]`, carcass `[plinth, topY]`, topGap `[topY, H]` (if > 0), full height `[0, H]` at a larger offset;
- title `t(lang, 'drawing.elevation', { wall: wallName(lang, wall) })`.

- [ ] **Step 1: Test** `views.test.ts`: `planView(defaultProject(), 'en')` has ≥ 5 `dim` prims, bounds wider than 2400 and taller than 2000, contains text `Door 800 × 2100`; `wallElevation(p, 'back', 'en')` title `Back wall — elevation`, contains 4 column-width dims of 600 (count `dim` prims whose `|b.x − a.x| === 600`), contains a `text` with `Hanging rail`, bounds `max.y ≥ 2500`; `wallElevation(p, 'front', 'en')` contains text `no wardrobe` and no `poly` with `fill: 'panel'`; `wallElevation(p, 'right', 'en')` contains the text `gap` and a dashed poly; Russian titles differ from English.
- [ ] **Step 2: Run** → fails. **Step 3: Implement** per the description (keep the file under ~250 lines; split helpers `drawUnit(prims, L, p, lang, textSize)` and `drawDoorPlan(...)`). **Step 4: Run** → pass; typecheck.

---

### Task 9: PDF export

**Files:**
- Create: `src/pdf/exportPdf.ts`, `src/pdf/exportPdf.test.ts`

**Interfaces:**
- Consumes: `planView, wallElevation, wallName` (Task 8), `buildParts` (6), `buildCutList` (7), `drawingToPdf` (render), `registerPdfFont`, i18n, `WALLS`.
- Produces: `buildPdf(p: Project, opts?: PdfOptions): jsPDF`, `exportPdfBlob(p, opts?): Blob`, `ROWS_PER_PAGE = 27`, `PdfOptions { lang?; snapshotPng?: string | null; date?: Date }`.

Pages: summary (rows: date, room `W × D × H`, door `pdf.doorValue`, thickness, plinth, topGap, then one row per wall: label `pdf.wallSummary` → value = `pdf.disabled` or the columns joined by `; ` as `pdf.unitSummary` (`{w}` width, `{zones}` = zone types joined by `+`, e.g. `600 drawers×3+hanging`) / `pdf.gapSummary`), plan page, one elevation page per **enabled** wall (WALLS order), cut list pages. Table columns: `#, part, location, qty, length, width, thk, material, notes`; location rendered as `t('location.unit', { wall: wallName, n: columnIndex + 1 })` joined by `, `, truncated to 24 chars.

- [ ] **Step 1: Test**: `buildPdf(defaultProject(), { date: new Date('2026-09-07') }).getNumberOfPages()` equals `2 + 3 + Math.ceil(rows / 27)`; with all walls disabled → `2 + 0 + 1`; `exportPdfBlob` returns a Blob with size > 100_000 (font embedded); Russian build doesn't throw.
- [ ] **Step 2–4:** implement by adapting the sibling's `exportPdf.ts`; run → pass.

---

### Task 10: Store + persistence

**Files:**
- Create: `src/store/store.ts`, `src/store/store.test.ts`, `src/store/persist.ts`, `src/store/persist.test.ts`

**Interfaces:**
- Consumes: model, `validate`, `factory`, `wallSegments/segmentFree/minUnitWidth`, `makePreset`, i18n, persist.
- Produces (store):

```ts
export type Tab = 'design' | '3d' | 'cutlist';
export interface Selection { wall: Wall; columnId: string | null; zoneId: string | null }
export interface UiState { tab: Tab; selection: Selection; showDims: boolean; showRoom: boolean; explode: number; toast: Msg | null; lang: Lang }
export interface PlannerState {
  project: Project; errors: ValidationError[]; lastValid: Project; past: Project[]; future: Project[]; ui: UiState;
  setProject: (updater: (p: Project) => Project) => void;    // pushes history
  undo: () => void; redo: () => void;
  setName; setRoom(patch: Partial<Room>); setDoor(patch: Partial<Door>); setWardrobe(patch: Partial<Omit<Wardrobe,'walls'>>); setWall(wall, patch: Partial<Omit<WallPlan,'segments'>>);
  insertColumn: (wall: Wall, segment: 0 | 1, index: number, column: Column) => void;   // also selects it
  insertPreset: (wall: Wall, segment: 0 | 1, index: number, key: PresetKey) => void;    // width = min(default, free); toast 'toast.noRoom' and no-op if free < minUnitWidth (gap: free <= 0)
  updateColumn: (id: string, patch: { width?: number }) => void;
  removeColumn: (id: string) => void; moveColumn: (id: string, dir: -1 | 1) => void; duplicateColumn: (id: string) => void;
  addZone: (columnId: string, zone: Zone) => void;               // appended on top
  updateZone: (columnId: string, zoneId: string, patch: Partial<Omit<Zone,'id'>>) => void;
  removeZone: (columnId: string, zoneId: string) => void; moveZone: (columnId: string, zoneId: string, dir: -1 | 1) => void;
  select: (patch: Partial<Selection>) => void;
  newProject: () => void; loadProject: (p: Project) => void; setUi: (patch: Partial<UiState>) => void; toast: (m: Msg | null) => void; setLang: (l: Lang) => void;
}
export function findColumn(p: Project, id: string): { wall: Wall; segment: 0 | 1; index: number; column: Column } | null;
export function createPlannerStore(initial?: Project, lang?: Lang): StoreApi;   // as sibling
export function startAutosave(store, storage, delay = 300): () => void;
export const useStore;
```
`moveColumn` moves within its segment only. `removeColumn`/`removeZone` clear the selection when it pointed at the removed thing (selection of the column stays when a zone is removed). `undo/redo` cap `past` at 100 and re-validate; selection is cleaned via `cleanSelection(project, selection)` after every project change. History: `setProject` pushes `s.project` to `past`, clears `future`. `loadProject/newProject` clear history and reset selection to `{ wall: 'back', columnId: null, zoneId: null }`.

Persist: `STORAGE_KEY = 'wardrobe-planner:project'`, `LANG_KEY = 'wardrobe-planner:lang'`, `FILE_VERSION = 1`, `serializeProject`, `parseProjectShape`, `parseProjectJson`, `parseErrorText` (use `tmDeep`), `loadFromStorage`, `saveToStorage`, `loadLang`, `saveLang`, `StorageLike` — same structure as the sibling with an `isProjectShape` for the new model (room/door/wardrobe/walls with 4 keys, segments tuple of arrays, column kinds, zone types, `height` number or null).

- [ ] **Step 1: Tests.** `store.test.ts`: insertPreset at index 0 on back wall when free = 0 → toast `toast.noRoom`, nothing inserted; after removing a back column, `insertPreset('back', 0, 1, 'shelves')` inserts width 600 at index 1 and selects it; `insertPreset` with free 350 clamps width to 350; `moveColumn` swaps neighbours and refuses at edges; `duplicateColumn` inserts a copy right after with a new id; `removeColumn` clears selection; `updateZone` height; `moveZone`; `removeZone` keeps column selected; `undo` restores the previous project and `redo` re-applies; `errors` update on invalid change and `lastValid` stays. `persist.test.ts`: round trip `parseProjectJson(serializeProject(defaultProject()))` ok; garbage → `error.notJson`; wrong version → `error.badVersion`; missing walls → `error.badShape`; invalid-but-shaped (room width 0) → `parseProjectShape` ok, `parseProjectJson` fails with `error.failsValidation`; `loadFromStorage/saveToStorage` with a Map-backed fake.
- [ ] **Step 2: Run** → fails. **Step 3: Implement.** **Step 4: Run** → pass; typecheck.

---

### Task 11: App shell, TopBar, Cut list, 3D viewport, styles

**Files:**
- Create/replace: `src/App.tsx`, `src/styles.css`, `src/ui/TopBar.tsx`, `src/ui/CutListTable.tsx`, `src/ui/three/Viewport3D.tsx`, `src/ui/three/PartMesh.tsx`, `src/ui/three/RoomMesh.tsx`, `src/ui/DesignTab.tsx` (placeholder rendering "design" — replaced in Task 12)

**Interfaces:** consumes store (Task 10), `buildParts`, `buildCutList`, `layoutAll`, `wallFrame/localToWorld`, `exportPdfBlob`, `takeSnapshot`, `downloadBlob`, persist helpers, i18n.

- `App.tsx`: `.app` grid `48px 1fr`; TopBar; content by `ui.tab`: `DesignTab`, `Viewport3D`, `CutListTable`; `Toast`.
- `TopBar.tsx`: as the sibling plus Undo/Redo buttons (disabled when `past.length === 0` / `future.length === 0`), tabs `design | 3d | cutlist`.
- `CutListTable.tsx`: as the sibling with a `Location` column rendered via `t('location.unit', { wall: t(`wall.${l.wall}`), n: l.columnIndex + 1 })`.
- `PartMesh.tsx`: copy from sibling; colour table for the new kinds: `side/top/bottom/divider '#d9c7a3'`, `shelf '#e3d5b8'`, `back '#cbb997'`, `drawerFront '#9fbbd0'`, `plinth '#8a7a5e'`, `rod '#8c8c8c'`; explode offsets are applied in **wall-local** +z, so `PartMesh` receives `explodeDir: Vec3` (the wall's `rotY(yaw)(0,0,1)`) and offsets `drawerFront 300·f`, `shelf/divider 120·f`, `top +y 200·f`, `plinth −y 120·f`.
- `RoomMesh.tsx` (`{ room, door, showRoom }`): floor `planeGeometry(W, D)` at `y = −1` centred `(W/2, −1, D/2)` colour `#e6e3dd`; four walls as `planeGeometry` with `meshStandardMaterial color '#f3f1ec' side FrontSide transparent opacity 0.9` oriented so the normal points **into** the room (back wall at `z = 0` rotated `[0, 0, 0]` faces +z ✓; front wall at `z = D` rotation `[0, Math.PI, 0]`; left wall at `x = 0` rotation `[0, Math.PI/2, 0]`; right wall at `x = W` rotation `[0, −Math.PI/2, 0]`); wall edge `Line`s (floor and ceiling rectangles + 4 verticals, `#777`); door: a `planeGeometry(door.width, door.height)` mesh coloured `#c8b7a6` offset 2 mm into the room on its wall (position from `localToWorld(wallFrame(room, wall), v3((s0+s1)/2, h/2, 2))`, rotation `[0, yaw, 0]`), plus a floor swing arc `Line` (quarter circle, radius `door.width`, hinge at the `s0` end, 16 points, dashed).
- `Viewport3D.tsx`: as the sibling; camera fit: `position (W/2, H·1.15, D + max(W,D)·0.9)`, `lookAt (W/2, H·0.4, D/2)`, `OrbitControls target` the same; dims: `Html` labels of every unit width at `localToWorld(frame, v3((s0+s1)/2, −60, depth + 80))` and wall names at `localToWorld(frame, v3(L/2, H + 80, depth/2))`; toggles Dims / Room / Explode.
- `styles.css`: start from the sibling's stylesheet; add layout for the design tab (see Task 12 class names): `.design { display: grid; grid-template-columns: 300px 1fr 320px; min-height: 0; height: 100%; }`, `.panel { overflow: auto; border-right: 1px solid #ddd; background: #f6f6f6; }`, `.elevation { position: relative; display: flex; flex-direction: column; min-width: 0; }`, `.elevation .head { display: flex; gap: 12px; align-items: center; padding: 8px 12px; border-bottom: 1px solid #ddd; background: #fafafa; }`, `.elevation svg { flex: 1; width: 100%; height: 100%; min-height: 0; }`, `.hit { fill: transparent; cursor: pointer; }`, `.hit:hover { fill: rgba(43,108,176,0.08); }`, `.sel { fill: none; stroke: #2b6cb0; stroke-width: 3; vector-effect: non-scaling-stroke; pointer-events: none; }`, `.selzone { fill: rgba(43,108,176,0.18); pointer-events: none; }`, `.plus circle { fill: #2b6cb0; cursor: pointer; }`, `.plus text { fill: #fff; font-weight: 700; pointer-events: none; }`, `.plus:hover circle { fill: #1e4e85; }`, `.menu { position: absolute; z-index: 5; background: #fff; border: 1px solid #bbb; border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); padding: 4px; min-width: 200px; }`, `.menu button { display: flex; justify-content: space-between; width: 100%; border: 0; text-align: left; padding: 6px 8px; }`, `.menu button:hover { background: #eef3fa; }`, `.zone-row { display: grid; grid-template-columns: 1fr 70px 44px 50px auto; gap: 4px; align-items: center; padding: 4px; border-radius: 3px; }`, `.zone-row.active { background: #e3edf8; }`, `.plan svg { width: 100%; height: auto; display: block; background: #fff; border-bottom: 1px solid #ddd; }`, `.wallhit { fill: rgba(43,108,176,0.05); stroke: #9bb; stroke-dasharray: 8 6; cursor: pointer; vector-effect: non-scaling-stroke; }`, `.wallhit:hover { fill: rgba(43,108,176,0.15); }`, `.wallhit.on { fill: rgba(43,108,176,0.12); stroke: #2b6cb0; stroke-dasharray: none; stroke-width: 3; }`, `.inspector h4 { margin: 10px 0 4px; font-size: 13px; }`, `.inspector .hint { color: #666; font-size: 13px; padding: 8px; }`.

- [ ] **Step 1**: implement; **Step 2**: `pnpm typecheck && pnpm build`; **Step 3**: `pnpm dev` and open `http://localhost:5173` — the 3D tab shows the default U-shaped wardrobe with a transparent-near-wall room and a door on the front wall; the cut list tab lists rows; undo/redo buttons disabled initially. (No unit tests for React components; the core is covered.)

---

### Task 12: Design tab — PlanEditor + RoomForm + layout

**Files:**
- Create: `src/ui/DesignTab.tsx` (replace placeholder), `src/ui/PlanEditor.tsx`, `src/ui/RoomForm.tsx`; create placeholders `src/ui/ElevationEditor.tsx` (renders the static `wallElevation` SVG for the selected wall) and `src/ui/Inspector.tsx` (renders errors + hint) to be completed in Tasks 13–14.

- `DesignTab.tsx`: `<div className="design"><aside className="panel"><PlanEditor/><RoomForm/></aside><ElevationEditor/><Inspector/></div>`.
- `PlanEditor.tsx`: `const d = useMemo(() => planView(lastValid, lang))`, `{ viewBox, inner } = drawingToSvgParts(d)`; render `<div className="plan"><svg viewBox={viewBox}><g dangerouslySetInnerHTML={{ __html: inner }} /><g>{overlay}</g></svg></div>`; overlay = one `<rect className={'wallhit' + (selected ? ' on' : '')}>` per wall covering the wall band: band depth = `walls[wall].enabled ? walls[wall].depth : 150` mm measured into the room from that wall; compute the rect from wall geometry in IR coords (back: `x 0..W, y −band..0`; front: `x 0..W, y −D..−D+band`; left: `x 0..band, y −D..0`; right: `x W−band..W, y −D..0`), `onClick → select({ wall, columnId: null, zoneId: null })`; add a `<title>` child with the wall name for hover tooltip. Use `lastValid` for drawing but `project` for the wall bands.
- `RoomForm.tsx`: three `Section`s using `NumberField/SelectField` bound to `setRoom/setDoor/setWardrobe`: Room (width, depth, height); Door (wall select with the 4 walls, offset, width, height, margin → `wardrobe.doorMargin`); Wardrobe (topGap, plinthHeight, panelThickness, backThickness).

- [ ] **Step 1**: implement; **Step 2**: typecheck/build; **Step 3**: in the browser: clicking a wall band in the plan switches the centre elevation title; changing room width redraws the plan; door select moves the door.

---

### Task 13: ElevationEditor + SpawnMenu

**Files:**
- Replace: `src/ui/ElevationEditor.tsx`; create `src/ui/SpawnMenu.tsx`, `src/ui/useKeyboard.ts`

- `ElevationEditor.tsx`:
  - Header `.head`: `<strong>{wallName}</strong>`, `<label><input type=checkbox checked={plan.enabled} onChange → setWall(wall, {enabled})/> {t('ui.wallEnabled')}</label>`, depth `NumberField` (inline, `min 200`), and for each segment of `wallSegments(project, wall)`: `t('ui.segment', {n})` (only when 2 segments) + `t('ui.freeWidth', { n: Math.round(segmentFree) })` (red `ui.noRoom` when `s1 − s0 < minUnitWidth`).
  - Body: `wallElevation(lastValid, wall, lang)` → `drawingToSvgParts`; `<svg viewBox>` with `<g dangerouslySetInnerHTML>` then overlay from `layoutWall(project, wall)` (use `project`, falling back to `lastValid` layouts when `errors.length > 0` to avoid NaN geometry — simply use `lastValid` for everything drawn and `project` only for ids):
    - per column: `<rect className="hit" x={s0} y={−topY} width={width} height={topY} onClick={() => select({ wall, columnId: id, zoneId: null })}>`;
    - per zone of a unit: `<rect className="hit" x={s0 + t} y={−yTop} width={iw} height={height} onClick={(e) => { e.stopPropagation(); select({ wall, columnId, zoneId }) }}>`;
    - selected column: `<rect className="sel" …>` outline; selected zone: `<rect className="selzone" …>`;
    - "+" buttons: for every segment, positions `[seg.s0, …cumulative boundaries…, seg.s0 + used]` (i.e. index 0..n): `<g className="plus" transform={`translate(${x} ${−topY − r*1.6})`} onClick={(e) => openMenu(e, seg, index)}><circle r={r}/><text textAnchor="middle" dominantBaseline="middle" fontSize={r*1.4}>+</text></g>` with `r = textSize * 0.9`; skip a segment entirely when `s1 − s0 < minUnitWidth` and it has no columns. When the wall is disabled render the SVG without overlays and an `.hint` with `ui.enableHint`.
  - Menu state: `{ seg, index, x, y } | null` (client coordinates relative to the `.elevation` container via `getBoundingClientRect`), rendered as `<SpawnMenu>`; closes on pick, on `Escape`, on outside click (`mousedown` listener on document).
- `SpawnMenu.tsx` (`{ x, y, free, minWidth, onPick(key), onClose }`): `<div className="menu" style={{ left: x, top: y }}><div className="title">{t('ui.spawnTitle')}</div>{PRESET_KEYS.map(k => <button disabled={k === 'gap' ? free <= 0 : free < minWidth} onClick={() => onPick(k)}><span>{t(`preset.${k}`)}</span><span className="derived">{t('ui.spawnWidth', { n: Math.round(Math.min(k === 'gap' ? GAP_DEFAULT_WIDTH : PRESET_DEFAULT_WIDTH, free)) })}</span></button>)}</div>`.
- `useKeyboard.ts`: `useEffect` on `window keydown`: ignore when the target is an input/select/textarea; `Delete`/`Backspace` → `removeZone` if `zoneId` else `removeColumn` if `columnId`; `Escape` → `select({ columnId: null, zoneId: null })`; `(ctrl|meta)+z` → undo (`shift` → redo); `(ctrl|meta)+y` → redo. Call it from `DesignTab`.

- [ ] **Step 1**: implement; **Step 2**: typecheck/build; **Step 3**: browser: click "+" between two back-wall units → menu → pick "Shelves" → toast `No room` (back wall is full) — then remove a unit (select + Delete) and repeat → the unit appears at that position and is selected (blue outline); clicking a zone tints it; Escape clears; Cmd+Z undoes.

---

### Task 14: Inspector

**Files:**
- Replace: `src/ui/Inspector.tsx`

- Top: errors list via `tmDeep` (class `errors`).
- Selected column (`findColumn(project, selection.columnId)`): title `ui.column`/`ui.gapColumn` `{n: index+1 within wall (count across segments)}` + `ui.onWall`; `NumberField` width (`min 1`); row of buttons `moveLeft/moveRight/duplicate/remove`; for a unit: derived `ui.interior` (`iw × ih × id` from `layoutUnit`), `<h4>{t('ui.zones')}</h4>`, zone rows rendered **reversed** (top first): `<div className={'zone-row' + (active ? ' active' : '')} onClick={() => select({ zoneId })}>` containing `SelectField`-less inline `<select>` for type (`zone.*` labels), `<input type=number>` height (disabled when `height === null`, shows the effective height from layout as placeholder), `<label><input type=checkbox checked={height === null} onChange={(e) => updateZone(id, zid, { height: e.target.checked ? null : Math.round(effective) })}/> {t('ui.auto')}</label>`, count input (visible for shelves/drawers, `min 1`), and `▲ ▼ ✕` buttons (`moveZone(+1)` = towards the top = index+1; disable at ends; `removeZone` disabled when only one zone); effective height text `ui.zoneEffective`. Bottom: `<button onClick={() => addZone(id, makeZone('open'))}>{t('ui.addZone')}</button>`.
- Nothing selected: `.hint` with `ui.selectHint`.

- [ ] **Step 1**: implement; **Step 2**: typecheck/build; **Step 3**: browser: select the first back unit → change drawers count 3 → 5 → drawing updates; untick auto on the hanging zone → height field enabled with the current effective value; ✕ on a zone removes it; Add zone appends an open zone on top.

---

### Task 15: README, final verification

**Files:** `README.md`; fix anything found.

- [ ] **Step 1**: README modelled on the sibling's (develop commands, layout, spec pointer; no deploy section).
- [ ] **Step 2**: `pnpm test && pnpm typecheck && pnpm build` — all green; `pnpm dev` starts.
- [ ] **Step 3**: Manual smoke in the browser through the flow: new project → change door to the left wall → the left wall elevation shows the door and two segments → enable the front wall → side elevations show corner claims → export JSON, import it back → Export PDF downloads.

---

## Self-review notes

- Spec §2.1 frames → Task 3; §2.2 segments/claims → Task 3; §2.3–2.4 heights/zones → Task 4; §2.5 → Task 5; §2.6 presets → Task 2 + store `insertPreset` (10) + SpawnMenu (13); §2.7 defaults → Task 2; §2.8 i18n → Task 1 (+ `tmDeep` in Task 5); §3.1 parts → Task 6; §3.2 drawings → Task 8 (+ `drawingToSvgParts` Task 1); §3.3 → Task 7; §3.4 → Task 9; §3.5 → Task 11; §3.6 → Task 10; §4 UI → Tasks 11–14; §5 errors → Tasks 9–11; §6 tests → per task.
- Types used consistently: `Segment { wall, index, s0, s1 }`, `UnitLayout.zones: ZoneLayout[]`, `Part.wall/columnIndex/unitId`, `CutRow.locations`, `Selection { wall, columnId, zoneId }`, `insertPreset(wall, segment, index, key)`.
