import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface PlateSpec {
  z: number;
  radius: number;
  thickness: number;
  color: string;
}

const PLATES: PlateSpec[] = [
  { z: -0.55, radius: 1.55, thickness: 0.3, color: "#1a5fe8" },
  { z: -0.17, radius: 1.3, thickness: 0.26, color: "#12b89a" },
  { z: 0.17, radius: 1.05, thickness: 0.22, color: "#ff8a4c" },
];

const BAR_RADIUS = 0.16;
const HOLE_RADIUS = 0.2;

function plateGeometry({ radius, thickness }: PlateSpec): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, HOLE_RADIUS, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 5,
    curveSegments: 72,
  });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

function Plate({ spec }: { spec: PlateSpec }) {
  const geometry = useMemo(() => plateGeometry(spec), [spec]);
  const face = spec.thickness / 2 + 0.06;

  return (
    <group position={[0, 0, spec.z]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={spec.color} metalness={0.25} roughness={0.38} />
      </mesh>
      {[face, -face].map((offset) => (
        <mesh key={offset} position={[0, 0, offset]}>
          <torusGeometry args={[spec.radius * 0.74, 0.025, 12, 96]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.45} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Rig({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    const rig = group.current;
    if (!rig) return;
    const t = state.clock.elapsedTime;
    const swing = still ? 0 : Math.sin(t * 0.35) * 0.45;
    const targetY = 0.95 + swing + state.pointer.x * 0.5;
    const targetX = 0.28 - state.pointer.y * 0.25;
    rig.rotation.y += (targetY - rig.rotation.y) * 0.06;
    rig.rotation.x += (targetX - rig.rotation.x) * 0.06;
    rig.position.y = still ? 0 : Math.sin(t * 1.1) * 0.08;
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, 3.2, 32]} />
        <meshStandardMaterial color="#dbe4f2" metalness={0.55} roughness={0.3} />
      </mesh>
      {PLATES.map((spec) => (
        <Plate key={spec.z} spec={spec} />
      ))}
      <mesh position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.22, 32]} />
        <meshStandardMaterial color="#0e1b33" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

export default function BarbellScene({
  still,
  distance = 9.4,
}: {
  still: boolean;
  distance?: number;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.4, distance], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 5, 6]} intensity={2.2} />
      <directionalLight position={[-5, -2, 3]} intensity={0.9} color="#7fd8ff" />
      <Rig still={still} />
    </Canvas>
  );
}
