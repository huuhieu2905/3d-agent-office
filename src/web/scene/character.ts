import * as THREE from 'three';

// 002 US6 / T069–T070: employees in the chosen concept E+ — a soft 3D cartoon figure (big round head,
// round eyes, rosy cheeks, block hair) in the Sài Gòn palette, built from primitives in code (no
// third-party model, assets/LICENSES.md). Animation is procedural: every clip is a target pose per joint
// plus a little motion, and joints ease towards the target, so changing clip cross-fades by itself.
// The API (instantiate / play / setFace / mixer.update) is the one the robot used, so Employee.tsx and
// the brain keep working unchanged.

export const TARGET_HEIGHT = 1.36; // metres when standing

export type Clip = 'Idle' | 'Walking' | 'Sitting' | 'Standing' | 'Wave' | 'Yes' | 'No' | 'ThumbsUp' | 'Jump' | 'Dance' | 'Lying' | 'Drinking' | 'Resting';
export type Expression = 'neutral' | 'Sad' | 'Surprised' | 'Angry';

/** Outfits from concept-decision.md (tops/bottoms in the D palette), skin and hair tones. */
const LOOKS: Record<string, { top: string; bottom: string; skin: string; hair: string }> = {
  'worker-a': { top: '#f2c94c', bottom: '#1f6f6a', skin: '#ffd9c2', hair: '#1a1513' },
  'worker-b': { top: '#fffaf0', bottom: '#c2603a', skin: '#e8bf9c', hair: '#2b211b' },
  'worker-c': { top: '#2f80a5', bottom: '#efe4cc', skin: '#ffe3cf', hair: '#5a3b22' },
  'worker-d': { top: '#c2603a', bottom: '#3b3b3b', skin: '#c98d6a', hair: '#1f1814' },
  'worker-e': { top: '#9ccfb4', bottom: '#2f3a4a', skin: '#f2c9a0', hair: '#3b2b25' },
  'worker-f': { top: '#f2a7a0', bottom: '#1f6f6a', skin: '#d9a77f', hair: '#1a1513' },
  'worker-g': { top: '#7a6ad8', bottom: '#efe4cc', skin: '#ffd9c2', hair: '#2b211b' },
  'worker-h': { top: '#3fae7a', bottom: '#5a3b22', skin: '#e8bf9c', hair: '#120f0e' },
};

/** Kept for code that only needs a representative colour per appearance. */
export const APPEARANCE_COLORS: Record<string, string> = Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, v.top]));

const S = { head: 0.21, torsoR: 0.17, torsoLen: 0.16, thigh: 0.22, shin: 0.2, legR: 0.07, arm: 0.34, armR: 0.055, hip: 0.44 };
const SEAT_HIP = 0.47; // hip height on a chair

interface Joint {
  obj: THREE.Object3D;
  target: THREE.Euler;
}

export interface CharacterInstance {
  root: THREE.Group;
  /** Same shape as THREE.AnimationMixer for the caller: advance the animation by dt seconds. */
  mixer: { update(dt: number): void; stopAllAction(): void };
  face: { eyes: THREE.Mesh[]; head: THREE.Object3D } | null;
  scale: number;
  dispose(): void;
  /** Internal state of the procedural animator. */
  rig: Rig;
}

interface Rig {
  clip: Clip;
  t: number;
  seated: boolean;
  expression: Expression;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  legs: { thigh: THREE.Group; knee: THREE.Group }[];
  arms: { shoulder: THREE.Group; elbow: THREE.Group }[];
  eyes: THREE.Mesh[];
  joints: Joint[];
  hipY: number;
  /** 004: animation speed (running back to the desk plays the walk faster). */
  speed: number;
  /** 004: props shown with some clips / states. */
  cup: THREE.Object3D;
  umbrella: THREE.Object3D;
  umbrellaOn: boolean;
}

