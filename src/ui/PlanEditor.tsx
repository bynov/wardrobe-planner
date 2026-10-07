import { useMemo } from 'react';
import { WALLS } from '../geometry/frames';
import { planView, wallName } from '../drawing/views';
import type { Wall } from '../model/types';
import { drawingToSvgParts } from '../render/svg';
import { useStore } from '../store/store';
import { drawable } from './drawable';
import { useT } from './useT';

/** Band rectangle in SVG coords (the plan IR is Y-up, the SVG markup flips Y). */
function band(W: number, D: number, wall: Wall, depth: number): { x: number; y: number; w: number; h: number } {
  // Every extent is clamped: an imported project with a negative room size must never reach the
  // DOM as <rect width="-5">, which browsers reject outright.
  const w = Math.max(0, W);
  const h = Math.max(0, D);
  const d = Math.max(1, Math.min(depth, wall === 'back' || wall === 'front' ? h : w));
  switch (wall) {
    case 'back': return { x: 0, y: 0, w, h: Math.min(d, h) };
    case 'front': return { x: 0, y: Math.max(0, h - d), w, h: Math.min(d, h) };
    case 'left': return { x: 0, y: 0, w: Math.min(d, w), h };
    case 'right': return { x: Math.max(0, w - d), y: 0, w: Math.min(d, w), h };
  }
}

const HINT_DEPTH = 150;

export interface PlanEditorProps {
  /** Fills the pane instead of riding along the top of the left panel. */
  big?: boolean;
  /** Called after a wall is picked, so the large plan can hand the pane back to the elevation. */
  onPick?: () => void;
}

export function PlanEditor({ big = false, onPick }: PlanEditorProps = {}) {
  const project = useStore((s) => s.project);
  const lastValid = useStore((s) => s.lastValid);
  const selected = useStore((s) => s.ui.selection.wall);
  const select = useStore((s) => s.select);
  const { lang, units, t } = useT();

  const view = useMemo(() => {
    const d = planView(project, lang, units);
    return drawable(d, project) ? { p: project, d } : { p: lastValid, d: planView(lastValid, lang, units) };
  }, [project, lastValid, lang, units]);
  const { viewBox, inner } = useMemo(() => drawingToSvgParts(view.d), [view]);
  const { width: W, depth: D } = view.p.room;
  const textSize = view.d.textSize;

  return (
    <div className={big ? 'plan big' : 'plan'}>
      <svg viewBox={viewBox} role="img" aria-label={t('drawing.plan')}>
        <g style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: inner }} />
        <g>
          {WALLS.map((wall) => {
            const plan = view.p.wardrobe.walls[wall];
            const b = band(W, D, wall, plan.enabled ? plan.depth : HINT_DEPTH);
            const name = wallName(lang, wall);
            return (
              <g key={wall}>
                <rect
                  className={`wallhit${wall === selected ? ' on' : ''}${plan.enabled ? '' : ' off'}`}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  onClick={() => {
                    select({ wall, columnId: null, zoneId: null });
                    onPick?.();
                  }}
                >
                  <title>{plan.enabled ? name : `${name} — ${t('ui.noWardrobe')}`}</title>
                </rect>
                {/* a disabled wall's dashed band carries a "+" hint (spec §4) */}
                {!plan.enabled && (
                  <text
                    className="wallplus"
                    x={b.x + b.w / 2}
                    y={b.y + b.h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={textSize * 2.4}
                  >
                    +
                  </text>
                )}
              </g>
            );
          })}
        </g>

      </svg>
    </div>
  );
}
