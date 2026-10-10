import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useStore } from '../../store/store';
import { buildParts } from '../../geometry/parts';
import { layoutAll } from '../../geometry/layout';
import { WALLS, localToWorld, wallFrame, wallLength } from '../../geometry/frames';
import { rotY, v3, type Vec3 } from '../../geometry/vec';
import type { Project, Room, Wall } from '../../model/types';
import { cacheSnapshot, clearSnapshot, setSnapshotSource } from '../snapshot';
import { PartMesh } from './PartMesh';
import { RoomMesh } from './RoomMesh';
import { useT } from '../useT';
import { useMediaQuery } from '../useMediaQuery';
import { Segmented, Switch } from '../controls';
import { PlanEditor } from '../PlanEditor';
import { LIGHT, sceneColors } from './colors';
import { labelDistanceFactor, wallLabels, widthLabels } from './dimLabels';
import type { MessageKey } from '../../i18n';

/**
 * Keeps `snapshot.ts` supplied with the live canvas, and refreshes its cache as the model settles.
 *
 * The PDF picture is always the light scene. So the live canvas is only handed over while it is
 * drawn LIGHT; in the dark theme the bridge withdraws it and drops the cache, and `takeSnapshot`
 * falls back to the off-screen render, which forces LIGHT. Otherwise a dark-theme user who opened
 * 3D once would print a dark picture.
 */
function SnapshotBridge({ version, light }: { version: unknown; light: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!light) {
      setSnapshotSource(null);
      clearSnapshot();
      return;
    }
    setSnapshotSource(() => gl.domElement);
    return () => {
      cacheSnapshot(); // last look at the canvas before the viewport goes away (or turns dark)
      setSnapshotSource(null);
    };
  }, [gl, light]);
  useEffect(() => {
    if (!light) return;
    const id = setTimeout(cacheSnapshot, 500); // let the new geometry render first
    return () => clearTimeout(id);
  }, [version, gl, light]);
  return null;
}

/** Orbit pivot, and the point the default camera looks at. */
const cameraTarget = (room: Room): THREE.Vector3 => new THREE.Vector3(room.width / 2, room.height * 0.35, room.depth / 2);

/** Camera presets: the default corner view, a straight look at one wall's inside face, or the plan from above. */
export type ViewPreset = 'iso' | 'top' | Wall;
export const VIEW_PRESETS: ViewPreset[] = ['iso', 'back', 'left', 'right', 'top'];

/**
 * The dimension callouts. Width callouts are world-sized so they shrink with the room instead of
 * piling up as it recedes (see `dimLabels.ts`); wall names keep a fixed pixel size — they float at
 * the ceiling, well clear of the floor-level widths, and world-sized they would balloon in the top
 * view, where the ceiling is nearest the camera.
 */
function DimLabels({ project }: { project: Project }) {
  const height = useThree((s) => s.size.height);
  const { t, lang, units } = useT();
  const widths = useMemo(() => widthLabels(project, layoutAll(project), units), [project, units]);
  // `t` is a fresh closure every render; `lang` is all it reads here.
  const names = useMemo(() => wallLabels(project, (w) => t(`wall.${w}` as MessageKey)), [project, lang]);
  const factor = labelDistanceFactor(height);
  return (
    <group>
      {widths.map((l) => (
        <Html key={l.key} position={[l.at.x, l.at.y, l.at.z]} center distanceFactor={factor}>
          <div className="dim3d">{l.text}</div>
        </Html>
      ))}
      {names.map((l) => (
        <Html key={l.key} position={[l.at.x, l.at.y, l.at.z]} center>
          <div className="dim3d">{l.text}</div>
        </Html>
      ))}
    </group>
  );
}

const FIT_MARGIN = 1.05; // breathing room around the fitted room
const WALL_FIT_MARGIN = 1.15;
const WALL_EYE_HEIGHT = 0.5; // wall presets: camera height as a fraction of the room height
/** Top view: a hair of +z so the camera is not exactly on the pole (OrbitControls' singular
 * direction) and the screen's up stays -z, the back wall at the top as in the plan. */
