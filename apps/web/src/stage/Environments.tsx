import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SceneId } from './stageTypes';

export interface EnvironmentProps {
  sceneId: SceneId;
  storm: boolean;
  paused: boolean;
  reducedMotion: boolean;
}

const wood = '#674a35';
const brass = '#9b7848';

function Box({
  position,
  size,
  color,
  radius = 0,
  rotation,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  radius?: number;
  rotation?: [number, number, number];
}) {
  const geometry = useMemo(() => {
    if (!radius) return new THREE.BoxGeometry(...size);
    const shape = new THREE.Shape();
    const r = Math.min(radius, size[0] / 2, size[1] / 2);
    shape.moveTo(-size[0] / 2 + r, -size[1] / 2);
    shape.lineTo(size[0] / 2 - r, -size[1] / 2);
    shape.quadraticCurveTo(size[0] / 2, -size[1] / 2, size[0] / 2, -size[1] / 2 + r);
    shape.lineTo(size[0] / 2, size[1] / 2 - r);
    shape.quadraticCurveTo(size[0] / 2, size[1] / 2, size[0] / 2 - r, size[1] / 2);
    shape.lineTo(-size[0] / 2 + r, size[1] / 2);
    shape.quadraticCurveTo(-size[0] / 2, size[1] / 2, -size[0] / 2, size[1] / 2 - r);
    shape.lineTo(-size[0] / 2, -size[1] / 2 + r);
    shape.quadraticCurveTo(-size[0] / 2, -size[1] / 2, -size[0] / 2 + r, -size[1] / 2);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: size[2],
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: r * 0.22,
      bevelThickness: r * 0.22,
      curveSegments: 4,
    });
    g.translate(0, 0, -size[2] / 2);
    return g;
  }, [size, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      position={position}
      {...(rotation ? { rotation } : {})}
      geometry={geometry}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.83} />
    </mesh>
  );
}

function Chair({
  position,
  color,
  rotation = 0,
}: {
  position: [number, number, number];
  color: string;
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[
        [-0.43, 0.35, -0.42],
        [0.43, 0.35, -0.42],
        [-0.43, 0.35, 0.42],
        [0.43, 0.35, 0.42],
      ].map((p, i) => (
        <Box
          key={i}
          position={p as [number, number, number]}
          size={[0.09, 0.7, 0.09]}
          color={wood}
        />
      ))}
      <Box position={[0, 0.7, 0]} size={[1.08, 0.14, 1.02]} color={wood} radius={0.08} />
      <Box position={[0, 1.32, -0.43]} size={[1.08, 0.96, 0.16]} color={wood} radius={0.08} />
      <Box position={[0, 1.83, -0.34]} size={[0.84, 0.12, 0.12]} color={color} radius={0.05} />
      <Box position={[0, 0.79, 0]} size={[0.88, 0.12, 0.82]} color={color} radius={0.1} />
      <Box position={[-0.52, 0.99, 0]} size={[0.14, 0.54, 0.9]} color={wood} radius={0.06} />
      <Box position={[0.52, 0.99, 0]} size={[0.14, 0.54, 0.9]} color={wood} radius={0.06} />
    </group>
  );
}