/** `shadows: false` for background people (park): they are outside the office's shadow frustum anyway. */
export function instantiate(appearance: string, opts: { shadows?: boolean } = {}): CharacterInstance {
  const shadows = opts.shadows ?? true;
  const look = LOOKS[appearance] ?? LOOKS['worker-a']!;
  const owned: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mat = (color: string, rough = 0.7) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
    owned.push(m);
    return m;
  };
  const skin = mat(look.skin, 0.6);
  const top = mat(look.top, 0.85);
  const bottom = mat(look.bottom, 0.85);
  const hairM = mat(look.hair, 0.55);
  const shoe = mat('#f5f5f5', 0.6);
  const eyeM = mat('#2b2238', 0.3);
  const shine = mat('#ffffff', 0.2);
  const cheek = mat('#ff9aa8', 0.6);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    geos.push(g);
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = shadows;
    parent.add(o);
    return o;
  };

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = S.hip;
  root.add(hips);

  // Legs: thigh pivot at the hip, knee pivot below it.
  const legs = [-1, 1].map((sx) => {
    const thigh = new THREE.Group();
    thigh.position.set(sx * 0.085, 0, 0);
    hips.add(thigh);
    mesh(new THREE.CapsuleGeometry(S.legR, S.thigh - S.legR, 6, 12), bottom, thigh, 0, -S.thigh / 2, 0);
    const knee = new THREE.Group();
    knee.position.y = -S.thigh;
    thigh.add(knee);
    mesh(new THREE.CapsuleGeometry(S.legR * 0.92, S.shin - S.legR, 6, 12), bottom, knee, 0, -S.shin / 2, 0);
    const foot = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.2), shoe, knee, 0, -S.shin - 0.01, 0.04);
    foot.scale.set(1, 1, 1);
    return { thigh, knee };
  });

  const torso = new THREE.Group();
  hips.add(torso);
  const torsoH = S.torsoLen + S.torsoR * 2;
  mesh(new THREE.CapsuleGeometry(S.torsoR, S.torsoLen, 8, 16), top, torso, 0, torsoH / 2, 0).scale.z = 0.8;

  const head = new THREE.Group();
  head.position.y = torsoH - 0.02 + S.head * 0.85;
  torso.add(head);
  mesh(new THREE.SphereGeometry(S.head, 28, 20), skin, head).scale.set(1, 0.95, 0.95);
  const hair = mesh(new THREE.SphereGeometry(S.head * 1.06, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, head, 0, S.head * 0.12, -S.head * 0.08);
  hair.rotation.x = -0.25;
  hair.scale.set(1, 1.05, 1.04);
  const eyes: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    eyes.push(mesh(new THREE.SphereGeometry(S.head * 0.12, 16, 12), eyeM, head, sx * S.head * 0.36, -S.head * 0.05, S.head * 0.86));
    mesh(new THREE.SphereGeometry(S.head * 0.04, 8, 8), shine, head, sx * S.head * 0.33, 0, S.head * 0.96);
    mesh(new THREE.SphereGeometry(S.head * 0.1, 12, 10), cheek, head, sx * S.head * 0.55, -S.head * 0.32, S.head * 0.72).scale.set(1, 0.6, 0.5);
  }

  // Arms: shoulder pivot, elbow pivot half-way.
  const arms = [-1, 1].map((sx) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * (S.torsoR + S.armR * 0.9), torsoH - S.torsoR * 0.55, 0);
    torso.add(shoulder);
    mesh(new THREE.CapsuleGeometry(S.armR, S.arm / 2 - S.armR, 6, 10), top, shoulder, 0, -S.arm / 4, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -S.arm / 2;
    shoulder.add(elbow);
    mesh(new THREE.CapsuleGeometry(S.armR * 0.95, S.arm / 2 - S.armR, 6, 10), skin, elbow, 0, -S.arm / 4, 0);
    mesh(new THREE.SphereGeometry(S.armR * 1.15, 12, 10), skin, elbow, 0, -S.arm / 2, 0);
    return { shoulder, elbow };
  });

  // 004 US3: a paper cup in the right hand (Drinking) and an umbrella held over the head (rain).
  const cup = new THREE.Group();
  cup.position.set(0, -S.arm / 2 - 0.02, 0.06);
  arms[1]!.elbow.add(cup);
  mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.09, 12), mat('#fffaf0', 0.5), cup);
  cup.visible = false;
  const umbrella = new THREE.Group();
  umbrella.position.set(0.12, 0, 0.05);
  root.add(umbrella);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), mat('#3b3b3b', 0.4), umbrella, 0, 1.3, 0);
  const canopy = mesh(new THREE.ConeGeometry(0.62, 0.28, 16, 1, true), mat('#c2603a', 0.7), umbrella, 0, 1.92, 0);
  (canopy.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  umbrella.visible = false;

  const joints: Joint[] = [];
  const j = (obj: THREE.Object3D) => joints.push({ obj, target: new THREE.Euler() });
  [hips, torso, head, ...legs.flatMap((l) => [l.thigh, l.knee]), ...arms.flatMap((a) => [a.shoulder, a.elbow])].forEach(j);

  const rig: Rig = { clip: 'Idle', t: 0, seated: false, expression: 'neutral', hips, torso, head, legs, arms, eyes, joints, hipY: S.hip, speed: 1, cup, umbrella, umbrellaOn: false };
  const c: CharacterInstance = {
    root,
    rig,
    face: { eyes, head },
    scale: 1,
    mixer: {
      update: (dt) => animate(rig, dt),
      stopAllAction: () => undefined,
    },
    dispose() {
      for (const m of owned) m.dispose();
      for (const g of geos) g.dispose();
    },
  };
  animate(rig, 0, true);
  return c;
}

