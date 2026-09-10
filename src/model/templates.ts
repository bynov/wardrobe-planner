import { defaultProject, emptyWall } from './defaults';
import { PRESET_DEFAULT_WIDTH, makePreset } from './presets';
import type { Column, Project, WallPlan } from './types';

/**
 * Ready-made example rooms: what a new user opens on their first run, what the projects menu
 * offers under "New from template", and what `?template=` links to.
 *
 * Every template fills each of its enabled walls exactly, corner claims included (a side wall
 * gives up the neighbouring back wall's depth where the two runs meet), and puts the door on the
 * front wall, clear of every run, so `validate()` is empty as it stands — the test is the arbiter.
 * Each one carries exactly one shoe rack, in place of a plain shelves column, so the feature is
 * visible from the first run without changing any wall's fill.
 */
export type TemplateKey = 'oneWall' | 'lShape' | 'uShape';
export const TEMPLATE_KEYS: TemplateKey[] = ['oneWall', 'lShape', 'uShape'];
export const isTemplateKey = (v: unknown): v is TemplateKey => TEMPLATE_KEYS.some((k) => k === v);

/** Carcass depth of every run a template places, on any wall. */
const RUN_DEPTH = 600;
/** The disabled front wall still carries a depth, for when the user ticks it on. */
const FRONT_DEPTH = 400;
/** A run against a side wall is deeper front-to-back, so its columns are wider than a back one's. */
const SIDE_WIDTH = 700;
const BACK_WIDTH = 600;
/** The one widened back column of the L-shape, which lands the space it leaves on exactly one
 * default-width unit: a starter design has to have somewhere obvious to put the next unit. */
const LSHAPE_WIDE_WIDTH = 700;
/** What the L-shape's back wall leaves free at its right-hand end: room for one more unit. */
export const LSHAPE_SPARE = PRESET_DEFAULT_WIDTH;
/** Walk-in room left beside the door on each side wall of the U-shape. */
const WALK_IN_GAP = 500;
const DOOR_HEIGHT = 2100;
const CEILING = 2500;

/** A wall plan holding `cols` in its first segment; a wall a template leaves empty is switched off. */
function run(depth: number, cols: Column[] = []): WallPlan {
  const w = emptyWall(depth, cols.length > 0);
  w.segments[0] = cols;
  return w;
}

export function makeTemplate(key: TemplateKey, name: string): Project {
  const base = defaultProject();
  const front = () => run(FRONT_DEPTH);
  const project = (
    room: Project['room'],
    door: Omit<Project['door'], 'wall' | 'height' | 'swing' | 'hinge'>,
    walls: { back: WallPlan; left: WallPlan; right: WallPlan },
  ): Project => ({
    ...base,
    name,
    room,
    door: { wall: 'front', height: DOOR_HEIGHT, swing: 'in', hinge: 'left', ...door },
    wardrobe: { ...base.wardrobe, walls: { ...walls, front: front() } },
  });

  switch (key) {
    // One 3 m run along the back wall, with the door opposite it.
    case 'oneWall':
      return project(
        { width: 3000, depth: 1800, height: CEILING },
        { offset: 1100, width: 800 },
        {
          back: run(RUN_DEPTH, [
            makePreset('drawersHanging', BACK_WIDTH),
            makePreset('doubleHanging', BACK_WIDTH),
            makePreset('hanging', BACK_WIDTH),
            makePreset('shoes', BACK_WIDTH),
            makePreset('drawersShelves', BACK_WIDTH),
          ]),
          left: run(RUN_DEPTH),
          right: run(RUN_DEPTH),
        },
      );

    // Back wall plus the left one, with the door centred on the front wall — its inward leaf stops
    // 250 mm short of the left run. The left run is 1400 long: 2000 of depth less the back wall's
    // 600 mm corner. The back wall deliberately stops `LSHAPE_SPARE` short of its right-hand end,
    // so there is room for the unit the first-run hint invites the user to add.
    case 'lShape':
      return project(
        { width: 2500, depth: 2000, height: CEILING },
        { offset: 850, width: 800 },
        {
          back: run(RUN_DEPTH, [
            makePreset('doubleHanging', BACK_WIDTH),
            makePreset('drawersHanging', LSHAPE_WIDE_WIDTH),
            makePreset('shoes', BACK_WIDTH),
          ]),
          left: run(RUN_DEPTH, [makePreset('drawersShelves', SIDE_WIDTH), makePreset('doubleHanging', SIDE_WIDTH)]),
          right: run(RUN_DEPTH),
        },
      );

    // Runs on three walls with the door in the middle of the front one. Each side run is 1900
    // long (2500 less the back wall's corner) and keeps a walk-in gap at its door end — wall-local
    // `s` starts at the front on the left wall and at the back on the right, so the gap is the
    // left run's first column and the right run's last.
    case 'uShape':
      return project(
        { width: 3000, depth: 2500, height: CEILING },
        { offset: 900, width: 900 },
        {
          back: run(RUN_DEPTH, [
            makePreset('drawersHanging', BACK_WIDTH),
            makePreset('doubleHanging', BACK_WIDTH),
            makePreset('shelves', BACK_WIDTH),
            makePreset('drawersShelves', BACK_WIDTH),
            makePreset('hanging', BACK_WIDTH),
          ]),
          left: run(RUN_DEPTH, [
            makePreset('gap', WALK_IN_GAP),
            makePreset('doubleHanging', SIDE_WIDTH),
            makePreset('shoes', SIDE_WIDTH),
          ]),
          right: run(RUN_DEPTH, [
            makePreset('hanging', SIDE_WIDTH),
            makePreset('drawersShelves', SIDE_WIDTH),
            makePreset('gap', WALK_IN_GAP),
          ]),
        },
      );
  }
}
