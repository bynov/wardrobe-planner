# Polish pass + cut-list disclaimer — Implementation Plan

Date: 2026-10-10. Spec: this file (the user's instruction, 2026-10-10: "focus on polish; do not touch the cut list except a clear disclaimer that sizes are not guaranteed; skip cost estimate, doors, obstructions, colours; one PR").
Base: `master` @ 60ba985. Branch: `t3code/polish-pass`. Delivery: one PR into `master`.

## Global Constraints (binding for every task)

- Read `CLAUDE.md` first: commands, architecture, domain conventions. `pnpm test`, `pnpm typecheck`, `pnpm build` must pass; test output pristine.
- Node/pnpm come from mise: `export PATH="$HOME/.local/share/mise/shims:$PATH"` before any `pnpm`.
- Tests are DOM-free (`src/**/*.test.ts`, node env). Pure logic gets a test; React components are verified in a browser, not unit-tested.
- Every user-visible string is an i18n key added to BOTH `src/i18n/en.ts` and `src/i18n/ru.ts` with identical placeholders (a test enforces parity). Russian must be real, natural Russian.
- Named constants at the top of the owning module; no inlined magic numbers. No hex colours outside the allowed files (see CLAUDE.md).
- Commit per task with a GPG-signed commit (signing is configured; never `--no-gpg-sign`, never `--no-verify`). Message: imperative subject line; body optional; end with a blank line and `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Do not touch cut-list logic (`src/cutlist/*`, cut-list columns, row grouping). Task 1 only ADDS a disclaimer line.
- Do not add features beyond the task text (no exports, cost, doors, obstructions, colours).
- Keep the public look consistent with the redesign tokens (`site/tokens.css`, `src/styles.css`): reuse existing classes (`.meta`, `.card`, `.btn`, `.modal`) before adding new ones.

## Task 1: Cut-list disclaimer (UI + PDF)

**Goal:** the cut list itself tells the reader that the sizes are nominal and must be checked before cutting.

- `src/i18n/en.ts` + `ru.ts`: add `'ui.cutlistDisclaimer'` (EN: `'Sizes are nominal and not guaranteed. Check every dimension against the room and your material before cutting; allow for panel thickness, edge banding and fitting tolerances.'`; RU equivalent, natural wording) and `'pdf.cutlistDisclaimer'` (shorter one-liner that fits an A4 landscape line at font size 8–9: EN `'Sizes are nominal and not guaranteed — check every dimension against the room and your material before cutting.'`; RU equivalent).
- `src/ui/CutListTable.tsx`: render the disclaimer as a visible note ABOVE the table, after the two existing `.meta` lines, inside the `.cutlist-head` block. Use a new class `.note` (styled in `src/styles.css`: `font-size: 13px; color: var(--ink2); padding: 8px 12px; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 6px; max-width: 70ch`). Must also read fine on the phone (≤600) — check `.cutlist-page` phone rules in styles.css and ensure nothing overflows.
- `src/pdf/exportPdf.ts` → `cutListPages`: on the FIRST cut-list page print `pdf.cutlistDisclaimer` at the page foot, left-aligned at `x = M`, same baseline as the existing total (`H - M/2`), font size 8. Use `doc.splitTextToSize` to keep it to one line within `CUT_TABLE_MAX_X - M - <width reserved for the total>` — if it would wrap, print the first line only (do not overlap the total). Add a constant for the reserved total width.
- Tests: `src/i18n/i18n.test.ts` parity covers the keys automatically. Add a small test only if a pure helper was introduced (e.g. a text-fit helper); otherwise none.
- Verify: `pnpm build`, then open `/app/` in headless Chrome (see `scripts/screenshots.mjs` for the launch recipe) → Cut list mode in EN and RU, light and dark, 1280 and 390 px; export a PDF via the app or call `exportPdf` in node if feasible and eyeball page 2+ text positions (`pdftotext -layout` is acceptable evidence). Attach screenshots paths in the report.

## Task 2: Validation messages respect the display unit

**Goal:** in inch mode every validation message prints its lengths in inches; mm mode unchanged.

Today `error.*` strings hardcode `mm` and some hardcode numbers ("200 mm", "40 mm", "20 000 mm", "1 mm"). Design (binding):

1. `src/i18n/index.ts`: extend `Params` to `Record<string, string | number | Len>` where `export interface Len { mm: number }` and `export const len = (mm: number): Len => ({ mm })`. `t()` keeps working for string/number; a `Len` param is formatted via `formatLen(v.mm, units, { suffix: true })` for inches and `${formatLen(v.mm,'mm')} mm` for mm (helper `fmtLenParam(v, units)`; the ″ suffix style already exists in `src/units.ts`). Add an optional `units: Units = 'mm'` parameter to `t`, `tm`, `tmDeep` (last position; defaults keep all existing callers compiling). `tmDeep` already translates nested `wall.*` params; add the `Len` branch there and in `t`.
2. `src/model/validate.ts`: wrap every length param with `len(...)`: `segmentOverflow.n`, `columnWidth.n`, `zonesOverflow.n`, `zoneHeight.n`, `shoePitch.n`, `drawerHeight.n`, `drawerTooTall.n`, `gapRailHeight.min/max`. Turn the hardcoded numbers into params: `roomTooBig` → `{ n: len(MAX_ROOM_DIM) }`, `wallDepth` → `{ ...W, n: len(MIN_WALL_DEPTH) }` with `export const MIN_WALL_DEPTH = 200` in `validate.ts` (and make `src/ui/PresetTray.tsx` import it instead of its local copy), `rodOutOfZone` → `{ ...U, n: len(ROD_CLEARANCE) }`, `thickness` → `{ n: len(1) }` using a named `MIN_THICKNESS = 1` constant.
3. `en.ts`/`ru.ts`: rewrite those strings to `{n}` / `{min}`–`{max}` placeholders without a literal "mm" (the formatter supplies the unit). Keep every other wording.
4. Callers: `src/ui/ErrorBanner.tsx` (`dedupeErrors(lang, errors)` → add `units`), `src/ui/useT.ts` (`tmDeep` closure passes `units`), `src/store/persist.ts:141` import-error path (pass `units` through `describeParseError` or equivalent — find the real function name), `src/ui/useToggleWall.ts` (reads `params.wall` only — must still work), `src/ui/RoomMode.tsx` / any other `tmDeep`/`tm` call site (grep `tmDeep(`, `tm(`).
5. Tests: `src/i18n/i18n.test.ts` — a `Len` param renders `600 mm` in mm and `23 5/8″` in inches via `t` and `tmDeep`; `src/model/validate.test.ts` — the emitted params for `segmentOverflow` and `gapRailHeight` are `Len` objects (adjust existing assertions that compared `n` to a number). Any test that snapshot-compares a full error text in mm must still pass with the formatter's `600 mm` output — fix tests only where the intended output legitimately changed.
6. Verify in browser: units toggle to `in`, create an overflow (widen a unit past the wall) → banner shows inch figures; switch back to mm → mm figures. Also Room mode errors.

## Task 3: Share-link size guards

**Goal:** `src/store/share.ts` refuses oversized links on both sides; the user gets a translated error instead of a hang or a silent failure.

- Constants at the top of `share.ts`: `MAX_SHARE_HASH_CHARS = 32_000` (a real link is ≈1 kB; browsers and chat apps keep URLs well under this), `MAX_INFLATED_BYTES = 1_000_000`.
- `decodeShare`: return `bad` without decoding when `body.length > MAX_SHARE_HASH_CHARS`. Inflate by reading the `DecompressionStream` reader chunk by chunk, abort (`reader.cancel()`) and return `bad` once the running total exceeds `MAX_INFLATED_BYTES`; the plain `j=` path checks `bytes.length` the same way. Never read the whole stream into memory before checking.
- `encodeShare`: after encoding, if the hash body exceeds `MAX_SHARE_HASH_CHARS` throw an `Error` whose `message` is the i18n key `'error.shareTooLong'`; the share UI (`grep -n encodeShare src/ui`) catches it and shows the translated toast. Add `'error.shareTooLong'` EN: `'The design is too large to share as a link — save it as a JSON file instead.'` and RU.
- Tests (`src/store/share.test.ts` exists? if not, create): round trip still works; an over-long hash returns `ok: false`; a crafted deflate bomb (deflate of 2 MB of zeros via `CompressionStream` in node) returns `ok: false` and does not allocate the full payload (assert via the chunk-count/size cap path); a project whose encoded hash would exceed the cap makes `encodeShare` reject.
- Verify in browser: share a normal design → link opens in a fresh profile; paste `#p=` + 40 000 chars → error toast, app still usable.

## Task 4 (batch, mechanical): shoe-zone label shows its height; move the `Theme` type out of `src/ui`

**4a** `src/i18n/en.ts` `'drawing.shoes'`: `'Shoes ×{n}'` → `'Shoes {h} ×{n}'` (height first like every other zone label `'{type} {n}'`), RU `'Обувь {h} ×{n}'`. `src/drawing/views.ts` elevation label: pass `h: whole(z.height, units)` for shoes. The existing fit gate (`labelW <= u.interiorWidth` …) uses the new, longer text automatically. Update `src/drawing/views.test.ts` (or wherever the shoe label is asserted) to expect the height.

**4b** Create `src/store/theme.ts` holding `Theme`, `THEMES`, `isTheme`, `nextTheme` (DOM-free). `src/ui/theme.ts` keeps `applyTheme`, `ThemeMeta`, the `THEME_COLOR_*` hex and re-exports `type Theme`, `THEMES`, `isTheme`, `nextTheme` from the store module so existing UI imports keep working. `src/store/store.ts` (and `persist.ts` if it imports `isTheme`) import from `./theme`. Move the matching unit tests (`src/ui/theme.test.ts` parts that test `nextTheme`/`isTheme`) to `src/store/theme.test.ts`. Update the Theme bullet in `CLAUDE.md` (Architecture → Theme) to name the new file.

## Task 5: 3D width labels must not overlap at inner corners (judgment task)

**Goal:** with Dims on, the per-unit width labels and wall-name labels in `src/ui/three/Viewport3D.tsx` never overlap each other in the default template and in every template from `src/model/templates.ts`, at the `iso` preset and at each wall preset.

Facts: labels are drei `<Html center>` elements at a fixed pixel size placed at the unit's front-bottom edge (`y=-60`, `z=depth+80`). At an inner corner the last unit of the back wall and the first unit of a side wall put their labels ≈400–500 mm apart in world space, which collapses to overlap on screen at normal zoom; narrow units (300 mm) can also collide with their neighbours.

Approach (preferred; deviate with a written reason in the report): make the labels world-sized with `distanceFactor` so their footprint is deterministic in world space, gate each label like the elevation does (`src/drawing/views.ts` label fit: hide a width label whose rendered width would exceed its own unit width — the elevation drawing still carries the number), and at an inner corner offset the side-wall unit's label along its wall by the neighbouring back/front wall's depth so the two labels never share the corner square. Wall-name labels sit above the ceiling line (`y = room.height + 80`) and must stay clear of width labels. Keep the `showDims` switch behaviour and the PDF snapshot path (`snapshotOnly`) intact — the snapshot renders dims as today (check `offscreenSnapshot.ts` and keep its output identical if it does not draw dims).

Pure placement logic (which labels show, where) goes in a DOM-free module `src/ui/three/dimLabels.ts` with tests in `dimLabels.test.ts` (corner offset applied; too-wide label hidden; label widths computed for mm and inch text). The React file only maps the result to `<Html>`.

Verify: `pnpm build` then headless-Chrome screenshots (recipe in `scripts/screenshots.mjs`) of the 3D mode with Dims on for the default project and each template at `iso` and the four wall presets, mm and inch; list the screenshot paths in the report and state that no two labels overlap in any of them. Take a before screenshot first so the report shows the fix.

## Task 6: Shortcuts dialog focus trap; phone hint bar shows the step text

**6a** `src/ui/ShortcutsDialog.tsx`: trap Tab/Shift+Tab inside the dialog (cycle among its focusable elements — today only the close button, so Tab stays on it), restore focus to the element that was focused before the dialog opened when it closes (capture `document.activeElement` on mount, `.focus()` it on unmount). Put the trap logic in a DOM-free helper `src/ui/focusTrap.ts` (`nextFocusIndex(count, current, shiftKey)` style) with a test, and keep DOM wiring in the component.

**6b** `src/ui/HintBar.tsx` + `src/styles.css` ≤600 rules (lines ~421–425 hide the text with `font-size: 0`): on phones show the three steps as text, one step per line, number badge kept, dismiss button below the steps right-aligned; keep the bar compact (13px). Phone wording differs from desktop because the phone shell has wall chips instead of a clickable plan: add `'ui.hint.phone.step1'` EN `'Pick a wall from the chips'`, `'ui.hint.phone.step2'` EN `'Tap + in the elevation to add a unit'`, `'ui.hint.phone.step3'` EN `'Tap a unit to edit it'` + RU, and have `HintBar` take a `variant: 'desktop' | 'phone'` prop (MobileShell passes `phone`; the desktop caller — find it — passes nothing/defaults). Verify in headless Chrome at 390×844 with `wardrobe-planner:hint-dismissed` unset in both languages and themes.

## Task 7: Docs and PR

- README: mention the disclaimer in the cut-list paragraph (one sentence) and inch-aware validation if the README lists units behaviour. CLAUDE.md: Theme bullet (done in 4b) and the i18n bullet gets one sentence on `Len` params.
- No new screenshots unless a documented one changed visibly (the cut-list screenshot does: rerun `pnpm screenshots` for `cutlist` and `cutlist-dark` only if the script supports a subset; otherwise rerun all and commit only the changed files that are actually different).
