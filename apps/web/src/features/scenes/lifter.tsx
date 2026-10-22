import { Canvas, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;
const UPPER_ARM = 0.55;
const FOREARM = 0.5;
const SHOULDER_Y = 0.86;
const SHOULDER_Z = 0.42;
const GRIP_Z = 0.7;
const BAR_X = -0.5;
const BAR_LOW = 1.1;
const BAR_HIGH = 1.82;
const MAX_ENERGY = 3;

const SKIN = new THREE.Color("#f0c4a0");
const STRAIN = new THREE.Color("#e8705a");
const UP = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();

type Point = [number, number, number];

function placeSegment(mesh: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  direction.subVectors(to, from);
  const length = direction.length();
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.scale.set(1, length, 1);
}

function Limb({
  from,
  to,
  radius,
  material,
}: {
  from: Point;
  to: Point;
  radius: number;
  material: THREE.Material;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    if (mesh.current)
      placeSegment(mesh.current, new THREE.Vector3(...from), new THREE.Vector3(...to));
  }, [from, to]);

  return (
    <mesh ref={mesh} material={material}>
      <cylinderGeometry args={[radius, radius, 1, 20]} />
    </mesh>
  );
}

interface ArmParts {
  upper: THREE.Mesh | null;
  fore: THREE.Mesh | null;
  elbow: THREE.Mesh | null;
  hand: THREE.Mesh | null;
}

const shoulderPoint = new THREE.Vector3();
const elbowPoint = new THREE.Vector3();
const handPoint = new THREE.Vector3();

function solveArm(side: 1 | -1, barY: number, parts: ArmParts) {
  const sz = side * SHOULDER_Z;
  const hz = side * GRIP_Z;
  const dz = hz - sz;
  const dy = barY - SHOULDER_Y;
  const reach = Math.min(Math.hypot(dz, dy), UPPER_ARM + FOREARM - 0.005);
  const uz = dz / Math.hypot(dz, dy);
  const uy = dy / Math.hypot(dz, dy);
  const along = (UPPER_ARM ** 2 - FOREARM ** 2 + reach ** 2) / (2 * reach);
  const bend = Math.sqrt(Math.max(UPPER_ARM ** 2 - along ** 2, 0));
  const outward = side * -uy >= 0 ? 1 : -1;
  const pz = -uy * outward;
  const py = uz * outward;
  const ez = sz + uz * along + pz * bend;
  const ey = SHOULDER_Y + uy * along + py * bend;

  shoulderPoint.set(BAR_X, SHOULDER_Y, sz);
  elbowPoint.set(BAR_X, ey, ez);
  handPoint.set(BAR_X, barY, hz);

  if (parts.upper) placeSegment(parts.upper, shoulderPoint, elbowPoint);
  if (parts.fore) placeSegment(parts.fore, elbowPoint, handPoint);
  if (parts.elbow) parts.elbow.position.copy(elbowPoint);
  if (parts.hand) parts.hand.position.copy(handPoint);
}

interface SimState {
  phase: number;
  reps: number;
}