function Window({
  storm,
  paused,
  reducedMotion,
  noir,
}: {
  storm: boolean;
  paused: boolean;
  reducedMotion: boolean;
  noir: boolean;
}) {
  const rain = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const p = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      p[i * 3] = ((i * 37) % 100) / 20 - 2.5;
      p[i * 3 + 1] = ((i * 59) % 60) / 20 - 1.5;
      p[i * 3 + 2] = 0;
    }
    return p;
  }, []);
  useFrame((_, dt) => {
    if (paused || reducedMotion || !storm || !rain.current) return;
    const a = rain.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * 2.4;
      if (y < -1.6) y = 1.6;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  });
  return (
    <group position={[0, 2.42, -3.29]}>
      <mesh position={[0, 0, -0.04]}>
        <planeGeometry args={[3.8, 2.25]} />
        <meshBasicMaterial color={noir ? '#182128' : storm ? '#273944' : '#607985'} />
      </mesh>
      <mesh position={[0, -0.57, -0.03]}>
        <planeGeometry args={[3.8, 0.65]} />
        <meshBasicMaterial color={noir ? '#17232a' : '#344e58'} />
      </mesh>
      <points ref={rain}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={positions.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#b4c8cc"
          size={0.018}
          transparent
          opacity={storm ? 0.48 : 0.12}
          depthWrite={false}
        />
      </points>
      {[-1.98, 1.98].map((x) => (
        <Box key={x} position={[x, 0, 0.09]} size={[0.12, 2.5, 0.18]} color={wood} />
      ))}
      {[-1.2, 1.2].map((y) => (
        <Box key={y} position={[0, y, 0.09]} size={[4.05, 0.12, 0.18]} color={wood} />
      ))}
      <Box position={[0, 0, 0.06]} size={[0.08, 2.35, 0.12]} color={wood} />
      <pointLight
        position={[0, 0.1, 1.3]}
        color={noir ? '#b5c4c4' : '#c4d8d5'}
        intensity={1.1}
        distance={7}
      />
    </group>
  );
}

