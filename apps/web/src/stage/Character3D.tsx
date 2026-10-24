import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ACTORS_CONFIG, type ActorConfig, type ActorId } from './stageTypes';

export interface Character3DProps {
  actor: ActorConfig;
  selected: boolean;
  active: boolean;
  activeActor: ActorId | null;
  activeVideo?: HTMLVideoElement | null;
  speechEnergyRef?: { current: number };
  paused: boolean;
  reducedMotion: boolean;
  interrupted?: boolean;
  onClick: () => void;
}

type Vec = [number, number, number];

function Orb({
  position,
  scale,
  color,
  roughness = 0.86,
  metalness = 0,
}: {
  position: Vec;
  scale: Vec;
  color: string;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <sphereGeometry args={[1, 24, 18]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

function Capsule({ a, b, radius, color }: { a: Vec; b: Vec; radius: number; color: string }) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const delta = to.clone().sub(from);
  const mid: Vec = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return (
    <mesh
      position={mid}
      quaternion={new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.clone().normalize(),
      )}
      castShadow
      receiveShadow
    >
      <capsuleGeometry args={[radius, Math.max(0.01, delta.length() - radius * 2), 5, 10]} />
      <meshStandardMaterial color={color} roughness={0.86} />
    </mesh>
  );
}

const SKIN = '#d7a17d';
export function Character3D({
  actor,
  selected,
  active,
  activeActor,
  activeVideo: _activeVideo,
  speechEnergyRef,
  paused,
  reducedMotion,
  interrupted,
  onClick,
}: Character3DProps) {
  const head = useRef<THREE.Group>(null);
  const headPivot = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const seed = actor.id === 'odile' ? 0.2 : actor.id === 'rocco' ? 1.8 : 3.1;
  const palette = useMemo(() => {
    switch (actor.id) {
      case 'odile':
        return { coat: '#542c35', trim: '#b78a4e', hair: '#aaa9a4', scarf: '#6b2933' };
      case 'rocco':
        return { coat: '#286568', trim: '#bd8157', hair: '#35251f', scarf: '#b65337' };
      default:
        return { coat: '#d3a83e', trim: '#e5cf99', hair: '#c66b34', scarf: '#dfbd52' };
    }
  }, [actor.id]);
  const lookY =
    activeActor && activeActor !== actor.id
      ? THREE.MathUtils.clamp(
          Math.atan2(
            ACTORS_CONFIG[activeActor].position[0] - actor.position[0],
            Math.abs(ACTORS_CONFIG[activeActor].position[2] - actor.position[2]) + 1,
          ) * 0.55,
          -0.36,
          0.36,
        )
      : actor.baseRotationY * 0.4;

  useFrame((_, delta) => {
    if (mouth.current) {
      const energy =
        active && !paused ? THREE.MathUtils.clamp(speechEnergyRef?.current ?? 0, 0, 1) : 0;
      mouth.current.scale.y = 0.35 + energy * 1.8;
    }
    if (paused || reducedMotion) return;
    clock.current += Math.min(delta, 0.05);
    const t = clock.current + seed;
    if (headPivot.current) {
      headPivot.current.rotation.y = THREE.MathUtils.damp(
        headPivot.current.rotation.y,
        interrupted ? 0 : lookY,
        2.1,
        delta,
      );
    }
    if (head.current) {
      head.current.rotation.x = THREE.MathUtils.damp(
        head.current.rotation.x,
        Math.sin(t * 0.75) * 0.012,
        1.5,
        delta,
      );
    }
    if (torso.current) torso.current.position.y = Math.sin(t * 1.1) * 0.007;
  });

  const eyes = (x: number) => (
    <>
      <Orb position={[x, 2.12, 0.282]} scale={[0.073, 0.086, 0.038]} color="#f3e7d8" />
      <Orb position={[x, 2.115, 0.316]} scale={[0.032, 0.043, 0.019]} color="#49362f" />
      <Orb position={[x - 0.008, 2.13, 0.331]} scale={[0.011, 0.014, 0.008]} color="#fff4df" />
    </>
  );

  return (
    <group
      position={actor.position}
      scale={actor.scale}
      rotation={[0, actor.baseRotationY * 0.7, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Orb position={[0, 0.88, 0.03]} scale={[0.47, 0.26, 0.37]} color={palette.coat} />
      {/* Jacket front, collar, lapels and small buttons. */}
      <group ref={torso}>
        <Orb position={[0, 1.33, 0.03]} scale={[0.49, 0.56, 0.31]} color={palette.coat} />
        <Orb position={[0, 1.71, 0.035]} scale={[0.15, 0.17, 0.16]} color={SKIN} />
        <Orb position={[-0.12, 1.64, 0.19]} scale={[0.12, 0.18, 0.07]} color={palette.trim} />
        <Orb position={[0.12, 1.64, 0.19]} scale={[0.12, 0.18, 0.07]} color={palette.trim} />
        {[1.26, 1.39, 1.52].map((y) => (
          <Orb
            key={y}
            position={[0.07, y, 0.315]}
            scale={[0.025, 0.025, 0.012]}
            color={palette.trim}
            metalness={0.35}
          />
        ))}
        {/* Bent arms rest naturally across the lap, with visible palms and fingers. */}
        <Capsule
          a={[-0.42, 1.53, 0.02]}
          b={[-0.56, 1.26, 0.32]}
          radius={0.13}
          color={palette.coat}
        />
        <Capsule
          a={[-0.56, 1.26, 0.32]}
          b={[-0.3, 0.99, 0.38]}
          radius={0.115}
          color={palette.coat}
        />
        <Orb position={[-0.27, 0.97, 0.4]} scale={[0.12, 0.07, 0.06]} color={SKIN} />
        <Capsule a={[0.42, 1.53, 0.02]} b={[0.55, 1.26, 0.32]} radius={0.13} color={palette.coat} />
        <Capsule a={[0.55, 1.26, 0.32]} b={[0.29, 0.99, 0.4]} radius={0.115} color={palette.coat} />
        <Orb position={[0.26, 0.97, 0.41]} scale={[0.12, 0.07, 0.06]} color={SKIN} />
        {[-1, 0, 1].map((i) => (
          <Capsule
            key={i}
            a={[-0.31 + i * 0.045, 0.96, 0.44]}
            b={[-0.3 + i * 0.045, 0.89, 0.46]}
            radius={0.018}
            color={SKIN}
          />
        ))}
        {[-1, 0, 1].map((i) => (
          <Capsule
            key={i}
            a={[0.22 + i * 0.045, 0.96, 0.45]}
            b={[0.23 + i * 0.045, 0.89, 0.46]}
            radius={0.018}
            color={SKIN}
          />
        ))}
      </group>
      {/* Seated thighs project forward; calves descend to the floor with soft shoes. */}
      <Capsule a={[-0.24, 0.82, 0.14]} b={[-0.39, 0.48, 0.72]} radius={0.19} color={palette.coat} />
      <Capsule a={[-0.39, 0.48, 0.72]} b={[-0.39, 0.14, 0.77]} radius={0.12} color="#45342e" />
      <Orb position={[-0.39, 0.11, 0.9]} scale={[0.17, 0.085, 0.25]} color="#302722" />
      <Capsule a={[0.24, 0.82, 0.14]} b={[0.39, 0.48, 0.72]} radius={0.19} color={palette.coat} />
      <Capsule a={[0.39, 0.48, 0.72]} b={[0.39, 0.14, 0.77]} radius={0.12} color="#45342e" />
      <Orb position={[0.39, 0.11, 0.9]} scale={[0.17, 0.085, 0.25]} color="#302722" />
      {/* Full sculpted head, facial planes, ears and character-specific hair. */}
      <group ref={headPivot} position={[0, 2.04, 0]}>
        <group ref={head} position={[0, -2.04, 0]}>
          <Orb position={[0, 2.04, 0]} scale={[0.35, 0.43, 0.31]} color={SKIN} />
          <Orb position={[-0.36, 2.04, 0]} scale={[0.07, 0.12, 0.07]} color={SKIN} />
          <Orb position={[0.36, 2.04, 0]} scale={[0.07, 0.12, 0.07]} color={SKIN} />
          {eyes(-0.14)}
          {eyes(0.14)}
          <Orb position={[-0.14, 2.23, 0.29]} scale={[0.12, 0.045, 0.045]} color={palette.hair} />
          <Orb position={[0.14, 2.23, 0.29]} scale={[0.12, 0.045, 0.045]} color={palette.hair} />
          <Orb position={[0, 1.99, 0.31]} scale={[0.065, 0.09, 0.08]} color="#c88f70" />
          <Orb position={[0, 1.88, 0.304]} scale={[0.11, 0.027, 0.028]} color="#754940" />
          <group ref={mouth} position={[0, 1.87, 0.326]}>
            <Orb position={[0, 0, 0]} scale={[0.075, 0.009, 0.009]} color="#f1c3a1" />
          </group>
          {actor.id === 'odile' ? (
            <>
              <Orb position={[0, 2.34, -0.005]} scale={[0.33, 0.22, 0.29]} color="#aaa9a4" />
              <Orb position={[-0.28, 2.17, 0.03]} scale={[0.1, 0.29, 0.25]} color="#92938f" />
              <Orb position={[0.28, 2.17, 0.03]} scale={[0.1, 0.29, 0.25]} color="#92938f" />
              {[-0.14, 0.14].map((x) => (
                <mesh key={x} position={[x, 2.105, 0.317]}>
                  <torusGeometry args={[0.094, 0.012, 8, 24]} />
                  <meshStandardMaterial color="#b68c4f" metalness={0.55} roughness={0.35} />
                </mesh>
              ))}
              <Capsule
                a={[-0.045, 2.08, 0.31]}
                b={[0.045, 2.08, 0.31]}
                radius={0.012}
                color="#b68c4f"
              />
            </>
          ) : actor.id === 'rocco' ? (
            <>
              {[-0.26, -0.13, 0, 0.13, 0.26].map((x, i) => (
                <Orb
                  key={x}
                  position={[x, 2.37 + (i % 2) * 0.035, 0]}
                  scale={[0.14, 0.16, 0.18]}
                  color="#35251f"
                />
              ))}
              <Orb position={[0, 1.93, 0.31]} scale={[0.18, 0.055, 0.05]} color="#493027" />
            </>
          ) : (
            <>
              <Orb position={[0, 2.35, 0]} scale={[0.31, 0.19, 0.27]} color="#c66b34" />
              <Orb position={[-0.3, 2.15, 0.02]} scale={[0.07, 0.25, 0.21]} color="#c66b34" />
              {[-0.23, -0.13, 0, 0.13, 0.23].map((x, i) => (
                <Orb
                  key={x}
                  position={[x, 2.09 + (i % 2) * 0.1, 0.292]}
                  scale={[0.018, 0.018, 0.008]}
                  color="#9d4532"
                />
              ))}
              {[-0.14, 0.14].map((x) => (
                <mesh key={x} position={[x, 2.105, 0.323]}>
                  <torusGeometry args={[0.115, 0.017, 8, 24]} />
                  <meshStandardMaterial color="#d6b659" metalness={0.3} />
                </mesh>
              ))}
            </>
          )}
        </group>
      </group>
      {/* understated selection marker, integrated as a warm floor shadow */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[selected ? 0.65 : 0.58, 32]} />
        <meshBasicMaterial
          color={selected ? '#b58853' : '#33251f'}
          transparent
          opacity={selected ? 0.12 : 0.065}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
