'use client';

// Greybox of the Vinyl Now Playing scene: a suitcase record player
// whose closed front reads as a flat rectangle, then opens. Geometry
// and materials are deliberately rough; Stage 5 replaces them part by
// part. Units are roughly decimetres.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, RoundedBox } from '@react-three/drei';
import gsap from 'gsap';
import * as THREE from 'three';

const CASE = { width: 4.2, depth: 3.2, baseHeight: 0.78, lidHeight: 0.34 };
const PLATTER = { x: -0.5, z: 0.05, radius: 1.3, height: 0.08 };
const RECORD = { radius: 1.22, thickness: 0.025, labelRadius: 0.42 };
const TONEARM = { x: 1.42, z: -0.95, length: 2.05, height: 0.25 };

/** Swing angles: resting, needle at the first groove, needle near the label. */
export const ARM_ANGLE = { rest: 0, start: -0.53, end: -0.85 };
const RECORD_TOP = PLATTER.height + 0.01 + RECORD.thickness;
const SPIN_SPEED = ((33 + 1 / 3) / 60) * Math.PI * 2;

// Camera keyframes. The start uses a long lens from far away, which
// flattens the case into a plain rectangle; the lens then widens as
// the camera closes in, revealing depth.
const SHOTS = {
  flat: { position: [0, 0.45, 26], fov: 9, target: [0, 0.55, 0] },
  reveal: { position: [0.6, 0.9, 11], fov: 22 },
  settled: { position: [0, 3.6, 7.2], fov: 32, target: [-0.15, 0.55, 0.1] },
} as const;

type Theme = 'dark' | 'light';

/** Names of the parts the intro animates; looked up once mounted. */
const PART = {
  lid: 'lid',
  latchLeft: 'latch-left',
  latchRight: 'latch-right',
  armSwing: 'arm-swing',
  armLift: 'arm-lift',
  record: 'record',
  interiorLight: 'interior-light',
  led: 'power-led',
} as const;

interface VinylSceneProps {
  theme: Theme;
  /** Album art for the record label; a gradient label is used without it. */
  labelUrl: string | null;
  /** Receives the paused intro timeline once the scene is built. */
  onTimeline: (timeline: gsap.core.Timeline) => void;
}

export function VinylScene({ theme, labelUrl, onTimeline }: VinylSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{
        fov: SHOTS.flat.fov,
        position: [...SHOTS.flat.position],
        near: 0.1,
        far: 100,
      }}
    >
      <Rig theme={theme} labelUrl={labelUrl} onTimeline={onTimeline} />
    </Canvas>
  );
}

// ============================================================
// Rig: parts, lights and the intro timeline
// ============================================================

