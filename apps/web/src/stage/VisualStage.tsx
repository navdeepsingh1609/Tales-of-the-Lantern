import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Environments } from './Environments';
import { ACTORS_CONFIG, type ActorId, type SceneId } from './stageTypes';

export type VisualStageProps = {
  curtainsOpen?: boolean;
  storm: boolean;
  selectedActor: ActorId | null;
  paused: boolean;
  reducedMotion: boolean;
  onSelectActor: (actor: ActorId) => void;
  onFps: (fps: number) => void;
  activeActor?: ActorId | null;
  activeVideo?: HTMLVideoElement | null;
  activeMediaRef?: { current: HTMLMediaElement | null };
  activeAudioUrl?: string;
  currentScene?: SceneId;
  onSceneChange?: (scene: SceneId) => void;
};

function Scene(props: VisualStageProps) {
  const { camera, size } = useThree();
  const frames = useRef(0);
  const startedAt = useRef(0);
  const aim = useMemo(() => new THREE.Vector3(0, 1.05, 0), []);
  const scene = props.currentScene ?? 'lighthouse';
  useFrame((_, delta) => {
    frames.current++;
    const now = performance.now();
    if (!startedAt.current) startedAt.current = now;
    if (now - startedAt.current >= 1000) {
      props.onFps((frames.current * 1000) / (now - startedAt.current));
      frames.current = 0;
      startedAt.current = now;
    }
    if (props.paused) return;
    const focus = props.activeActor ?? props.selectedActor;
    const x = focus ? ACTORS_CONFIG[focus].position[0] * 0.14 : 0;
    const aspect = size.width / Math.max(size.height, 1);
    const depth = Math.max(7.2, 6.8 / (2 * Math.tan(THREE.MathUtils.degToRad(38 / 2)) * aspect));
    const damping = props.reducedMotion ? 0 : 1 - Math.exp(-delta * 1.35);
    // Reduced motion keeps the establishing composition rather than making instant cuts.
    if (!props.reducedMotion) {
      camera.position.lerp(new THREE.Vector3(3.1 + x, 2.65, depth), damping);
      aim.x = THREE.MathUtils.damp(aim.x, x, 1.35, delta);
    }
    camera.lookAt(aim);
  });
  return (
    <>
      <color attach="background" args={['#b4bbb6']} />
      <hemisphereLight args={['#dde7ed', '#6c5444', 0.9]} />
      <directionalLight
        position={[-3, 5, 4]}
        color="#fff0d6"
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-normalBias={0.035}
        shadow-radius={4}
      />
      <directionalLight position={[0, 3, -5]} color="#bed5e8" intensity={1.4} />
      <Environments
        sceneId={scene}
        storm={props.storm}
        paused={props.paused}
        reducedMotion={props.reducedMotion}
      />
    </>
  );
}
export default function VisualStage(props: VisualStageProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [3.1, 2.65, 7.2], fov: 38 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
