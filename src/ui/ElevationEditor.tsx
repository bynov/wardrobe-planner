import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { leftOf, minUnitWidth, rightOf, segmentFree, segmentUsed, wallLength, wallSegments, type Segment } from '../geometry/frames';
import { heights, layoutWall } from '../geometry/layout';
import { wallElevation, wallName } from '../drawing/views';
import { msg } from '../i18n';
import type { PresetKey } from '../model/presets';
import type { Wall } from '../model/types';
import { drawingToSvgParts } from '../render/svg';
import { findColumn, useStore } from '../store/store';
import { formatLen } from '../units';
import { NumberField } from './fields';
import { PlanEditor } from './PlanEditor';
import { SpawnMenu } from './SpawnMenu';
import { drawable } from './drawable';
import { useT } from './useT';
import { NARROW_QUERY, useMediaQuery } from './useMediaQuery';

/** How many `error.segmentOverflow` errors currently name one of `walls`. */
const overflowsOn = (errors: { message: { key: string; params?: Record<string, string | number> } }[], walls: Wall[]): number =>
  errors.filter((e) => e.message.key === 'error.segmentOverflow' && walls.some((w) => e.message.params?.wall === `wall.${w}`)).length;

interface MenuState {
  segment: 0 | 1;
  index: number;
  x: number;
  y: number;
}

/** How big the "+" spawn target is, as a multiple of the drawing's text size. */
const PLUS_R_FACTOR = 0.9;
/** ...but never smaller than this radius in real screen pixels once a finger is doing the aiming.
 *  The drawing is in millimetres, so the same factor is a different target on every screen. */
const PLUS_TOUCH_R_PX = 20;

const MENU_W = 210;
const MENU_H = 230;

/**
 * Screen pixels per drawing millimetre for an `<svg>` that scales its viewBox to fit (the default
 * `xMidYMid meet`, so the smaller of the two ratios wins). 0 until the element has been measured,
 * and 0 wherever there is no `ResizeObserver` — callers fall back to a size in drawing units.
 */
function useSvgScale(el: SVGSVGElement | null, viewBox: string): number {
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') {
      setBox({ w: 0, h: 0 });
      return;
    }
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number);
  if (!(box.w > 0 && box.h > 0) || !(vbW > 0) || !(vbH > 0)) return 0;
  return Math.min(box.w / vbW, box.h / vbH);
}