function Rig({ theme, labelUrl, onTimeline }: VinylSceneProps) {
  const getThree = useThree((state) => state.get);
  const target = useMemo(() => new THREE.Vector3(...SHOTS.flat.target), []);
  const spin = useRef({ value: 0 });
  const record = useRef<THREE.Object3D | null>(null);

  // Built once; the timeline records every starting value, so seeking
  // to 0 restores the closed case exactly.
  useEffect(() => {
    const { scene } = getThree();
    const camera = getThree().camera as THREE.PerspectiveCamera;
    const find = (name: string) => scene.getObjectByName(name);

    const lid = find(PART.lid);
    const latchLeft = find(PART.latchLeft);
    const latchRight = find(PART.latchRight);
    const armSwing = find(PART.armSwing);
    const armLift = find(PART.armLift);
    const interiorLight = find(PART.interiorLight);
    const ledMesh = find(PART.led) as THREE.Mesh | undefined;
    const led = ledMesh?.material as THREE.MeshStandardMaterial | undefined;
    record.current = find(PART.record) ?? null;

    if (!lid || !latchLeft || !latchRight || !armSwing || !armLift || !interiorLight || !led) {
      console.error('Vinyl scene is missing a part; the intro cannot run.');
      return;
    }

    const updateLens = () => camera.updateProjectionMatrix();

    const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });

    timeline
      // Push in on the "rectangle" while the lens widens.
      .to(camera.position, { x: SHOTS.reveal.position[0], y: SHOTS.reveal.position[1], z: SHOTS.reveal.position[2], duration: 1.8 }, 0)
      .to(camera, { fov: SHOTS.reveal.fov, duration: 1.8, onUpdate: updateLens }, 0)
      // Latches flip, then the lid swings open on its hinge.
      .to(latchLeft.rotation, { x: 1.05, duration: 0.35, ease: 'back.out(2.2)' }, 1.1)
      .to(latchRight.rotation, { x: 1.05, duration: 0.35, ease: 'back.out(2.2)' }, 1.22)
      .to(lid.rotation, { x: -1.9, duration: 1.35, ease: 'back.out(1.05)' }, 1.45)
      .to(interiorLight, { intensity: 5, duration: 1.1, ease: 'power1.out' }, 1.6)
      // Rise to the final, slightly-above viewpoint.
      .to(camera.position, { x: SHOTS.settled.position[0], y: SHOTS.settled.position[1], z: SHOTS.settled.position[2], duration: 1.75, ease: 'power3.inOut' }, 1.9)
      .to(camera, { fov: SHOTS.settled.fov, duration: 1.75, ease: 'power3.inOut', onUpdate: updateLens }, 1.9)
      .to(target, { x: SHOTS.settled.target[0], y: SHOTS.settled.target[1], z: SHOTS.settled.target[2], duration: 1.75, ease: 'power3.inOut' }, 1.9)
      // Power on: LED, platter spins up, tonearm lifts, swings, drops.
      .to(led, { emissiveIntensity: 2.6, duration: 0.25, ease: 'power1.out' }, 3.0)
      .to(spin.current, { value: 1, duration: 1.1, ease: 'power1.in' }, 3.0)
      .to(armLift.rotation, { x: -0.07, duration: 0.3, ease: 'power1.out' }, 3.05)
      .to(armSwing.rotation, { y: ARM_ANGLE.start, duration: 0.65 }, 3.3)
      .to(armLift.rotation, { x: 0, duration: 0.4, ease: 'power2.in' }, 3.95);

    onTimeline(timeline);

    return () => {
      timeline.kill();
    };
  }, [getThree, target, onTimeline]);

  useFrame(({ camera }, delta) => {
    camera.lookAt(target);
    if (record.current) record.current.rotation.y -= spin.current.value * SPIN_SPEED * delta;
  });

  return (
    <>
      <Lights theme={theme} />
      <SuitcasePlayer labelUrl={labelUrl} />
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={theme === 'dark' ? 0.55 : 0.35}
        scale={12}
        blur={2.4}
        far={3}
      />
    </>
  );
}

// ============================================================
// Lighting
// ============================================================

const LIGHTING: Record<Theme, { hemi: number; key: number; rim: number; fill: number; env: number }> = {
  // A dim listening room: warm key, teal rim, a little pink fill.
  dark: { hemi: 0.25, key: 140, rim: 2.2, fill: 10, env: 0.6 },
  // Daylight: brighter, softer, accents pulled back.
  light: { hemi: 1.0, key: 90, rim: 0.8, fill: 2.5, env: 1.0 },
};