const TOP_TILT = 0.001;

function CameraFit({ room, preset, nonce }: { room: Room; preset: ViewPreset; nonce: number }) {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const size = useThree((s) => s.size);
  const { width: W, depth: D, height: H } = room;
  const fittedRef = useRef<string | null>(null);
  useEffect(() => {
    // `size` is a dependency only so that the first fit sees a real aspect ratio — a later
    // resize must not snap the camera back and throw away the user's orbit. R3F keeps
    // camera.aspect and the projection matrix in step with the canvas on its own.
    if (!size.width || !size.height) return;
    const key = `${preset}:${nonce}:${W}x${D}x${H}`;
    if (fittedRef.current === key) return;
    fittedRef.current = key;
    const target = new THREE.Vector3(W / 2, H * 0.35, D / 2);
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    // Never crop the room: back off far enough that its bounding sphere (about `target`)
    // fits the narrower of the two frustum half-angles.
    const radius = Math.hypot(W / 2, H * 0.65, D / 2);
    let distance = (radius / Math.sin(Math.min(vHalf, hHalf))) * FIT_MARGIN;
    if (preset === 'iso') {
      // Front-right-above corner: the back run and the left run both face the camera.
      const base = new THREE.Vector3(W * 1.25, H * 1.5, D * 1.55);
      camera.position.copy(target).addScaledVector(base.sub(target).normalize(), distance);
    } else if (preset === 'top') {
      distance = Math.max(D / 2 / Math.tan(vHalf), W / 2 / Math.tan(hHalf)) * WALL_FIT_MARGIN + H * 0.65;
      camera.position.set(target.x, target.y + distance, target.z + distance * TOP_TILT);
    } else {
      // In front of the wall's inside face, centred on it, looking across the room at the target.
      const frame = wallFrame(room, preset);
      const inward = rotY(v3(0, 0, 1), frame.yaw);
      const mid = localToWorld(frame, v3(wallLength(room, preset) / 2, 0, 0));
      const wallW = wallLength(room, preset);
      const fit = Math.max((H * 0.8) / Math.tan(vHalf), wallW / 2 / Math.tan(hHalf)) * WALL_FIT_MARGIN;
      distance = fit + Math.max(W, D); // `fit` is measured from the wall plane; the far wall is up to a room away
      camera.position.set(mid.x + inward.x * fit, H * WALL_EYE_HEIGHT, mid.z + inward.z * fit);
    }
    camera.near = 10;
    camera.far = distance + radius * 8;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, room, W, D, H, preset, nonce, size.width, size.height]);
  return null;
}

/** Reports which walls the camera is currently *outside* of — their units sit between the
 * viewer and the room, so they fade the way the room wall itself is culled. */
function FadeTracker({ room, onChange }: { room: Room; onChange: (walls: Set<Wall>) => void }) {
  const keyRef = useRef<string | null>(null);
  useFrame(({ camera }) => {
    const { x, z } = camera.position;
    const outside = WALLS.filter((w) =>
      w === 'back' ? z < 0 : w === 'front' ? z > room.depth : w === 'left' ? x < 0 : x > room.width,
    );
    const key = outside.join('|');
    if (key === keyRef.current) return;
    keyRef.current = key;
    onChange(new Set(outside));
  });
  return null;
}

/**
 * Fires once, from the first frame after the whole scene (the parts included) has mounted. The
 * off-screen renderer waits for it — and then for one more animation frame, because R3F runs the
 * `useFrame` subscriptions *before* it draws, so nothing is on the buffer yet when this fires.
 */
function FirstFrame({ onFirstFrame }: { onFirstFrame: () => void }) {
  const firedRef = useRef(false);
  useFrame(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onFirstFrame();
  });
  return null;
}

export interface Viewport3DProps {
  /** Renders this project instead of the store's `lastValid` — the off-screen snapshot passes the
   * project being exported so it never depends on what the live viewport happens to hold. */
  project?: Project;
  /** Off-screen capture: no overlay controls, no orbiting, and the global snapshot cache is left
   * alone — the live viewport owns it, and this canvas is read directly by its own renderer. */
  snapshotOnly?: boolean;
  onFirstFrame?: () => void;
}

