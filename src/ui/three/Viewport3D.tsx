import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useStore } from '../../store/store';
import { buildParts } from '../../geometry/parts';
import { layoutAll } from '../../geometry/layout';
import { WALLS, localToWorld, wallFrame, wallLength } from '../../geometry/frames';
import { rotY, v3, type Vec3 } from '../../geometry/vec';
import type { Room, Wall } from '../../model/types';
import { cacheSnapshot, setSnapshotSource } from '../snapshot';
import { PartMesh } from './PartMesh';
import { RoomMesh } from './RoomMesh';
import { useT } from '../useT';
import type { MessageKey } from '../../i18n';

/** Keeps `snapshot.ts` supplied with the live canvas, and refreshes its cache as the model settles. */
function SnapshotBridge({ version }: { version: unknown }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    setSnapshotSource(() => gl.domElement);
    return () => {
      cacheSnapshot(); // last look at the canvas before the viewport goes away
      setSnapshotSource(null);
    };
  }, [gl]);
  useEffect(() => {
    const id = setTimeout(cacheSnapshot, 500); // let the new geometry render first
    return () => clearTimeout(id);
  }, [version, gl]);
  return null;
}

/** Orbit pivot, and the point the default camera looks at. */
const cameraTarget = (room: Room): THREE.Vector3 => new THREE.Vector3(room.width / 2, room.height * 0.35, room.depth / 2);

function CameraFit({ room }: { room: Room }) {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const size = useThree((s) => s.size);
  const { width: W, depth: D, height: H } = room;
  const fittedRef = useRef<string | null>(null);
  useEffect(() => {
    // `size` is a dependency only so that the first fit sees a real aspect ratio — a later
    // resize must not snap the camera back and throw away the user's orbit. R3F keeps
    // camera.aspect and the projection matrix in step with the canvas on its own.
    if (!size.width || !size.height) return;
    const key = `${W}x${D}x${H}`;
    if (fittedRef.current === key) return;
    fittedRef.current = key;
    const target = new THREE.Vector3(W / 2, H * 0.35, D / 2);
    // Front-right-above corner: the back run and the left run both face the camera.
    const base = new THREE.Vector3(W * 1.25, H * 1.5, D * 1.55);
    const dir = base.clone().sub(target).normalize();
    // Never crop the room: back off far enough that its bounding sphere (about `target`)
    // fits the narrower of the two frustum half-angles.
    const radius = Math.hypot(W / 2, H * 0.65, D / 2);
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const distance = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.05;
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.near = 10;
    camera.far = distance + radius * 8;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, W, D, H, size.width, size.height]);
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

export function Viewport3D() {
  const project = useStore((s) => s.lastValid);
  // Only the three viewport controls: selecting the whole `ui` slice re-rendered the scene on
  // every toast, tab switch and selection change.
  const showDims = useStore((s) => s.ui.showDims);
  const showRoom = useStore((s) => s.ui.showRoom);
  const explode = useStore((s) => s.ui.explode);
  const setUi = useStore((s) => s.setUi);
  const { t } = useT();
  const { room } = project;

  const parts = useMemo(() => buildParts(project), [project]);
  const columns = useMemo(() => layoutAll(project), [project]);
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
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ fov: 45 }} style={{ background: '#f0f2f5' }}>
        <CameraFit room={room} />
        <FadeTracker room={room} onChange={onFadeChange} />
        <SnapshotBridge version={parts} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[-2000, 4000, 3000]} intensity={1.1} />
        <directionalLight position={[3000, 2000, -2000]} intensity={0.4} />
        <RoomMesh room={room} door={project.door} showRoom={showRoom} />
        {parts.map((p) => (
          <PartMesh key={p.id} part={p} explode={explode} explodeDir={explodeDirs[p.wall]} faded={fadedWalls.has(p.wall)} />
        ))}
        {showDims && (
          <group>
            {columns.map((L) => {
              if (L.kind !== 'unit') return null;
              const frame = wallFrame(room, L.wall);
              const p = localToWorld(frame, v3((L.s0 + L.s1) / 2, -60, L.depth + 80));
              return (
                <Html key={`${L.wall}-${L.columnIndex}`} position={[p.x, p.y, p.z]} center>
                  <div className="dim3d">{Math.round(L.width)}</div>
                </Html>
              );
            })}
            {WALLS.filter((w) => project.wardrobe.walls[w].enabled).map((w) => {
              const frame = wallFrame(room, w);
              const p = localToWorld(frame, v3(wallLength(room, w) / 2, room.height + 80, project.wardrobe.walls[w].depth / 2));
              return (
                <Html key={w} position={[p.x, p.y, p.z]} center>
                  <div className="dim3d">{t(`wall.${w}` as MessageKey)}</div>
                </Html>
              );
            })}
          </group>
        )}
        <OrbitControls makeDefault target={[target.x, target.y, target.z]} />
      </Canvas>
      <div className="controls">
        <label>
          <input type="checkbox" checked={showDims} onChange={(e) => setUi({ showDims: e.target.checked })} /> {t('ui.dims')}
        </label>
        <label>
          <input type="checkbox" checked={showRoom} onChange={(e) => setUi({ showRoom: e.target.checked })} /> {t('ui.room')}
        </label>
        <label>
          {t('ui.explode')}{' '}
          <input type="range" min={0} max={1} step={0.05} value={explode} onChange={(e) => setUi({ explode: e.target.valueAsNumber })} />
        </label>
      </div>
    </div>
  );
}
