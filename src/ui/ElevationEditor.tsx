import { useEffect, useMemo, useState } from 'react';
import { leftOf, minUnitWidth, rightOf, segmentUsed, wallLength, wallSegments } from '../geometry/frames';
import { heights, layoutWall } from '../geometry/layout';
import { unitTag, wallElevation, wallName } from '../drawing/views';
import { msg } from '../i18n';
import type { Wall } from '../model/types';
import { drawingToSvgParts } from '../render/svg';
import { findColumn, useStore, type InsertSlot } from '../store/store';
import { formatLen } from '../units';
import { drawable } from './drawable';
import { useT } from './useT';
import { NARROW_QUERY, PHONE_QUERY, useMediaQuery } from './useMediaQuery';

/** How many `error.segmentOverflow` errors currently name one of `walls`. */
const overflowsOn = (errors: { message: { key: string; params?: Record<string, string | number> } }[], walls: Wall[]): number =>
  errors.filter((e) => e.message.key === 'error.segmentOverflow' && walls.some((w) => e.message.params?.wall === `wall.${w}`)).length;

/** How big the "+" insert target is, as a multiple of the drawing's text size. */
const PLUS_R_FACTOR = 0.9;
/** ...but never smaller than this radius in real screen pixels once a finger is doing the aiming.
 *  The drawing is in millimetres, so the same factor is a different target on every screen. */
const PLUS_TOUCH_R_PX = 20;

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
  const insertAt = useStore((s) => s.ui.insertAt);
  const setInsertAt = useStore((s) => s.setInsertAt);
  const { lang, t, u, units } = useT();

  const wall = selection.wall;
  const plan = project.wardrobe.walls[wall];
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const narrow = useMediaQuery(NARROW_QUERY);
  const phone = useMediaQuery(PHONE_QUERY);
  // On a phone the tray lives in the bottom sheet, so picking a slot also opens it.
  const pickSlot = (slot: InsertSlot) => {
    setInsertAt(slot);
    if (phone) useStore.getState().setUi({ sheetOpen: true, sheetView: 'tray' });
  };

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

  const slotOn = (segment: number, index: number) =>
    insertAt?.wall === wall && insertAt.segment === segment && insertAt.index === index;

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
    <div className="elevation">
      {!enabled ? (
        <div className="empty">
          <p>{t('ui.noWardrobeOnWall')}</p>
          <button className="btn primary" onClick={() => onToggleWall(true)}>{t('ui.useThisWall')}</button>
        </div>
      ) : (
        <div className="body">
        <svg ref={setSvgEl} viewBox={drawn.viewBox} role="img" aria-label={t('drawing.elevation', { wall: wallName(lang, wall) })}>
          <g style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: drawn.inner }} />
          {drawnEnabled && (
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
                return <rect key={`s${id}`} className="sel" rx={2} x={c.s0} y={-topY} width={Math.max(0, c.width)} height={topY} />;
              })}
              {layout.map((c) => {
                if (c.kind !== 'unit' || c.unit.id !== selection.columnId) return null;
                const tag = unitTag(lang, wall, c.columnIndex);
                const prim = view.d.prims.find((p) => p.t === 'text' && p.text === tag);
                if (!prim || prim.t !== 'text') return null;
                return (
                  <text
                    key={`st${c.unit.id}`}
                    className="seltag"
                    x={prim.at.x}
                    y={-prim.at.y}
                    fontSize={prim.size ?? textSize}
                    dominantBaseline="middle"
                    textAnchor={prim.anchor ?? 'start'}
                  >
                    {tag}
                  </text>
                );
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

              {/* the free tail of each segment: a dashed drop zone that arms the same insert slot */}
              {viewSegments.map((seg) => {
                const mine = layout.filter((c) => c.segment === seg.index);
                const x0 = mine.length ? mine[mine.length - 1].s1 : seg.s0;
                const free = seg.s1 - x0;
                // A segment too short for any unit gets no dashed drop zone: it would promise
                // something an insert cannot deliver.
                if (free <= 0 || topY - plinth <= 0 || seg.s1 - seg.s0 < minUnitWidth(view.p.wardrobe)) return null;
                const cx = x0 + free / 2;
                const cy = -(topY + plinth) / 2;
                return (
                  <g key={`f${seg.index}`} className={`placeholder${slotOn(seg.index, mine.length) ? ' on' : ''}`} onClick={(e) => { e.stopPropagation(); pickSlot({ wall, segment: seg.index, index: mine.length }); }}>
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
                    className={`plus${slotOn(seg.index, index) ? ' on' : ''}`}
                    // clear of the wall line and its dimension chain when the boundary is the wall end
                    transform={`translate(${x >= wallLen - 1 ? x - r : x} ${-plusY})`}
                    onClick={(e) => { e.stopPropagation(); pickSlot({ wall, segment: seg.index, index }); }}
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
        </div>
      )}
    </div>
  );
}
