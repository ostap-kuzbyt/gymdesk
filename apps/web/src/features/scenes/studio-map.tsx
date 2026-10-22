import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { StudioLoad } from "@/features/studios/load";

const TONE_COLORS: Record<StudioLoad["tone"], string> = {
  green: "#22c58b",
  yellow: "#f5b800",
  red: "#f0524f",
  blue: "#3b82ff",
  neutral: "#b9c7dc",
};

const SPACING = 2.4;
const MIN_HEIGHT = 0.3;
const HEIGHT_RANGE = 2.3;

function labelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(255,255,255,0.92)";
    context.beginPath();
    context.roundRect(8, 24, 496, 80, 40);
    context.fill();
    context.fillStyle = "#0e1b33";
    context.font = "700 44px Archivo, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 66, 460);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface TowerProps {
  studio: StudioLoad;
  position: [number, number];
  active: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function Tower({ studio, position, active, onHover, onSelect }: TowerProps) {
  const body = useRef<THREE.Mesh>(null);
  const label = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => labelTexture(studio.name), [studio.name]);
  const target = MIN_HEIGHT + studio.ratio * HEIGHT_RANGE;

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const mesh = body.current;
    if (!mesh) return;
    mesh.scale.y += (target - mesh.scale.y) * 0.08;
    mesh.position.y = mesh.scale.y / 2 + 0.05;
    if (label.current) label.current.position.y = mesh.scale.y + 0.75;
  });

  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[2, 0.05, 2]} />
        <meshStandardMaterial color={active ? "#ffffff" : "#dbe7ff"} roughness={0.6} />
      </mesh>
      <mesh
        ref={body}
        scale={[1.5, 0.01, 1.5]}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
          onHover(studio.id);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
          onHover(null);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(studio.id);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={TONE_COLORS[studio.tone]}
          roughness={0.35}
          metalness={0.1}
          emissive={TONE_COLORS[studio.tone]}
          emissiveIntensity={active ? 0.35 : 0}
        />
      </mesh>
      <sprite ref={label} scale={[2.2, 0.55, 1]} position={[0, target + 0.75, 0]}>
        <spriteMaterial map={texture} transparent depthTest={false} />
      </sprite>
    </group>
  );
}

function Rig({ still, children }: { still: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    const rig = group.current;
    if (!rig) return;
    const swing = still ? 0 : Math.sin(state.clock.elapsedTime * 0.3) * 0.25;
    const targetY = swing + state.pointer.x * 0.35;
    rig.rotation.y += (targetY - rig.rotation.y) * 0.05;
  });

  return <group ref={group}>{children}</group>;
}

interface StudioMapSceneProps {
  studios: StudioLoad[];
  activeId: string | null;
  still: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export default function StudioMapScene({
  studios,
  activeId,
  still,
  onHover,
  onSelect,
}: StudioMapSceneProps) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(studios.length)));
  const rows = Math.max(1, Math.ceil(studios.length / columns));

  return (
    <Canvas
      camera={{ position: [7.2, 6.4, 7.2], fov: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1} />
      <directionalLight position={[5, 8, 4]} intensity={2.2} />
      <directionalLight position={[-6, 3, -2]} intensity={0.7} color="#7fd8ff" />
      <Rig still={still}>
        {studios.map((studio, index) => (
          <Tower
            key={studio.id}
            studio={studio}
            position={[
              ((index % columns) - (columns - 1) / 2) * SPACING,
              (Math.floor(index / columns) - (rows - 1) / 2) * SPACING,
            ]}
            active={activeId === studio.id}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
      </Rig>
    </Canvas>
  );
}