export function Viewport3D({ project: projectProp, snapshotOnly = false, onFirstFrame }: Viewport3DProps) {
  const storeProject = useStore((s) => s.lastValid);
  const project = projectProp ?? storeProject;
  // Only the three viewport controls: selecting the whole `ui` slice re-rendered the scene on
  // every toast, tab switch and selection change.
  const showDims = useStore((s) => s.ui.showDims);
  const showRoom = useStore((s) => s.ui.showRoom);
  const explode = useStore((s) => s.ui.explode);
  const setUi = useStore((s) => s.setUi);
  const theme = useStore((s) => s.ui.theme);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  // The PDF picture must not change with the screen theme.
  const colors = snapshotOnly ? LIGHT : sceneColors(theme, prefersDark);
  const [view, setView] = useState<{ preset: ViewPreset; nonce: number }>({ preset: 'iso', nonce: 0 });
  const { t } = useT();
  const { room } = project;

  const parts = useMemo(() => buildParts(project), [project]);
  /** Wall-local +z in world space: the direction parts explode away from their wall. */
  const explodeDirs = useMemo(() => {
    const out = {} as Record<Wall, Vec3>;
    for (const w of WALLS) out[w] = rotY(v3(0, 0, 1), wallFrame(room, w).yaw);
    return out;
  }, [room]);

  const [fadedWalls, setFadedWalls] = useState<Set<Wall>>(() => new Set());
  const onFadeChange = useCallback((walls: Set<Wall>) => setFadedWalls(walls), []);
  const target = useMemo(() => cameraTarget(room), [room]);

  return (
    <div className="viewport">
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ fov: 45 }} style={{ background: colors.background }}>
        <CameraFit room={room} preset={view.preset} nonce={view.nonce} />
        <FadeTracker room={room} onChange={onFadeChange} />
        {!snapshotOnly && <SnapshotBridge version={parts} light={colors === LIGHT} />}
        <ambientLight intensity={0.75} />
        <directionalLight position={[-2000, 4000, 3000]} intensity={1.1} />
        <directionalLight position={[3000, 2000, -2000]} intensity={0.4} />
        <RoomMesh room={room} door={project.door} showRoom={showRoom} colors={colors} />
        {parts.map((p) => (
          <PartMesh key={p.id} part={p} explode={explode} explodeDir={explodeDirs[p.wall]} colors={colors} faded={fadedWalls.has(p.wall)} />
        ))}
        {showDims && <DimLabels project={project} />}
        {!snapshotOnly && <OrbitControls makeDefault target={[target.x, target.y, target.z]} />}
        {onFirstFrame && <FirstFrame onFirstFrame={onFirstFrame} />}
      </Canvas>
      {!snapshotOnly && (
        <>
          <div className="float float-views">
            <Segmented
              ariaLabel={t('ui.view.label')}
              title={t('ui.viewHint')}
              value={view.preset}
              options={VIEW_PRESETS.map((v) => ({ value: v, label: t(v === 'iso' || v === 'top' ? (`ui.view.${v}` as MessageKey) : (`wall.${v}` as MessageKey)) }))}
              // Bumping the nonce even for the active preset is deliberate: clicking it again re-fits the
              // camera, throwing away the user's orbit — the "reset the view" affordance (see `ui.viewHint`).
              onChange={(preset) => setView((v) => ({ preset, nonce: v.nonce + 1 }))}
            />
          </div>
          <div className="float float-toggles">
            <Switch checked={showDims} onChange={(v) => setUi({ showDims: v })} label={t('ui.dims')} />
            <Switch checked={showRoom} onChange={(v) => setUi({ showRoom: v })} label={t('ui.room')} />
            <label className="explode">
              <span>{t('ui.explode')}</span>
              <input type="range" min={0} max={1} step={0.05} value={explode} onChange={(e) => setUi({ explode: e.target.valueAsNumber })} />
            </label>
          </div>
          <div className="float minimap">
            <PlanEditor size="thumb" />
          </div>
        </>
      )}
    </div>
  );
}
