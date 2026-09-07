import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { doorArc, doorSpan, localToWorld, wallFrame } from '../../geometry/frames';
import { v3 } from '../../geometry/vec';
import type { Door, Room } from '../../model/types';

type P3 = [number, number, number];

const DOOR_OFFSET = 2; // mm proud of the wall, so the leaf never z-fights with it
const ARC_SEGMENTS = 16;
const FLOOR_Y = 1; // just above the floor plane, so the sweep lines are not z-fought away

export function RoomMesh({ room, door, showRoom }: { room: Room; door: Door; showRoom: boolean }) {
  const { width: W, depth: D, height: H } = room;

  // Every wall plane is placed so its normal (planeGeometry faces local +z) points INTO the room;
  // with side=FrontSide the walls between the camera and the room are culled ("dollhouse" view).
  const walls: { key: string; position: P3; rotation: P3; size: [number, number] }[] = [
    { key: 'back', position: [W / 2, H / 2, 0], rotation: [0, 0, 0], size: [W, H] },
    { key: 'front', position: [W / 2, H / 2, D], rotation: [0, Math.PI, 0], size: [W, H] },
    { key: 'left', position: [0, H / 2, D / 2], rotation: [0, Math.PI / 2, 0], size: [D, H] },
    { key: 'right', position: [W, H / 2, D / 2], rotation: [0, -Math.PI / 2, 0], size: [D, H] },
  ];

  const floorRect: P3[] = [[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D], [0, 0, 0]];
  const ceilRect: P3[] = floorRect.map(([x, , z]) => [x, H, z]);
  const verticals: P3[][] = [[0, 0], [W, 0], [W, D], [0, D]].map(([x, z]) => [[x, 0, z], [x, H, z]]);

  const doorGeom = useMemo(() => {
    const span = doorSpan({ room, door });
    const frame = wallFrame(room, door.wall);
    const c = localToWorld(frame, v3((span.s0 + span.s1) / 2, door.height / 2, DOOR_OFFSET));
    // Swing arc and open leaf on the floor, hinged and swinging per the door's hinge / swing.
    const swing = doorArc({ room, door }, ARC_SEGMENTS);
    const floor = (v: { x: number; z: number }): P3 => [v.x, FLOOR_Y, v.z];
    return {
      position: [c.x, c.y, c.z] as P3,
      rotation: [0, frame.yaw, 0] as P3,
      arc: swing.arc.map(floor),
      leaf: [floor(swing.hinge), floor(swing.tip)],
    };
  }, [room, door]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, -1, D / 2]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#e6e3dd" side={THREE.DoubleSide} />
      </mesh>
      {showRoom && (
        <group>
          {walls.map((w) => (
            <mesh key={w.key} position={w.position} rotation={w.rotation}>
              <planeGeometry args={w.size} />
              <meshStandardMaterial color="#f3f1ec" side={THREE.FrontSide} transparent opacity={0.9} />
            </mesh>
          ))}
          <Line points={floorRect} color="#777" lineWidth={1} />
          <Line points={ceilRect} color="#777" lineWidth={1} />
          {verticals.map((pts, i) => (
            <Line key={i} points={pts} color="#777" lineWidth={1} />
          ))}
          {/* Double-sided and see-through: its wall is culled in the dollhouse view, so an opaque
              leaf would be the one thing standing between the camera and the room. */}
          <mesh position={doorGeom.position} rotation={doorGeom.rotation}>
            <planeGeometry args={[door.width, door.height]} />
            <meshStandardMaterial color="#c8b7a6" side={THREE.DoubleSide} transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <Line points={doorGeom.arc} color="#777" lineWidth={1} dashed dashSize={40} gapSize={25} />
          <Line points={doorGeom.leaf} color="#777" lineWidth={1} dashed dashSize={40} gapSize={25} />
        </group>
      )}
    </group>
  );
}
