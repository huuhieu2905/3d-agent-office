import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
/** Minimal shape we need from a loaded glTF (avoids coupling to drei's GLTF type). */
export interface GltfLike {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

// Robot character (assets/models/characters/robot.glb, CC0). Appearance = tint of the "Main" material.

export const ROBOT_URL = '/models/characters/robot.glb';
export const TARGET_HEIGHT = 1.25; // metres when standing

export const APPEARANCE_COLORS: Record<string, string> = {
  'worker-a': '#e4572e',
  'worker-b': '#2f6fed',
  'worker-c': '#f3a712',
  'worker-d': '#2ec4b6',
  'worker-e': '#8e6c8a',
  'worker-f': '#6aa84f',
  'worker-g': '#ff7eb6',
  'worker-h': '#5d737e',
};

export type Clip = 'Idle' | 'Walking' | 'Sitting' | 'Standing' | 'Wave' | 'Yes' | 'No' | 'ThumbsUp' | 'Jump' | 'Dance';

export interface CharacterInstance {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<Clip, THREE.AnimationAction>>;
  face: THREE.Mesh | null;
  scale: number;
  dispose(): void;
}

let baseScale: number | null = null;

export function instantiate(gltf: GltfLike, appearance: string): CharacterInstance {
  const root = cloneSkinned(gltf.scene) as THREE.Group;
  if (baseScale == null) {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    baseScale = TARGET_HEIGHT / Math.max(0.001, box.max.y - box.min.y);
  }
  root.scale.setScalar(baseScale);

  const tint = new THREE.Color(APPEARANCE_COLORS[appearance] ?? '#9aa5b1');
  const owned: THREE.Material[] = [];
  let face: THREE.Mesh | null = null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat && mat.name === 'Main') {
      const m = mat.clone();
      m.color = tint;
      owned.push(m);
      mesh.material = m;
    }
    if (mesh.morphTargetDictionary && 'Sad' in mesh.morphTargetDictionary) face = mesh;
  });

  const mixer = new THREE.AnimationMixer(root);
  const actions: CharacterInstance['actions'] = {};
  for (const clip of gltf.animations) actions[clip.name as Clip] = mixer.clipAction(clip);
  for (const name of ['Sitting', 'Standing', 'Wave', 'Yes', 'No', 'ThumbsUp', 'Jump'] as Clip[]) {
    const a = actions[name];
    if (a) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
  }
  return {
    root,
    mixer,
    actions,
    face,
    scale: baseScale,
    dispose() {
      mixer.stopAllAction();
      for (const m of owned) m.dispose();
    },
  };
}

/** Cross-fade to a clip. Loop clips (Idle/Walking/Dance) loop; one-shots clamp on their last frame. */
export function play(c: CharacterInstance, clip: Clip, fade = 0.3, timeScale = 1): void {
  const next = c.actions[clip];
  if (!next) return;
  for (const [name, a] of Object.entries(c.actions)) {
    if (name !== clip && a && a.isRunning()) a.fadeOut(fade);
  }
  next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fade).play();
}

export function setFace(c: CharacterInstance, expression: 'neutral' | 'Sad' | 'Surprised' | 'Angry'): void {
  const f = c.face;
  if (!f?.morphTargetDictionary || !f.morphTargetInfluences) return;
  for (const [name, i] of Object.entries(f.morphTargetDictionary)) f.morphTargetInfluences[i] = name === expression ? 1 : 0;
}