export function ElevationEditor() {
  const project = useStore((s) => s.project);
  const lastValid = useStore((s) => s.lastValid);
  const selection = useStore((s) => s.ui.selection);
  const select = useStore((s) => s.select);
  const setWall = useStore((s) => s.setWall);
  const insertPreset = useStore((s) => s.insertPreset);
  const { lang, t, u, units } = useT();

  const wall = selection.wall;
  const plan = project.wardrobe.walls[wall];
  const boxRef = useRef<HTMLDivElement>(null);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const narrow = useMediaQuery(NARROW_QUERY);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [bigPlan, setBigPlan] = useState(false);

  // The wall changes under an open menu -> the anchor is meaningless.
  useEffect(() => setMenu(null), [wall, plan.enabled]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // keep useKeyboard from also clearing the selection
      e.preventDefault();
      setMenu(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [menu]);

  const view = useMemo(() => {
    const d = wallElevation(project, wall, lang, units);
    return drawable(d, project) ? { p: project, d } : { p: lastValid, d: wallElevation(lastValid, wall, lang, units) };
  }, [project, lastValid, wall, lang, units]);
  const drawn = useMemo(() => drawingToSvgParts(view.d), [view]);
  const textSize = view.d.textSize;
  const layout = useMemo(() => (view.p.wardrobe.walls[wall].enabled ? layoutWall(view.p, wall) : []), [view, wall]);
  const viewSegments = useMemo(() => wallSegments(view.p, wall), [view, wall]);
  const topY = useMemo(() => Math.max(0, heights(view.p).topY), [view]);
  const plinth = Math.max(0, Math.min(view.p.wardrobe.plinthHeight, topY));
  const wallLen = wallLength(view.p.room, wall);

  const projSegments = useMemo(() => wallSegments(project, wall), [project, wall]);
  const minWidth = minUnitWidth(project.wardrobe);

  const openMenu = useCallback((e: React.MouseEvent, segment: 0 | 1, index: number) => {
    e.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.max(4, Math.min(e.clientX - box.left + 6, box.width - MENU_W - 4));
    const y = Math.max(4, Math.min(e.clientY - box.top + 6, Math.max(4, box.height - MENU_H)));
    setMenu({ segment, index, x, y });
  }, []);

  const onPick = (key: PresetKey) => {
    if (menu) insertPreset(wall, menu.segment, menu.index, key);
    setMenu(null);
  };
  const closeMenu = useCallback(() => setMenu(null), []);

  /**
   * Enabling a wall makes it claim the corners, which shortens both side walls' usable runs —
   * their existing units can end up overflowing without the user touching them. Say so.
   */
  const onToggleWall = (enabled: boolean) => {
    const neighbours = [leftOf(wall), rightOf(wall)];
    const before = overflowsOn(useStore.getState().errors, neighbours);
    setWall(wall, { enabled });
    if (!enabled) return;
    if (overflowsOn(useStore.getState().errors, neighbours) > before) {
      useStore.getState().toast(msg('toast.neighbourOverflow', { wall: `wall.${wall}` }));
    }
  };

  const pxPerMm = useSvgScale(svgEl, drawn.viewBox);

  const menuSeg: Segment | undefined = menu ? projSegments[menu.segment] : undefined;
  const menuFree = menuSeg ? segmentFree(project, menuSeg) : 0;

  // The elevation is drawn in millimetres and scaled to fit, so a radius in drawing units says
  // nothing about how big the target is under a fingertip: convert back through the rendered box.
  const r = narrow && pxPerMm > 0
    ? Math.max(textSize * PLUS_R_FACTOR, PLUS_TOUCH_R_PX / pxPerMm)
    : textSize * PLUS_R_FACTOR;
  // The "+" row rides above the units' top edge, but the drawing's "ceiling gap" label sits
  // mid-gap at the wall end and the gap is often too short for both: lift the row clear of that
  // label when it exists, without pushing it past the drawing's own bounds.
  const ceilingLabelTop =
    view.p.wardrobe.topGap > 0 ? (topY + view.p.room.height) / 2 + textSize * 0.5 : Number.NEGATIVE_INFINITY;
  const plusY = Math.min(Math.max(topY + r * 2.8, ceilingLabelTop + r), view.d.bounds.max.y - r);
  const enabled = plan.enabled;
  const drawnEnabled = view.p.wardrobe.walls[wall].enabled;

  return (
    <div className="elevation" ref={boxRef}>
      <div className="head">
        <strong>{wallName(lang, wall)}</strong>
        <label className="check">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggleWall(e.target.checked)} />
          <span>{t('ui.wallEnabled')}</span>
        </label>
        {enabled && (
          <NumberField label={t('ui.wallDepth', { u })} value={plan.depth} min={200} step={10} units={units} onChange={(depth) => setWall(wall, { depth })} />
        )}
        <button className={bigPlan ? 'active' : ''} title={t('ui.bigPlan')} onClick={() => setBigPlan((v) => !v)}>
          ⤢ {t('ui.bigPlan')}
        </button>
        <span className="spacer" />
        {enabled &&
          projSegments.map((seg, i) => (
            <span key={i} className="seginfo">
              {projSegments.length > 1 && <b>{t('ui.segment', { n: i + 1 })}: </b>}
              {seg.s1 - seg.s0 < minWidth ? (
                <span className="danger">{t('ui.noRoom')}</span>
              ) : (
                t('ui.freeWidth', { n: formatLen(Math.round(segmentFree(project, seg)), units), u })
              )}
            </span>
          ))}
      </div>

      <div className="body">
        {bigPlan && <PlanEditor big onPick={() => setBigPlan(false)} />}
        {!bigPlan && (
        <svg ref={setSvgEl} viewBox={drawn.viewBox} role="img" aria-label={t('drawing.elevation', { wall: wallName(lang, wall) })}>
          <g style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: drawn.inner }} />
          {enabled && drawnEnabled && (
            <g>
              {/* column hit rectangles */}
              {layout.map((c) => {
                const id = c.kind === 'unit' ? c.unit.id : c.gap.id;
                if (!findColumn(project, id)) return null;
                return (
                  <rect
                    key={`h${id}`}
                    className="hit"
                    x={c.s0}
                    y={-topY}
                    width={Math.max(0, c.width)}
                    height={topY}
                    onClick={() => select({ wall, columnId: id, zoneId: null })}
                  >
                    <title>{c.kind === 'unit' ? t('ui.column', { n: c.columnIndex + 1 }) : t('ui.gapColumn', { n: c.columnIndex + 1 })}</title>
                  </rect>
                );
              })}

              {/* zone hit rectangles, above the column ones */}
              {layout.map((c) =>
                c.kind !== 'unit' || !findColumn(project, c.unit.id)
                  ? null
                  : c.zones.map((z) => (
                      <rect
                        key={`z${z.zone.id}`}
                        className="hit zonehit"
                        x={c.s0 + view.p.wardrobe.panelThickness}
                        y={-z.yTop}
                        width={Math.max(0, c.interiorWidth)}
                        height={Math.max(0, z.height)}
                        // First click anywhere in a unit selects the unit; only a click inside the
                        // already-selected unit drills down to a zone. Reviewers kept deleting a
                        // zone when the highlight told them a whole unit was selected.
                        onClick={(e) => {
                          e.stopPropagation();
                          const drill = selection.columnId === c.unit.id;
                          select({ wall, columnId: c.unit.id, zoneId: drill ? z.zone.id : null });
                        }}
                      >
                        <title>{t(`zone.${z.zone.type}`)}</title>
                      </rect>
                    )),
              )}

              {/* selection highlights */}
              {layout.map((c) => {
                const id = c.kind === 'unit' ? c.unit.id : c.gap.id;
                if (id !== selection.columnId) return null;
                return <rect key={`s${id}`} className="sel" x={c.s0} y={-topY} width={Math.max(0, c.width)} height={topY} />;
              })}
              {layout.map((c) =>
                c.kind !== 'unit'
                  ? null
                  : c.zones
                      .filter((z) => z.zone.id === selection.zoneId && c.unit.id === selection.columnId)
                      .map((z) => (
                        <rect
                          key={`sz${z.zone.id}`}
                          className="selzone"
                          x={c.s0 + view.p.wardrobe.panelThickness}
                          y={-z.yTop}
                          width={Math.max(0, c.interiorWidth)}
                          height={Math.max(0, z.height)}
                        />
                      )),
              )}

              {/* the free tail of each segment: a dashed drop zone that opens the same menu */}
              {viewSegments.map((seg) => {
                const mine = layout.filter((c) => c.segment === seg.index);
                const x0 = mine.length ? mine[mine.length - 1].s1 : seg.s0;
                const free = seg.s1 - x0;
                // A segment too short for any unit already says "No room" in the header: a dashed
                // drop zone there only promises something the spawn menu cannot deliver.
                if (free <= 0 || topY - plinth <= 0 || seg.s1 - seg.s0 < minUnitWidth(view.p.wardrobe)) return null;
                const cx = x0 + free / 2;
                const cy = -(topY + plinth) / 2;
                return (
                  <g key={`f${seg.index}`} className="placeholder" onClick={(e) => openMenu(e, seg.index, mine.length)}>
                    <rect x={x0} y={-topY} width={Math.max(0, free)} height={Math.max(0, topY - plinth)} />
                    <text x={cx} y={cy - textSize * 0.8} textAnchor="middle" dominantBaseline="middle" fontSize={textSize * 1.8}>
                      +
                    </text>
                    {free > 7 * textSize && (
                      <text x={cx} y={cy + textSize} textAnchor="middle" dominantBaseline="middle" fontSize={textSize * 0.8}>
                        {t('ui.freeWidth', { n: formatLen(Math.round(free), units), u })}
                      </text>
                    )}
                    <title>{t('ui.spawnTitle')}</title>
                  </g>
                );
              })}

              {/* overflow: what spills past the segment end, and which columns cause it */}
              {viewSegments.map((seg) => {
                const used = segmentUsed(view.p, seg);
                const over = used - (seg.s1 - seg.s0);
                if (!(over > 0) || topY - plinth <= 0) return null;
                const x1 = seg.s0 + used;
                return (
                  <g key={`o${seg.index}`} style={{ pointerEvents: 'none' }}>
                    {layout
                      .filter((c) => c.segment === seg.index && c.s1 > seg.s1)
                      .map((c) => (
                        <rect
                          key={`oc${c.kind === 'unit' ? c.unit.id : c.gap.id}`}
                          className="overflowcol"
                          x={c.s0}
                          y={-topY}
                          width={Math.max(0, c.width)}
                          height={Math.max(0, topY - plinth)}
                        />
                      ))}
                    <rect className="overflow" x={seg.s1} y={-topY} width={Math.max(0, x1 - seg.s1)} height={Math.max(0, topY - plinth)} />
                    <text
                      className="overflowlabel"
                      x={(seg.s1 + x1) / 2}
                      // at the top of the overlay, not its middle: mid-height it landed on the
                      // zone labels of the unit that spills over
                      y={-(topY - 1.5 * textSize)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={textSize * 1.1}
                    >
                      {t('ui.overflowBy', { n: formatLen(Math.round(over), units), u })}
                    </text>
                  </g>
                );
              })}

              {/* "+" spawn buttons at every column boundary of every segment */}
              {viewSegments.map((seg) => {
                const mine = layout.filter((c) => c.segment === seg.index);
                if (seg.s1 - seg.s0 < minUnitWidth(view.p.wardrobe) && mine.length === 0) return null;
                const xs = [seg.s0, ...mine.map((c) => c.s1)];
                return xs.map((x, index) => (
                  <g
                    key={`p${seg.index}-${index}`}
                    className="plus"
                    // clear of the wall line and its dimension chain when the boundary is the wall end
                    transform={`translate(${x >= wallLen - 1 ? x - r : x} ${-plusY})`}
                    onClick={(e) => openMenu(e, seg.index, index)}
                  >
                    <circle r={r} />
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={r * 1.4}>+</text>
                    <title>{t('ui.spawnTitle')}</title>
                  </g>
                ));
              })}
            </g>
          )}
        </svg>
        )}
        {!bigPlan && !enabled && <div className="hint">{t('ui.enableHint')}</div>}
      </div>

      {menu && (
        <SpawnMenu x={menu.x} y={menu.y} free={menuFree} minWidth={minWidth} onPick={onPick} onClose={closeMenu} />
      )}
    </div>
  );
}
