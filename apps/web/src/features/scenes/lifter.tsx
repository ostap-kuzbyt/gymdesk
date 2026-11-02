import { Canvas, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { BAR_HIGH, MAX_ENERGY, initialSim, legAngles, moodOf, physique, step } from "./lifter-sim";
import type { Controls, Mood, Physique, Sim } from "./lifter-sim";

const UPPER_ARM = 0.55;
const FOREARM = 0.5;
const SHOULDER_Y = 0.86;
const SHOULDER_Z = 0.44;
const GRIP_Z = 0.7;
const BAR_X = -0.5;
const BENCH_TOP = 0.5;

const SKIN = new THREE.Color("#e9b996");
const STRAIN = new THREE.Color("#df6a55");
const UP = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();

type Point = [number, number, number];

function placeSegment(mesh: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, thickness = 1) {
  direction.subVectors(to, from);
  const length = direction.length();
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.scale.set(thickness, length, thickness);
}

function Limb({
  from,
  to,
  top,
  bottom,
  material,
}: {
  from: Point;
  to: Point;
  top: number;
  bottom: number;
  material: THREE.Material;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    if (mesh.current) {
      placeSegment(mesh.current, new THREE.Vector3(...from), new THREE.Vector3(...to));
    }
  }, [from, to]);

  return (
    <mesh ref={mesh} material={material}>
      <cylinderGeometry args={[top, bottom, 1, 20]} />
    </mesh>
  );
}

interface ArmParts {
  upper: THREE.Mesh | null;
  fore: THREE.Mesh | null;
  elbow: THREE.Mesh | null;
  hand: THREE.Mesh | null;
}

interface LegParts {
  thigh: THREE.Mesh | null;
  shin: THREE.Mesh | null;
  shoe: THREE.Object3D | null;
}

const shoulderPoint = new THREE.Vector3();
const elbowPoint = new THREE.Vector3();
const handPoint = new THREE.Vector3();
const hipPoint = new THREE.Vector3();
const kneePoint = new THREE.Vector3();
const footPoint = new THREE.Vector3();

function solveArm(side: 1 | -1, barY: number, parts: ArmParts, body: Physique, limp: number) {
  const sz = side * SHOULDER_Z;
  const hz = side * (GRIP_Z + (0.62 - GRIP_Z) * limp);
  const handY = barY + (0.45 - barY) * limp;
  const dz = hz - sz;
  const dy = handY - SHOULDER_Y;
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
  handPoint.set(BAR_X, handY, hz);

  if (parts.upper) placeSegment(parts.upper, shoulderPoint, elbowPoint, body.arms);
  if (parts.fore) placeSegment(parts.fore, elbowPoint, handPoint, body.arms);
  if (parts.elbow) {
    parts.elbow.position.copy(elbowPoint);
    parts.elbow.scale.setScalar(body.arms * 0.92);
  }
  if (parts.hand) {
    parts.hand.position.copy(handPoint);
    parts.hand.scale.setScalar(body.hands);
  }
}

function solveLeg(
  side: 1 | -1,
  time: number,
  struggle: number,
  body: Physique,
  limp: number,
  parts: LegParts,
) {
  const { thigh: thighAngle, shin: shinAngle } = legAngles(side, time, struggle, limp);

  hipPoint.set(0.36, 0.72, side * 0.17);
  kneePoint.set(
    hipPoint.x + 0.62 * Math.cos(thighAngle),
    hipPoint.y + 0.62 * Math.sin(thighAngle),
    side * (0.45 + 0.04 * Math.sin(thighAngle)),
  );
  footPoint.set(
    kneePoint.x + 0.76 * Math.cos(shinAngle),
    Math.max(kneePoint.y + 0.76 * Math.sin(shinAngle), 0.07),
    kneePoint.z + side * 0.1,
  );

  if (parts.thigh) placeSegment(parts.thigh, hipPoint, kneePoint, body.thighs);
  if (parts.shin) placeSegment(parts.shin, kneePoint, footPoint, body.shins);
  if (parts.shoe) {
    parts.shoe.position.set(footPoint.x + 0.07, footPoint.y - 0.02, footPoint.z);
    parts.shoe.rotation.z = shinAngle + Math.PI / 2;
  }
}

