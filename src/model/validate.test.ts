import { describe, expect, it } from 'vitest';
import { defaultProject } from './defaults';
import { MAX_ROOM_DIM, validate } from './validate';
import { MAX_DRAWER_FRONT } from '../geometry/layout';
import { tmDeep } from '../i18n';
import { makeUnit, makeZone } from './factory';

const clone = (p: ReturnType<typeof defaultProject>) => structuredClone(p);

describe('validate', () => {
  it('defaultProject() is valid', () => {
    expect(validate(defaultProject())).toEqual([]);
  });

  it('error.roomDims: room width 0', () => {
    const q = clone(defaultProject());
    q.room.width = 0;
    expect(validate(q).some((e) => e.message.key === 'error.roomDims')).toBe(true);
  });

  it('error.roomHeight: room height 300', () => {
    const q = clone(defaultProject());
    q.room.height = 300;
    expect(validate(q).some((e) => e.message.key === 'error.roomHeight')).toBe(true);
  });

  it('error.doorFits: door offset 2000', () => {
    const q = clone(defaultProject());
    q.door.offset = 2000;
    expect(validate(q).some((e) => e.message.key === 'error.doorFits')).toBe(true);
  });

  it('error.doorHeight: door height 0', () => {
    const q = clone(defaultProject());
    q.door.height = 0;
    expect(validate(q).some((e) => e.message.key === 'error.doorHeight')).toBe(true);
  });

  it('error.wallDepth: back wall depth 100', () => {
    const q = clone(defaultProject());
    q.wardrobe.walls.back.depth = 100;
    expect(validate(q).some((e) => e.message.key === 'error.wallDepth')).toBe(true);
  });

  it('error.segmentOverflow: back wall, push a 600 unit -> 600 over', () => {
    const q = clone(defaultProject());
    q.wardrobe.walls.back.segments[0].push(makeUnit(600, [makeZone('open')]));
    const err = validate(q).find((e) => e.message.key === 'error.segmentOverflow');
    expect(err).toBeTruthy();
    expect(err!.message.params?.n).toBe(600);
  });

  it('error.columnWidth: unit width 100', () => {
    const q = clone(defaultProject());
    q.wardrobe.walls.back.segments[0][0].width = 100;
    expect(validate(q).some((e) => e.message.key === 'error.columnWidth')).toBe(true);
  });

  it('error.gapWidth: gap width 0', () => {
    const q = clone(defaultProject());
    q.wardrobe.walls.right.segments[0][0].width = 0;
    expect(validate(q).some((e) => e.message.key === 'error.gapWidth')).toBe(true);
  });

  it('error.noZones: unit with no zones', () => {
    const q = clone(defaultProject());
    const unit = q.wardrobe.walls.back.segments[0][0];
    if (unit.kind === 'unit') unit.zones = [];
    expect(validate(q).some((e) => e.message.key === 'error.noZones')).toBe(true);
  });

  it('error.zonesOverflow: drawers 3000 fixed', () => {
    const q = clone(defaultProject());
    const unit = q.wardrobe.walls.back.segments[0][0];
    if (unit.kind === 'unit') unit.zones = [makeZone('drawers', 3000, 3)];
    expect(validate(q).some((e) => e.message.key === 'error.zonesOverflow')).toBe(true);
  });

  it('error.zoneHeight: fixed 50 zone', () => {
    const q = clone(defaultProject());
    const unit = q.wardrobe.walls.back.segments[0][0];
    if (unit.kind === 'unit') unit.zones = [makeZone('shelves', 50, 3), makeZone('hanging')];
    expect(validate(q).some((e) => e.message.key === 'error.zoneHeight')).toBe(true);
  });

  it('error.shelfCount: 0 shelves', () => {
    const q = clone(defaultProject());
    const unit = q.wardrobe.walls.back.segments[0][0];
    if (unit.kind === 'unit') unit.zones = [makeZone('shelves', null, 0)];
    expect(validate(q).some((e) => e.message.key === 'error.shelfCount')).toBe(true);
  });

  it('error.drawerCount: 0 drawers', () => {
    const q = clone(defaultProject());
    const unit = q.wardrobe.walls.back.segments[0][0];
    if (unit.kind === 'unit') unit.zones = [makeZone('drawers', null, 0)];
    expect(validate(q).some((e) => e.message.key === 'error.drawerCount')).toBe(true);
  });

  it('error.drawerHeight: drawers 200 high with count 3 -> frontH < 80', () => {
    const q = clone(defaultProject());
    const unit = q.wardrobe.walls.back.segments[0][0];
    if (unit.kind === 'unit') unit.zones = [makeZone('drawers', 200, 3), makeZone('hanging')];
    expect(validate(q).some((e) => e.message.key === 'error.drawerHeight')).toBe(true);
  });

  it('error.segmentOverflow is NOT reported on a disabled wall (front), even when overflowing', () => {
    const q = clone(defaultProject());
    q.wardrobe.walls.front.enabled = false;
    q.wardrobe.walls.front.segments[0].push(makeUnit(2000, [makeZone('open')]));
    const err = validate(q).find((e) => e.message.key === 'error.segmentOverflow' && e.message.params?.wall === 'wall.front');
    expect(err).toBeUndefined();
  });

  it('error.columnWidth is still reported for a column on a disabled wall (front)', () => {
    const q = clone(defaultProject());
    q.wardrobe.walls.front.enabled = false;
    q.wardrobe.walls.front.segments[0].push(makeUnit(100, [makeZone('open')]));
    const err = validate(q).find((e) => e.message.key === 'error.columnWidth' && e.message.params?.wall === 'wall.front');
    expect(err).toBeTruthy();
  });

  it('error.doorWidth: door width 0', () => {
    const q = clone(defaultProject());
    q.door.width = 0;
    expect(validate(q).some((e) => e.message.key === 'error.doorWidth')).toBe(true);
  });

  it('error.thickness: panel thickness 0', () => {
    const q = clone(defaultProject());
    q.wardrobe.panelThickness = 0;
    expect(validate(q).some((e) => e.message.key === 'error.thickness')).toBe(true);
  });

  it('error.negative: negative plinth', () => {
    const q = clone(defaultProject());
    q.wardrobe.plinthHeight = -10;
    expect(validate(q).some((e) => e.message.key === 'error.negative')).toBe(true);
  });

  it('error.roomTooBig: width above the 20 000 mm limit', () => {
    const q = clone(defaultProject());
    q.room.width = MAX_ROOM_DIM + 1;
    expect(validate(q).some((e) => e.message.key === 'error.roomTooBig')).toBe(true);
    q.room.width = MAX_ROOM_DIM;
    expect(validate(q).some((e) => e.message.key === 'error.roomTooBig')).toBe(false);
  });

  it('error.drawerTooTall: two drawers over the full interior height', () => {
    const q = clone(defaultProject());
    const unit = q.wardrobe.walls.back.segments[0][0];
    if (unit.kind === 'unit') unit.zones = [makeZone('drawers', null, 2)];
    const err = validate(q).find((e) => e.message.key === 'error.drawerTooTall');
    expect(err).toBeTruthy();
    expect(err!.message.params?.n).toBe(MAX_DRAWER_FRONT);
    // ...and a sane drawer stack does not trip it
    if (unit.kind === 'unit') unit.zones = [makeZone('drawers', 600, 3), makeZone('hanging')];
    expect(validate(q).some((e) => e.message.key === 'error.drawerTooTall')).toBe(false);
  });

  it('per-unit errors name the wall and the 1-based unit across both segments', () => {
    const q = clone(defaultProject());
    q.door = { wall: 'back', offset: 1000, width: 800, height: 2100 };
    q.wardrobe.walls.back.segments = [
      [makeUnit(300, [makeZone('open')])],
      [makeUnit(100, [makeZone('open')])], // too narrow -> unit 2 of the wall
    ];
    const err = validate(q).find((e) => e.message.key === 'error.columnWidth');
    expect(err).toBeTruthy();
    expect(err!.message.params?.unit).toBe(2);
    expect(err!.path).toBe('walls.back.segments.1.0');
    expect(tmDeep('en', err!.message)).toContain('Back wall, unit 2');
  });

  it('error.segmentOverflow only numbers the segments of the door wall', () => {
    const q = clone(defaultProject());
    q.wardrobe.walls.back.segments[0].push(makeUnit(600, [makeZone('open')]));
    expect(validate(q).find((e) => e.message.key === 'error.segmentOverflow')!.message.params?.segment).toBe('');
    q.door = { wall: 'back', offset: 1000, width: 800, height: 2100 };
    expect(validate(q).find((e) => e.message.key === 'error.segmentOverflow')!.message.params?.segment).toBe(' #1');
  });

  it('tmDeep renders the wall.* param', () => {
    const q = clone(defaultProject());
    q.wardrobe.walls.back.depth = 100;
    const err = validate(q).find((e) => e.message.key === 'error.wallDepth');
    expect(err).toBeTruthy();
    expect(tmDeep('en', err!.message)).toContain('Back wall');
  });
});
