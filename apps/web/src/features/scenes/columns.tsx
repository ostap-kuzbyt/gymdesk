import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export interface ColumnItem {
  label: string;
  value: number;
  ghost?: number | undefined;
}

const SPAN = 8.2;
const MAX_HEIGHT = 3.2;
const MIN_HEIGHT = 0.04;

function labelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.beginPath();
    context.roundRect(16, 12, 224, 72, 36);
    context.fill();
    context.fillStyle = "#0e1b33";
    context.font = "700 40px Archivo, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 128, 49, 200);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface ColumnProps {
  item: ColumnItem;
  x: number;
  width: number;
  scale: number;
  color: string;
  active: boolean;
  showLabel: boolean;
  index: number;
  onHover: (index: number | null) => void;
}

function Column({ item, x, width, scale, color, active, showLabel, index, onHover }: ColumnProps) {
  const body = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => labelTexture(item.label), [item.label]);
  const target = Math.max(item.value * scale, MIN_HEIGHT);
  const ghostTarget = Math.max((item.ghost ?? 0) * scale, MIN_HEIGHT);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    if (body.current) {
      body.current.scale.y += (target - body.current.scale.y) * 0.08;
      body.current.position.y = body.current.scale.y / 2;
    }
    if (ghost.current) {
      ghost.current.scale.y += (ghostTarget - ghost.current.scale.y) * 0.08;
      ghost.current.position.y = ghost.current.scale.y / 2;
    }
  });

  return (
    <group position={[x, 0, 0]}>
      {item.ghost !== undefined ? (
        <mesh ref={ghost} scale={[width * 1.12, 0.01, width * 1.12]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#9db6dc" transparent opacity={0.28} roughness={0.5} />
        </mesh>
      ) : null}
      <mesh
        ref={body}
        scale={[width, 0.01, width]}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(index);
        }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={active ? 0.4 : 0}
        />
      </mesh>
      {showLabel ? (
        <sprite position={[0, -0.28, 0.9]} scale={[1.2, 0.45, 1]}>
          <spriteMaterial map={texture} transparent depthTest={false} />
        </sprite>
      ) : null}
    </group>
  );
}

function DragRig({ still, children }: { still: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const element = useThree((state) => state.gl.domElement);
  const drag = useRef({ active: false, last: 0, target: 0 });

  useEffect(() => {
    const down = (event: PointerEvent) => {
      drag.current.active = true;
      drag.current.last = event.clientX;
    };
    const move = (event: PointerEvent) => {
      if (!drag.current.active) return;
      drag.current.target += (event.clientX - drag.current.last) * 0.008;
      drag.current.target = Math.max(-1, Math.min(1, drag.current.target));
      drag.current.last = event.clientX;
    };
    const up = () => {
      drag.current.active = false;
    };
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [element]);

  useFrame((state) => {
    const rig = group.current;
    if (!rig) return;
    const swing =
      still || drag.current.active ? 0 : Math.sin(state.clock.elapsedTime * 0.35) * 0.12;
    rig.rotation.y += (drag.current.target + swing - rig.rotation.y) * 0.08;
  });

  return <group ref={group}>{children}</group>;
}

export default function ColumnsScene({
  columns,
  color,
  activeIndex,
  still,
  onHover,
}: {
  columns: ColumnItem[];
  color: string;
  activeIndex: number | null;
  still: boolean;
  onHover: (index: number | null) => void;
}) {
  const count = Math.max(columns.length, 1);
  const step = Math.min(1.2, SPAN / count);
  const width = step * 0.62;
  const highest = Math.max(...columns.map((item) => Math.max(item.value, item.ghost ?? 0)), 1);
  const scale = MAX_HEIGHT / highest;
  const labelEvery = Math.ceil(count / 9);

  return (
    <Canvas
      camera={{ position: [0, 4.4, 9.5], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ camera }) => camera.lookAt(0, 1.3, 0)}
    >
      <ambientLight intensity={1} />
      <directionalLight position={[4, 8, 6]} intensity={2.2} />
      <directionalLight position={[-6, 3, 2]} intensity={0.7} color="#7fd8ff" />
      <DragRig still={still}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0.2]}>
          <planeGeometry args={[SPAN + 1.4, 2.6]} />
          <meshBasicMaterial color="#c4d6f2" transparent opacity={0.4} />
        </mesh>
        {columns.map((item, index) => (
          <Column
            key={`${item.label}${index}`}
            item={item}
            index={index}
            x={(index - (count - 1) / 2) * step}
            width={width}
            scale={scale}
            color={color}
            active={activeIndex === index}
            showLabel={index % labelEvery === 0}
            onHover={onHover}
          />
        ))}
      </DragRig>
    </Canvas>
  );
}