function Lifter({
  controls,
  onRep,
  onMood,
  onMax,
  still,
}: {
  controls: MutableRefObject<Controls>;
  onRep: (reps: number) => void;
  onMood: (mood: Mood) => void;
  onMax: () => void;
  still: boolean;
}) {
  const rig = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Mesh>(null);
  const waist = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const tongue = useRef<THREE.Mesh>(null);
  const eyeMarks = useRef<THREE.Group>(null);
  const pupils = useRef<(THREE.Mesh | null)[]>([null, null]);
  const sim = useRef<Sim>(initialSim);
  const mood = useRef<Mood>("idle");
  const shoulders = useRef<(THREE.Mesh | null)[]>([null, null]);
  const arms = useRef<ArmParts[]>([
    { upper: null, fore: null, elbow: null, hand: null },
    { upper: null, fore: null, elbow: null, hand: null },
  ]);
  const legs = useRef<LegParts[]>([
    { thigh: null, shin: null, shoe: null },
    { thigh: null, shin: null, shoe: null },
  ]);

  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 }), []);
  const shirt = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#12b89a", roughness: 0.7 }),
    [],
  );
  const shorts = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a2b52", roughness: 0.75 }),
    [],
  );
  const hair = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#3a2a22", roughness: 0.9 }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;
    const input = controls.current;
    input.energy = Math.max(0, input.energy - 0.5 * dt);
    const boost = input.boost;
    const resetPump = input.resetPump;
    input.boost = 0;
    input.resetPump = null;

    const { sim: next, repDone, maxed } = step(sim.current, dt, input.energy, boost, resetPump);
    sim.current = next;
    if (repDone) onRep(next.reps);
    if (maxed) onMax();

    const nextMood = moodOf(next.mode);
    if (nextMood !== mood.current) {
      mood.current = nextMood;
      onMood(nextMood);
    }

    const strain = Math.min(Math.max(input.energy / MAX_ENERGY, next.struggle * 0.9), 1);
    const body = physique(next.pump);
    const barY = next.barY + Math.sin(time * 38) * 0.012 * next.struggle;
    if (bar.current) bar.current.position.y = barY;
    solveArm(1, barY, arms.current[0] as ArmParts, body, next.limp);
    solveArm(-1, barY, arms.current[1] as ArmParts, body, next.limp);
    shoulders.current.forEach((mesh) => mesh?.scale.setScalar(body.shoulders));
    solveLeg(1, time, next.struggle, body, next.limp, legs.current[0] as LegParts);
    solveLeg(-1, time, next.struggle, body, next.limp, legs.current[1] as LegParts);

    const breath = Math.sin(time * (2 + strain * 5)) * (0.012 + strain * 0.02);
    if (chest.current) {
      const heave = 1 + breath + 0.04 * next.struggle * Math.sin(time * 18);
      const size = body.chest;
      chest.current.scale.set(
        0.95 * size * heave,
        0.85 * size * (1 - 0.22 * next.limp),
        1.3 * size,
      );
    }
    if (waist.current) {
      const size = body.waist;
      waist.current.scale.set(1, size, 1.25 * size);
    }
    const beaten = next.limp > 0.5;
    if (mouth.current) {
      mouth.current.scale.set(1, 1 + 4 * Math.max(strain, next.limp), 1 + 0.6 * strain);
    }
    tongue.current?.scale.setScalar(beaten ? 1 : 0.001);
    eyeMarks.current?.scale.setScalar(beaten ? 1 : 0.001);
    pupils.current.forEach((mesh) => mesh?.scale.setScalar(beaten ? 0.001 : 1));

    skin.color.copy(SKIN).lerp(STRAIN, strain);

    const group = rig.current;
    if (group) {
      const swing = still ? 0 : Math.sin(time * 0.3) * 0.22;
      const target = swing + state.pointer.x * 0.35;
      group.rotation.y += (target - group.rotation.y) * 0.05;
    }
  });

  const setArm = (index: number, part: keyof ArmParts) => (mesh: THREE.Mesh | null) => {
    (arms.current[index] as ArmParts)[part] = mesh;
  };
  const setLeg = (index: number, part: "thigh" | "shin") => (mesh: THREE.Mesh | null) => {
    (legs.current[index] as LegParts)[part] = mesh;
  };

  return (
    <group ref={rig}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.1, 0, 0]}>
        <circleGeometry args={[3.2, 64]} />
        <meshBasicMaterial color="#b9cff0" transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.1, 0.004, 0]} scale={[1.5, 0.7, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#0e1b33" transparent opacity={0.12} />
      </mesh>

      <mesh position={[0, BENCH_TOP - 0.06, 0]}>
        <boxGeometry args={[2.4, 0.12, 0.5]} />
        <meshStandardMaterial color="#1a2b52" roughness={0.55} />
      </mesh>
      {[-0.22, 0.22].map((z) => (
        <mesh key={z} position={[0, BENCH_TOP - 0.115, z * 0.9]}>
          <boxGeometry args={[2.38, 0.012, 0.012]} />
          <meshStandardMaterial color="#3a4f86" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[2.1, 0.05, 0.12]} />
        <meshStandardMaterial color="#546580" metalness={0.5} roughness={0.35} />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.15, 0]}>
            <boxGeometry args={[0.08, 0.3, 0.5]} />
            <meshStandardMaterial color="#546580" metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[x, 0.01, 0]}>
            <boxGeometry args={[0.1, 0.02, 0.72]} />
            <meshStandardMaterial color="#27324d" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {[-1, 1].map((side) => (
        <group key={side} position={[BAR_X - 0.05, 0, side * 1.5]}>
          <mesh position={[0, 0.78, 0]}>
            <boxGeometry args={[0.1, 1.56, 0.1]} />
            <meshStandardMaterial color="#27324d" metalness={0.4} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.7, 0.04, 0.5]} />
            <meshStandardMaterial color="#27324d" roughness={0.6} />
          </mesh>
          <mesh position={[0.02, 1.52, side * -0.1]}>
            <boxGeometry args={[0.1, 0.05, 0.3]} />
            <meshStandardMaterial color="#27324d" metalness={0.4} roughness={0.45} />
          </mesh>
        </group>
      ))}

      <mesh ref={chest} position={[-0.38, 0.78, 0]} scale={[0.95, 0.85, 1.3]} material={shirt}>
        <sphereGeometry args={[0.3, 32, 24]} />
      </mesh>
      <mesh
        ref={waist}
        position={[0.12, 0.72, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, 1, 1.25]}
        material={shirt}
      >
        <capsuleGeometry args={[0.2, 0.28, 8, 20]} />
      </mesh>
      <mesh position={[0.4, 0.7, 0]} scale={[0.95, 0.72, 1.2]} material={shorts}>
        <sphereGeometry args={[0.27, 24, 16]} />
      </mesh>
      <mesh position={[0.3, 0.74, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.215, 0.215, 0.05, 24]} />
        <meshStandardMaterial color="#12b89a" roughness={0.6} />
      </mesh>

      <Limb
        from={[-0.86, 0.72, 0]}
        to={[-0.68, 0.76, 0]}
        top={0.09}
        bottom={0.08}
        material={skin}
      />
      <mesh position={[-1.02, 0.74, 0]} scale={[1.05, 0.88, 0.85]} material={skin}>
        <sphereGeometry args={[0.19, 32, 24]} />
      </mesh>
      <mesh position={[-1.1, 0.745, 0]} scale={[0.95, 0.85, 0.9]} material={hair}>
        <sphereGeometry args={[0.19, 24, 18]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[-1.0, 0.74, side * 0.185]} scale={[0.5, 1, 0.35]} material={skin}>
            <sphereGeometry args={[0.06, 12, 10]} />
          </mesh>
          <mesh position={[-1.045, 0.91, side * 0.07]}>
            <sphereGeometry args={[0.032, 12, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
          <mesh
            ref={(mesh) => {
              pupils.current[side > 0 ? 0 : 1] = mesh;
            }}
            position={[-1.045, 0.935, side * 0.07]}
          >
            <sphereGeometry args={[0.016, 10, 8]} />
            <meshBasicMaterial color="#1a1410" />
          </mesh>
          <mesh
            position={[-1.078, 0.912, side * 0.075]}
            rotation={[0, side * 0.25, 0]}
            material={hair}
          >
            <boxGeometry args={[0.012, 0.012, 0.075]} />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.97, 0.93, 0]} scale={[1, 0.8, 0.8]} material={skin}>
        <sphereGeometry args={[0.035, 12, 10]} />
      </mesh>
      <mesh ref={mouth} position={[-0.9, 0.88, 0]}>
        <boxGeometry args={[0.01, 0.006, 0.07]} />
        <meshBasicMaterial color="#7a2f2f" />
      </mesh>
      <mesh ref={tongue} position={[-0.885, 0.872, 0.012]} scale={0.001}>
        <boxGeometry args={[0.04, 0.012, 0.03]} />
        <meshBasicMaterial color="#e0707a" />
      </mesh>
      <group ref={eyeMarks} scale={0.001}>
        {[-1, 1].map((side) => (
          <group key={side} position={[-1.045, 0.945, side * 0.07]}>
            {[Math.PI / 4, -Math.PI / 4].map((angle) => (
              <mesh key={angle} rotation={[0, angle, 0]}>
                <boxGeometry args={[0.06, 0.008, 0.01]} />
                <meshBasicMaterial color="#1a1410" />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {([1, -1] as const).map((side, index) => (
        <group key={side}>
          <mesh ref={setLeg(index, "thigh")} material={shorts}>
            <cylinderGeometry args={[0.1, 0.145, 1, 24]} />
          </mesh>
          <mesh ref={setLeg(index, "shin")} material={skin}>
            <cylinderGeometry args={[0.062, 0.095, 1, 20]} />
          </mesh>
          <group
            ref={(group) => {
              (legs.current[index] as LegParts).shoe = group;
            }}
          >
            <mesh position={[0.02, 0.02, 0]}>
              <boxGeometry args={[0.3, 0.07, 0.13]} />
              <meshStandardMaterial color="#12b89a" roughness={0.55} />
            </mesh>
            <mesh position={[0.02, -0.025, 0]}>
              <boxGeometry args={[0.31, 0.03, 0.135]} />
              <meshStandardMaterial color="#f4f7fc" roughness={0.6} />
            </mesh>
          </group>

          <mesh ref={setArm(index, "upper")} material={skin}>
            <cylinderGeometry args={[0.075, 0.095, 1, 20]} />
          </mesh>
          <mesh ref={setArm(index, "fore")} material={skin}>
            <cylinderGeometry args={[0.052, 0.072, 1, 20]} />
          </mesh>
          <mesh ref={setArm(index, "elbow")} material={skin}>
            <sphereGeometry args={[0.075, 16, 12]} />
          </mesh>
          <mesh ref={setArm(index, "hand")} material={skin}>
            <sphereGeometry args={[0.07, 16, 12]} />
          </mesh>
          <mesh
            ref={(mesh) => {
              shoulders.current[index] = mesh;
            }}
            position={[BAR_X, SHOULDER_Y, side * SHOULDER_Z]}
            material={skin}
          >
            <sphereGeometry args={[0.105, 20, 16]} />
          </mesh>
        </group>
      ))}

      <group ref={bar} position={[BAR_X, BAR_HIGH, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 2.9, 16]} />
          <meshStandardMaterial color="#dbe4f2" metalness={0.55} roughness={0.3} />
        </mesh>
        {[-1, 1].flatMap((side) => [
          ...[
            { z: 0.95, radius: 0.42, color: "#1a5fe8" },
            { z: 1.05, radius: 0.34, color: "#12b89a" },
            { z: 1.14, radius: 0.26, color: "#ff8a4c" },
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
          <mesh key={`collar${side}`} position={[0, 0, side * 1.24]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.07, 20]} />
            <meshStandardMaterial color="#0e1b33" metalness={0.5} roughness={0.4} />
          </mesh>,
        ])}
      </group>
    </group>
  );
}

export default function LifterScene({
  controls,
  onRep,
  onMood,
  onMax,
  still,
}: {
  controls: MutableRefObject<Controls>;
  onRep: (reps: number) => void;
  onMood: (mood: Mood) => void;
  onMax: () => void;
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
      <Lifter controls={controls} onRep={onRep} onMood={onMood} onMax={onMax} still={still} />
    </Canvas>
  );
}