function Lifter({
  energy,
  onRep,
  still,
}: {
  energy: MutableRefObject<number>;
  onRep: (reps: number) => void;
  still: boolean;
}) {
  const rig = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Group>(null);
  const sim = useRef<SimState>({ phase: 0, reps: 0 });
  const arms = useRef<ArmParts[]>([
    { upper: null, fore: null, elbow: null, hand: null },
    { upper: null, fore: null, elbow: null, hand: null },
  ]);

  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.55 }), []);
  const shirt = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#12b89a", roughness: 0.6 }),
    [],
  );
  const shorts = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a2b52", roughness: 0.65 }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    energy.current = Math.max(0, energy.current - 0.5 * dt);
    const idle = energy.current <= 0.02;
    const current = sim.current;

    if (!(idle && current.phase === 0)) {
      current.phase += (idle ? 2.4 : 1.8 + energy.current * 1.6) * dt;
      if (current.phase >= TAU) {
        current.reps += 1;
        onRep(current.reps);
        current.phase = idle ? 0 : current.phase - TAU;
      }
    }

    const barY = BAR_LOW + ((1 + Math.cos(current.phase)) / 2) * (BAR_HIGH - BAR_LOW);
    if (bar.current) bar.current.position.y = barY;
    solveArm(1, barY, arms.current[0] as ArmParts);
    solveArm(-1, barY, arms.current[1] as ArmParts);

    skin.color.copy(SKIN).lerp(STRAIN, Math.min(energy.current / MAX_ENERGY, 1));

    const group = rig.current;
    if (group) {
      const swing = still ? 0 : Math.sin(state.clock.elapsedTime * 0.3) * 0.22;
      const target = swing + state.pointer.x * 0.35;
      group.rotation.y += (target - group.rotation.y) * 0.05;
    }
  });

  const setArm = (index: number, part: keyof ArmParts) => (mesh: THREE.Mesh | null) => {
    (arms.current[index] as ArmParts)[part] = mesh;
  };

  return (
    <group ref={rig}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.1, 0, 0]}>
        <circleGeometry args={[3.2, 64]} />
        <meshBasicMaterial color="#b9cff0" transparent opacity={0.35} />
      </mesh>

      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[2.4, 0.12, 0.5]} />
        <meshStandardMaterial color="#1a2b52" roughness={0.5} />
      </mesh>
      {[-0.9, 0.9].flatMap((x) =>
        [-0.18, 0.18].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.19, z]}>
            <boxGeometry args={[0.06, 0.38, 0.06]} />
            <meshStandardMaterial color="#546580" metalness={0.4} roughness={0.4} />
          </mesh>
        )),
      )}

      <mesh
        position={[-0.2, 0.74, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, 1, 1.5]}
        material={shirt}
      >
        <capsuleGeometry args={[0.24, 0.7, 8, 24]} />
      </mesh>
      <mesh position={[0.36, 0.7, 0]} scale={[0.9, 0.7, 1.15]} material={shorts}>
        <sphereGeometry args={[0.27, 24, 16]} />
      </mesh>

      <mesh position={[-0.98, 0.74, 0]} material={skin}>
        <sphereGeometry args={[0.19, 24, 20]} />
      </mesh>
      <mesh position={[-0.98, 0.78, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <torusGeometry args={[0.19, 0.03, 10, 32]} />
        <meshStandardMaterial color="#1a5fe8" roughness={0.5} />
      </mesh>
      {[-0.07, 0.07].map((z) => (
        <mesh key={z} position={[-0.95, 0.92, z]}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshBasicMaterial color="#0e1b33" />
        </mesh>
      ))}
      <Limb from={[-0.84, 0.72, 0]} to={[-0.7, 0.74, 0]} radius={0.09} material={skin} />

      {[-1, 1].map((side) => (
        <group key={side}>
          <Limb
            from={[0.36, 0.72, side * 0.17]}
            to={[0.95, 0.88, side * 0.2]}
            radius={0.13}
            material={shorts}
          />
          <Limb
            from={[0.95, 0.88, side * 0.2]}
            to={[1.12, 0.1, side * 0.2]}
            radius={0.095}
            material={skin}
          />
          <mesh position={[1.2, 0.04, side * 0.2]}>
            <boxGeometry args={[0.3, 0.08, 0.13]} />
            <meshStandardMaterial color="#0e1b33" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {([1, -1] as const).map((side, index) => (
        <group key={side}>
          <mesh ref={setArm(index, "upper")} material={skin}>
            <cylinderGeometry args={[0.085, 0.075, 1, 16]} />
          </mesh>
          <mesh ref={setArm(index, "fore")} material={skin}>
            <cylinderGeometry args={[0.07, 0.06, 1, 16]} />
          </mesh>
          <mesh ref={setArm(index, "elbow")} material={skin}>
            <sphereGeometry args={[0.08, 16, 12]} />
          </mesh>
          <mesh ref={setArm(index, "hand")} material={skin}>
            <sphereGeometry args={[0.075, 16, 12]} />
          </mesh>
          <mesh position={[BAR_X, SHOULDER_Y, side * SHOULDER_Z]} material={skin}>
            <sphereGeometry args={[0.1, 16, 12]} />
          </mesh>
        </group>
      ))}

      <group ref={bar} position={[BAR_X, BAR_HIGH, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 2.9, 16]} />
          <meshStandardMaterial color="#dbe4f2" metalness={0.55} roughness={0.3} />
        </mesh>
        {[-1, 1].flatMap((side) =>
          [
            { z: 1.0, radius: 0.42, color: "#1a5fe8" },
            { z: 1.1, radius: 0.34, color: "#12b89a" },
            { z: 1.19, radius: 0.26, color: "#ff8a4c" },
          ].map((plate) => (
            <mesh
              key={`${side}${plate.z}`}
              position={[0, 0, side * plate.z]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[plate.radius, plate.radius, 0.08, 40]} />
              <meshStandardMaterial color={plate.color} metalness={0.25} roughness={0.4} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}

export default function LifterScene({
  energy,
  onRep,
  still,
}: {
  energy: MutableRefObject<number>;
  onRep: (reps: number) => void;
  still: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [3.6, 2.4, 5], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ camera }) => camera.lookAt(0.1, 0.95, 0)}
    >
      <ambientLight intensity={1} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} />
      <directionalLight position={[-5, 2, -3]} intensity={0.8} color="#7fd8ff" />
      <Lifter energy={energy} onRep={onRep} still={still} />
    </Canvas>
  );
}