function Lights({ theme }: { theme: Theme }) {
  const levels = LIGHTING[theme];

  return (
    <>
      <hemisphereLight args={['#ffe9d6', '#1a1410', levels.hemi]} />
      <spotLight
        position={[-5, 8, 6]}
        angle={0.5}
        penumbra={0.8}
        intensity={levels.key}
        color="#ffd9b0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[4, 3, -6]} intensity={levels.rim} color="#00cfc4" />
      <pointLight position={[-4, 1.5, 2]} intensity={levels.fill} distance={10} color="#ff6a96" />
      {/* Warm glow that spills out as the lid opens. */}
      <pointLight
        name={PART.interiorLight}
        position={[-0.3, CASE.baseHeight + 0.6, 0]}
        intensity={0}
        distance={5}
        decay={2}
        color="#ffb46b"
      />
      {/* Built-in light shapes for reflections; no HDRI download. */}
      <Environment resolution={256} environmentIntensity={levels.env}>
        <Lightformer form="rect" intensity={2} color="#fff1e0" position={[0, 6, 2]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#00cfc4" position={[6, 2, -3]} rotation-y={-Math.PI / 2} scale={[4, 1, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ff6a96" position={[-6, 1.5, 2]} rotation-y={Math.PI / 2} scale={[3, 1, 1]} />
      </Environment>
    </>
  );
}

// ============================================================
// The record player
// ============================================================

function SuitcasePlayer({ labelUrl }: { labelUrl: string | null }) {
  const { width, depth, baseHeight, lidHeight } = CASE;

  return (
    <group>
      {/* Base */}
      <RoundedBox args={[width, baseHeight, depth]} radius={0.06} position={[0, baseHeight / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#5b3a29" roughness={0.78} />
      </RoundedBox>

      {/* Latches sit across the seam and flip forward to release the lid. */}
      {[-1.3, 1.3].map((x) => (
        <group
          key={x}
          name={x < 0 ? PART.latchLeft : PART.latchRight}
          position={[x, baseHeight - 0.12, depth / 2 + 0.02]}
        >
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.28, 0.24, 0.04]} />
            <meshStandardMaterial color="#c39a5b" metalness={1} roughness={0.32} />
          </mesh>
        </group>
      ))}

      {/* Lid, hinged along the back top edge of the base. */}
      <group name={PART.lid} position={[0, baseHeight, -depth / 2]}>
        <RoundedBox args={[width, lidHeight, depth]} radius={0.06} position={[0, lidHeight / 2, depth / 2]} castShadow>
          <meshStandardMaterial color="#5b3a29" roughness={0.78} />
        </RoundedBox>
        {/* Teal felt lining, seen once the lid is up. */}
        <mesh position={[0, -0.002, depth / 2]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[width - 0.16, depth - 0.16]} />
          <meshStandardMaterial color="#0d3532" roughness={0.95} />
        </mesh>
      </group>

      {/* Everything mounted on the deck. */}
      <group position={[0, baseHeight, 0]}>
        <mesh position={[0, 0.005, 0]} receiveShadow>
          <boxGeometry args={[width - 0.2, 0.01, depth - 0.2]} />
          <meshStandardMaterial color="#1b1816" roughness={0.55} />
        </mesh>

        <Platter labelUrl={labelUrl} />
        <Tonearm />

        {/* Knobs and the pink power LED. */}
        {[-1.75, -1.35].map((x) => (
          <mesh key={x} position={[x, 0.05, 1.35]} castShadow>
            <cylinderGeometry args={[0.1, 0.11, 0.1, 32]} />
            <meshStandardMaterial color="#c9cfd2" metalness={1} roughness={0.25} />
          </mesh>
        ))}
        <mesh name={PART.led} position={[-1.0, 0.015, 1.4]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshStandardMaterial color="#3a0f1b" emissive="#ff6a96" emissiveIntensity={0} />
        </mesh>
      </group>
    </group>
  );
}

function Platter({ labelUrl }: { labelUrl: string | null }) {
  const grooves = useMemo(() => createGrooveTexture(), []);
  const label = useLabelTexture(labelUrl);

  return (
    <group position={[PLATTER.x, 0, PLATTER.z]}>
      <mesh position={[0, PLATTER.height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[PLATTER.radius, PLATTER.radius, PLATTER.height, 96]} />
        <meshStandardMaterial color="#8f979b" metalness={0.9} roughness={0.35} />
      </mesh>
      <mesh position={[0, PLATTER.height + 0.005, 0]}>
        <cylinderGeometry args={[PLATTER.radius - 0.03, PLATTER.radius - 0.03, 0.01, 96]} />
        <meshStandardMaterial color="#161616" roughness={1} />
      </mesh>

      {/* Spins as one: disc, label and spindle. */}
      <group name={PART.record}>
        <mesh position={[0, PLATTER.height + 0.01 + RECORD.thickness / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[RECORD.radius, RECORD.radius, RECORD.thickness, 128]} />
          <meshPhysicalMaterial
            map={grooves}
            color="#ffffff"
            roughness={0.32}
            clearcoat={0.6}
            clearcoatRoughness={0.25}
          />
        </mesh>
        <mesh position={[0, RECORD_TOP + 0.001, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[RECORD.labelRadius, 64]} />
          <meshStandardMaterial map={label} roughness={0.6} />
        </mesh>
        <mesh position={[0, RECORD_TOP + 0.04, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.09, 16]} />
          <meshStandardMaterial color="#c9cfd2" metalness={1} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

function Tonearm() {
  const chrome = <meshStandardMaterial color="#c9cfd2" metalness={1} roughness={0.22} />;

  return (
    <>
      {/* Arm rest post the arm sits on when idle. */}
      <mesh position={[TONEARM.x, 0.11, TONEARM.z + 1.75]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.22, 12]} />
        {chrome}
      </mesh>

      <group position={[TONEARM.x, 0, TONEARM.z]}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.19, 0.12, 32]} />
          <meshStandardMaterial color="#2a2522" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.17, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.2, 16]} />
          {chrome}
        </mesh>

        {/* Swing around the post, lift around the bearing. */}
        <group name={PART.armSwing}>
          <group name={PART.armLift} position={[0, TONEARM.height, 0]}>
            <mesh position={[0, 0, TONEARM.length / 2]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.025, 0.025, TONEARM.length, 12]} />
              {chrome}
            </mesh>
            <mesh position={[0, 0, -0.28]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.22, 24]} />
              <meshStandardMaterial color="#2a2522" metalness={0.6} roughness={0.35} />
            </mesh>
            <group position={[0, -0.06, TONEARM.length]} rotation-y={0.35}>
              <mesh castShadow>
                <boxGeometry args={[0.13, 0.03, 0.24]} />
                <meshStandardMaterial color="#c39a5b" metalness={1} roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.045, 0.06]} rotation-x={Math.PI}>
                <coneGeometry args={[0.012, 0.06, 8]} />
                {chrome}
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </>
  );
}