function Room({ sceneId, storm, paused, reducedMotion }: EnvironmentProps) {
  const noir = sceneId === 'noir',
    cyber = sceneId === 'cyberpunk';
  const plaster = noir ? '#55473d' : cyber ? '#47505a' : '#c7b99f';
  const panel = noir ? '#302a26' : cyber ? '#263139' : '#526d69';
  const upholstery = noir ? '#63434a' : cyber ? '#394d59' : '#5b7169';
  const floor = noir ? '#49372b' : cyber ? '#39434a' : '#80664c';
  return (
    <group>
      {/* continuous plank floor and woven central rug */}
      <Box position={[0, -0.06, 0]} size={[9.6, 0.12, 11]} color={floor} />
      {Array.from({ length: 17 }, (_, i) => (
        <Box
          key={`plank${i}`}
          position={[-4.5 + (i % 2) * 0.18, 0.006, -4.8 + Math.floor(i / 2) * 1.2]}
          size={[0.025, 0.008, 1.15]}
          color={noir ? '#382c24' : cyber ? '#303940' : '#6d5844'}
        />
      ))}
      <mesh position={[0, 0.012, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.5, 4.2]} />
        <meshStandardMaterial
          color={noir ? '#47353a' : cyber ? '#3c4a50' : '#64736b'}
          roughness={1}
        />
      </mesh>
      {/* rear wall pieces leave a real opening around the sea window */}
      <Box position={[-3.4, 2.2, -3.35]} size={[2.8, 4.4, 0.18]} color={plaster} />
      <Box position={[3.4, 2.2, -3.35]} size={[2.8, 4.4, 0.18]} color={plaster} />
      <Box position={[0, 3.97, -3.35]} size={[4, 0.85, 0.18]} color={plaster} />
      <Box position={[0, 0.64, -3.35]} size={[4, 1.28, 0.18]} color={plaster} />
      {[-4.72, 4.72].map((x, i) => (
        <group key={x}>
          <Box position={[x, 2.2, 0]} size={[0.18, 4.4, 6.7]} color={plaster} />
          <Box position={[x + (i ? -0.1 : 0.1), 0.47, 0]} size={[0.08, 0.9, 6.7]} color={panel} />
          <Box position={[x, 2.2, -3.25]} size={[0.2, 4.4, 0.25]} color={panel} />
        </group>
      ))}
      <Box position={[0, 0.48, -3.22]} size={[9.35, 0.92, 0.16]} color={panel} />
      <Window storm={storm} paused={paused} reducedMotion={reducedMotion} noir={noir} />
      {/* oval table, .55m high, with low central lantern */}
      <group position={[0, 0, 0.9]}>
        <mesh position={[0, 0.55, 0]} scale={[1, 1, 0.58]} castShadow receiveShadow>
          <cylinderGeometry args={[1.12, 1.12, 0.12, 40]} />
          <meshStandardMaterial
            color={noir ? '#50392e' : cyber ? '#49565a' : '#76563a'}
            roughness={0.65}
          />
        </mesh>
        {[-0.68, 0.68].map((x) =>
          [-0.26, 0.26].map((z) => (
            <Box key={`${x}${z}`} position={[x, 0.27, z]} size={[0.11, 0.5, 0.11]} color={wood} />
          )),
        )}
        {[
          [-0.38, 0.64, 0.08],
          [0.55, 0.64, 0.06],
        ].map((p, i) => (
          <group key={i} position={p as [number, number, number]}>
            <mesh>
              <cylinderGeometry args={[0.085, 0.07, 0.16, 12]} />
              <meshStandardMaterial color={i ? '#ded0b4' : '#68847b'} roughness={0.5} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.66, 0]}>
          <cylinderGeometry args={[0.09, 0.12, 0.18, 12]} />
          <meshStandardMaterial color={brass} metalness={0.45} roughness={0.4} />
        </mesh>
        <pointLight position={[0, 0.9, 0]} color="#ffc982" intensity={1.6} distance={4.5} />
      </group>
      {/* three conversational seats face the shared table */}
      <Chair position={[-1.65, 0, 0.1]} rotation={0.35} color={upholstery} />
      <Chair position={[0, 0, -1.05]} color={upholstery} />
      <Chair position={[1.65, 0, 0.1]} rotation={-0.35} color={upholstery} />
      {/* left bookcase with individual subdued volumes */}
      <group position={[-4.28, 0, -1.5]}>
        <Box position={[0, 1.25, 0]} size={[0.48, 2.5, 1.65]} color={wood} />
        {[0.42, 1.12, 1.82].map((y, row) => (
          <group key={row}>
            <Box position={[0.26, y, 0]} size={[0.06, 0.06, 1.48]} color={brass} />
            {Array.from({ length: 7 }, (_, i) => (
              <Box
                key={i}
                position={[0.24, y + 0.17, (i - 3) * 0.19]}
                size={[0.16, 0.28, 0.12]}
                color={
                  ['#65766a', '#8b684d', '#a58e70', '#4c5b64', '#865e52'][
                    ((row * 7 + i) * 3) % 5
                  ] ?? '#65766a'
                }
              />
            ))}
          </group>
        ))}
      </group>
      {/* framed chart and brass barometer */}
      <group position={[-3.05, 2.18, -3.18]}>
        <Box position={[0, 0, 0]} size={[0.95, 0.75, 0.08]} color={wood} />
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[0.76, 0.56]} />
          <meshBasicMaterial color={noir ? '#9d8c75' : '#b7aa8e'} />
        </mesh>
        <mesh position={[0, -0.03, 0.06]}>
          <circleGeometry args={[0.11, 16]} />
          <meshBasicMaterial color="#6f8581" />
        </mesh>
      </group>
      <group position={[2.18, 1.92, -3.17]}>
        <mesh>
          <cylinderGeometry args={[0.19, 0.19, 0.055, 24]} />
          <meshStandardMaterial color={brass} metalness={0.65} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <circleGeometry args={[0.15, 24]} />
          <meshBasicMaterial color="#d7c8a7" />
        </mesh>
      </group>
      {/* right practical floor lamp */}
      <group position={[3.55, 0, -0.15]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.3, 0.34, 0.16, 20]} />
          <meshStandardMaterial color={brass} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.035, 0.045, 2, 10]} />
          <meshStandardMaterial color={brass} metalness={0.6} />
        </mesh>
        <mesh position={[0, 2.1, 0]}>
          <cylinderGeometry args={[0.34, 0.22, 0.35, 20, 1, true]} />
          <meshStandardMaterial color="#d9c49d" side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
        <pointLight position={[0, 1.95, 0]} color="#ffd19a" intensity={2.2} distance={5} />
      </group>
      <ambientLight intensity={0.12} />
      <hemisphereLight args={['#e1d5bb', '#483a30', 0.45]} />
    </group>
  );
}

export function Environments(props: EnvironmentProps) {
  return <Room {...props} />;
}