/** Switch clip; joints ease to the new pose (the fade is implicit). */
export function play(c: CharacterInstance, clip: Clip, fade = 0.3, timeScale = 1): void {
  void fade; // kept for callers written for the glTF mixer; the procedural rig eases on its own
  c.rig.speed = timeScale;
  if (c.rig.clip === clip) return;
  c.rig.clip = clip;
  c.rig.t = 0;
}

/** Sitting on a chair or standing: the brain's pose decides, the clip only adds the motion. */
export function setSeated(c: CharacterInstance, seated: boolean): void {
  c.rig.seated = seated;
}

export function setFace(c: CharacterInstance, expression: Expression): void {
  c.rig.expression = expression;
}

/** 004 FR-029: hold an umbrella over the head (walking back in the rain). */
export function setUmbrella(c: CharacterInstance, on: boolean): void {
  c.rig.umbrellaOn = on;
  c.rig.umbrella.visible = on;
}

const set = (e: THREE.Euler, x = 0, y = 0, z = 0) => e.set(x, y, z);

function targetFor(r: Rig): void {
  const t = r.t;
  const [hips, torso, head, lThigh, lKnee, rThigh, rKnee, lSh, lEl, rSh, rEl] = r.joints.map((j) => j.target) as THREE.Euler[];
  for (const e of [hips, torso, head, lThigh, lKnee, rThigh, rKnee, lSh, lEl, rSh, rEl]) set(e!);
  r.hipY = r.seated ? SEAT_HIP : S.hip;
  // Arms hang slightly out from the body by default.
  set(lSh!, 0, 0, -0.12);
  set(rSh!, 0, 0, 0.12);
  if (r.seated) {
    set(lThigh!, -Math.PI / 2 + 0.05, 0, 0);
    set(rThigh!, -Math.PI / 2 + 0.05, 0, 0);
    set(lKnee!, Math.PI / 2 - 0.05, 0, 0);
    set(rKnee!, Math.PI / 2 - 0.05, 0, 0);
  }
  switch (r.clip) {
    case 'Walking': {
      const s = Math.sin(t * 8);
      set(lThigh!, s * 0.55);
      set(rThigh!, -s * 0.55);
      set(lKnee!, Math.max(0, -s) * 0.6);
      set(rKnee!, Math.max(0, s) * 0.6);
      set(lSh!, -s * 0.5, 0, -0.1);
      set(rSh!, s * 0.5, 0, 0.1);
      set(lEl!, -0.3);
      set(rEl!, -0.3);
      r.hipY += Math.abs(Math.cos(t * 8)) * 0.025;
      break;
    }
    case 'Sitting': {
      // At the desk: hands on the keyboard, a little typing motion.
      set(lSh!, -1.05 + Math.sin(t * 14) * 0.04, 0, -0.15);
      set(rSh!, -1.05 + Math.sin(t * 14 + 1.7) * 0.04, 0, 0.15);
      set(lEl!, -0.35);
      set(rEl!, -0.35);
      set(torso!, 0.06);
      break;
    }
    case 'Wave': {
      // Waiting for the boss: right hand up, waving.
      set(rSh!, -0.3, 0, 2.6 + Math.sin(t * 6) * 0.25);
      set(rEl!, -0.4);
      if (r.seated) set(lSh!, -1.0, 0, -0.15);
      break;
    }
    case 'No': {
      // Error: shaking the head, slumped a bit.
      set(head!, 0.25, Math.sin(t * 7) * 0.35);
      set(torso!, 0.15);
      set(lSh!, -0.7, 0, -0.15);
      set(rSh!, -0.7, 0, 0.15);
      break;
    }
    case 'Lying': {
      // 004: asleep on the sofa — on one side along the cushion (head towards local −x), legs straight.
      set(hips!, 0, 0, Math.PI / 2 - 0.05);
      set(lThigh!, 0.05);
      set(rThigh!, 0.05);
      set(lKnee!, 0.1);
      set(rKnee!, 0.1);
      set(lSh!, -0.2, 0, -0.25);
      set(rSh!, -0.6, 0, 0.35);
      set(head!, 0.25 + Math.sin(t * 0.8) * 0.03);
      r.hipY = 0.5;
      break;
    }
    case 'Resting': {
      // 004: sitting back on the sofa or a stool, hands on the lap.
      set(torso!, -0.18);
      set(lSh!, -0.55, 0, -0.1);
      set(rSh!, -0.55, 0, 0.1);
      set(lEl!, -0.6);
      set(rEl!, -0.6);
      set(head!, Math.sin(t * 0.6) * 0.06, Math.sin(t * 0.4) * 0.2);
      break;
    }
    case 'Drinking':
    case 'Yes': {
      // Drinking at the cooler: cup to the mouth now and then, nodding.
      const sip = Math.max(0, Math.sin(t * 1.6));
      set(rSh!, -1.2 - sip * 0.9, 0, 0.2);
      set(rEl!, -1.2 * sip - 0.6);
      set(head!, -0.15 * sip + Math.sin(t * 3) * 0.05);
      break;
    }
    case 'ThumbsUp':
    case 'Jump':
    case 'Dance': {
      // A stretch: both arms up, a lean back and forth.
      const k = (1 + Math.sin(t * 2.5)) / 2;
      set(lSh!, 0, 0, -(0.4 + k * 2.3));
      set(rSh!, 0, 0, 0.4 + k * 2.3);
      set(torso!, -0.1 * k, 0, Math.sin(t * 1.2) * 0.08);
      break;
    }
    case 'Standing':
    case 'Idle':
    default: {
      set(torso!, Math.sin(t * 1.4) * 0.02, 0, Math.sin(t * 0.9) * 0.02);
      set(head!, Math.sin(t * 0.7) * 0.05, Math.sin(t * 0.5) * 0.15);
      break;
    }
  }
}

function animate(r: Rig, dt: number, snap = false): void {
  r.t += dt * r.speed;
  targetFor(r);
  r.cup.visible = r.clip === 'Drinking';
  if (r.umbrellaOn) {
    // Right hand up on the umbrella pole.
    const [, , , , , , , , , rSh, rEl] = r.joints.map((j) => j.target);
    rSh!.set(-0.35, 0, 0.55);
    rEl!.set(-1.1, 0, 0);
  }
  const k = snap ? 1 : 1 - Math.exp(-dt * 10);
  for (const jt of r.joints) {
    const o = jt.obj.rotation;
    o.x += (jt.target.x - o.x) * k;
    o.y += (jt.target.y - o.y) * k;
    o.z += (jt.target.z - o.z) * k;
  }
  r.hips.position.y += (r.hipY - r.hips.position.y) * k;
  // Expressions: round eyes, wider when surprised, half-closed when sad.
  const ey = r.clip === 'Lying' ? 0.08 : r.expression === 'Surprised' ? 1.35 : r.expression === 'Sad' ? 0.45 : r.expression === 'Angry' ? 0.7 : 1;
  for (const e of r.eyes) e.scale.y += (ey - e.scale.y) * (snap ? 1 : 1 - Math.exp(-dt * 12));
}