// ============================================================
// Textures
// ============================================================

/** Concentric grooves with darker gaps between tracks. */
function createGrooveTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const center = size / 2;

  context.fillStyle = '#0a0a0b';
  context.fillRect(0, 0, size, size);

  const inner = ((RECORD.labelRadius + 0.04) / RECORD.radius) * center;
  const outer = 0.985 * center;
  const trackGaps = [0.22, 0.41, 0.58, 0.77];

  for (let radius = inner; radius < outer; radius += 1.15) {
    const position = (radius - inner) / (outer - inner);
    const inGap = trackGaps.some((gap) => Math.abs(position - gap) < 0.006);

    context.strokeStyle = inGap
      ? 'rgba(0, 0, 0, 0.9)'
      : `rgba(255, 255, 255, ${0.025 + Math.random() * 0.05})`;
    context.lineWidth = inGap ? 2 : 0.7;
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Teal-to-pink placeholder label, used until album art loads. */
function createFallbackLabel(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;

  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#00cfc4');
  gradient.addColorStop(1, '#ff6a96');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const serif =
    getComputedStyle(document.documentElement).getPropertyValue('--font-instrument-serif').trim() ||
    'serif';

  context.fillStyle = 'rgba(4, 10, 13, 0.85)';
  context.textAlign = 'center';
  context.font = `64px ${serif}`;
  context.fillText('Side A', size / 2, size * 0.36);
  context.font = `28px ${serif}`;
  context.fillText('33⅓ RPM', size / 2, size * 0.72);

  context.strokeStyle = 'rgba(4, 10, 13, 0.35)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Album art when it loads, otherwise the gradient label. */
function useLabelTexture(url: string | null): THREE.Texture {
  const fallback = useMemo(() => createFallbackLabel(), []);
  const [loaded, setLoaded] = useState<{ url: string; texture: THREE.Texture } | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        setLoaded({ url, texture });
      },
      undefined,
      () => console.warn('Record label artwork failed to load; using the default label.'),
    );

    return () => {
      cancelled = true;
    };
  }, [url]);

  return loaded && loaded.url === url ? loaded.texture : fallback;
}
