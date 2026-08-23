export type Vec3 = { x: number; y: number; z: number };

type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type JointId =
  | "root"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "lShoulder"
  | "lElbow"
  | "lWrist"
  | "lPalm"
  | "lIndex"
  | "lThumb"
  | "rShoulder"
  | "rElbow"
  | "rWrist"
  | "rPalm"
  | "rIndex"
  | "rThumb"
  | "lHip"
  | "lKnee"
  | "lAnkle"
  | "lToe"
  | "rHip"
  | "rKnee"
  | "rAnkle"
  | "rToe";

type JointDef = {
  id: JointId;
  parent: JointId | null;
  offset: Vec3;
  jointR: number;
  bodyR: number;
};

type Bone = {
  a: JointId;
  b: JointId;
  kind: "spine" | "limb" | "hand";
};

type Projected = Vec3 & { s: number; px: number; py: number };

type Particle = {
  a: JointId;
  b: JointId;
  u: number;
  speed: number;
  orbit: number;
  phase: number;
  size: number;
  kind: "flow" | "embed";
};

export type NeuralLayers = {
  signal: number;
  joints: number;
  bones: number;
  mesh: number;
  trails: number;
  particles: number;
  embedding: number;
  living: number;
  scanY: number;
  revealed: boolean;
};

export type NeuralHumanState = {
  joints: Record<JointId, Vec3>;
  projected: Record<JointId, Projected>;
  particles: Particle[];
  trails: Record<"head" | "lWrist" | "rWrist" | "lAnkle" | "rAnkle", Vec3[]>;
  elapsed: number;
  layers: NeuralLayers;
};

const PHOSPHOR = { r: 57, g: 255, b: 20 };
const SILVER = { r: 228, g: 234, b: 230 };

const TREE: JointDef[] = [
  { id: "root", parent: null, offset: { x: 0, y: 0.94, z: 0 }, jointR: 4.2, bodyR: 0.11 },
  { id: "spine", parent: "root", offset: { x: 0, y: 0.15, z: 0.012 }, jointR: 3.4, bodyR: 0.12 },
  { id: "chest", parent: "spine", offset: { x: 0, y: 0.17, z: -0.01 }, jointR: 3.8, bodyR: 0.145 },
  { id: "neck", parent: "chest", offset: { x: 0, y: 0.11, z: 0.01 }, jointR: 3.1, bodyR: 0.05 },
  { id: "head", parent: "neck", offset: { x: 0, y: 0.13, z: 0.02 }, jointR: 5.8, bodyR: 0.1 },
  { id: "lShoulder", parent: "chest", offset: { x: -0.175, y: 0.05, z: 0.01 }, jointR: 3.6, bodyR: 0.062 },
  { id: "lElbow", parent: "lShoulder", offset: { x: -0.27, y: 0, z: 0 }, jointR: 3.1, bodyR: 0.046 },
  { id: "lWrist", parent: "lElbow", offset: { x: -0.24, y: 0, z: 0 }, jointR: 2.7, bodyR: 0.03 },
  { id: "lPalm", parent: "lWrist", offset: { x: -0.065, y: 0, z: 0.012 }, jointR: 2.2, bodyR: 0.028 },
  { id: "lIndex", parent: "lPalm", offset: { x: -0.08, y: -0.008, z: 0.018 }, jointR: 1.6, bodyR: 0.012 },
  { id: "lThumb", parent: "lPalm", offset: { x: -0.04, y: 0.028, z: 0.038 }, jointR: 1.6, bodyR: 0.012 },
  { id: "rShoulder", parent: "chest", offset: { x: 0.175, y: 0.05, z: 0.01 }, jointR: 3.6, bodyR: 0.062 },
  { id: "rElbow", parent: "rShoulder", offset: { x: 0.27, y: 0, z: 0 }, jointR: 3.1, bodyR: 0.046 },
  { id: "rWrist", parent: "rElbow", offset: { x: 0.24, y: 0, z: 0 }, jointR: 2.7, bodyR: 0.03 },
  { id: "rPalm", parent: "rWrist", offset: { x: 0.065, y: 0, z: 0.012 }, jointR: 2.2, bodyR: 0.028 },
  { id: "rIndex", parent: "rPalm", offset: { x: 0.08, y: -0.008, z: 0.018 }, jointR: 1.6, bodyR: 0.012 },
  { id: "rThumb", parent: "rPalm", offset: { x: 0.04, y: 0.028, z: 0.038 }, jointR: 1.6, bodyR: 0.012 },
  { id: "lHip", parent: "root", offset: { x: -0.092, y: -0.02, z: 0.01 }, jointR: 3.6, bodyR: 0.07 },
  { id: "lKnee", parent: "lHip", offset: { x: 0, y: -0.42, z: 0.02 }, jointR: 3.2, bodyR: 0.05 },
  { id: "lAnkle", parent: "lKnee", offset: { x: 0, y: -0.4, z: 0 }, jointR: 2.8, bodyR: 0.036 },
  { id: "lToe", parent: "lAnkle", offset: { x: 0, y: -0.015, z: 0.13 }, jointR: 2, bodyR: 0.022 },
  { id: "rHip", parent: "root", offset: { x: 0.092, y: -0.02, z: 0.01 }, jointR: 3.6, bodyR: 0.07 },
  { id: "rKnee", parent: "rHip", offset: { x: 0, y: -0.42, z: 0.02 }, jointR: 3.2, bodyR: 0.05 },
  { id: "rAnkle", parent: "rKnee", offset: { x: 0, y: -0.4, z: 0 }, jointR: 2.8, bodyR: 0.036 },
  { id: "rToe", parent: "rAnkle", offset: { x: 0, y: -0.015, z: 0.13 }, jointR: 2, bodyR: 0.022 },
];

const BONES: Bone[] = [
  { a: "root", b: "spine", kind: "spine" },
  { a: "spine", b: "chest", kind: "spine" },
  { a: "chest", b: "neck", kind: "spine" },
  { a: "neck", b: "head", kind: "spine" },
  { a: "chest", b: "lShoulder", kind: "spine" },
  { a: "chest", b: "rShoulder", kind: "spine" },
  { a: "lShoulder", b: "lElbow", kind: "limb" },
  { a: "lElbow", b: "lWrist", kind: "limb" },
  { a: "lWrist", b: "lPalm", kind: "hand" },
  { a: "lPalm", b: "lIndex", kind: "hand" },
  { a: "lPalm", b: "lThumb", kind: "hand" },
  { a: "rShoulder", b: "rElbow", kind: "limb" },
  { a: "rElbow", b: "rWrist", kind: "limb" },
  { a: "rWrist", b: "rPalm", kind: "hand" },
  { a: "rPalm", b: "rIndex", kind: "hand" },
  { a: "rPalm", b: "rThumb", kind: "hand" },
  { a: "root", b: "lHip", kind: "spine" },
  { a: "root", b: "rHip", kind: "spine" },
  { a: "lHip", b: "lKnee", kind: "limb" },
  { a: "lKnee", b: "lAnkle", kind: "limb" },
  { a: "lAnkle", b: "lToe", kind: "limb" },
  { a: "rHip", b: "rKnee", kind: "limb" },
  { a: "rKnee", b: "rAnkle", kind: "limb" },
  { a: "rAnkle", b: "rToe", kind: "limb" },
];

const TRAIL_KEYS = ["head", "lWrist", "rWrist", "lAnkle", "rAnkle"] as const;
const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const BY_ID = Object.fromEntries(TREE.map((joint) => [joint.id, joint])) as Record<
  JointId,
  JointDef
>;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(
  color: { r: number; g: number; b: number },
  alpha: number,
) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha)})`;
}

function mulM(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function mulV(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function eulerXYZ(ax: number, ay: number, az: number): Mat3 {
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const cz = Math.cos(az);
  const sz = Math.sin(az);
  const rx: Mat3 = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const ry: Mat3 = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const rz: Mat3 = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mulM(mulM(rz, ry), rx);
}

function cinematicPose(t: number): Record<JointId, { rx: number; ry: number; rz: number }> {
  const breath = Math.sin(t * 1.28);
  const shift = Math.sin(t * 0.41);
  const reach = 0.5 + 0.5 * Math.sin(t * 0.58);
  const curl = smoothstep(0.15, 0.82, reach);
  const zero = { rx: 0, ry: 0, rz: 0 };

  const pose = Object.fromEntries(TREE.map((joint) => [joint.id, { ...zero }])) as Record<
    JointId,
    { rx: number; ry: number; rz: number }
  >;

  pose.root = { rx: 0.04, ry: 0.22, rz: shift * 0.045 };
  pose.spine = { rx: 0.08 + breath * 0.018, ry: -0.06 * reach, rz: -shift * 0.02 };
  pose.chest = { rx: breath * 0.03, ry: -0.14 * reach, rz: shift * 0.012 };
  pose.neck = { rx: -0.08, ry: 0.22 * reach, rz: -shift * 0.02 };
  pose.head = { rx: 0.04, ry: 0.18 * reach, rz: 0 };

  pose.lShoulder = { rx: 0.22 + shift * 0.08, ry: 0.18, rz: 0.58 };
  pose.lElbow = { rx: 0.38, ry: 0.08, rz: 0.14 };
  pose.lWrist = { rx: 0.1, ry: 0.14, rz: 0.12 };
  pose.lPalm = { rx: 0.06, ry: 0.04, rz: 0.08 };
  pose.lIndex = { rx: 0.18, ry: 0, rz: 0.16 };
  pose.lThumb = { rx: 0.1, ry: 0.18, rz: 0.22 };

  pose.rShoulder = {
    rx: -0.32 - reach * 0.82,
    ry: -0.22 - reach * 0.52,
    rz: -0.18,
  };
  pose.rElbow = { rx: 0.48 + reach * 0.52, ry: 0.12 * reach, rz: 0.04 };
  pose.rWrist = { rx: -0.12 + curl * 0.08, ry: 0.22 * reach, rz: 0.16 * curl };
  pose.rPalm = { rx: 0.04, ry: 0.08 * reach, rz: 0.1 * curl };
  pose.rIndex = { rx: 0.2 + curl * 0.85, ry: 0.04, rz: 0.12 };
  pose.rThumb = { rx: 0.12, ry: 0.22 + curl * 0.35, rz: 0.28 + curl * 0.4 };

  pose.lHip = { rx: -0.1 - shift * 0.14, ry: 0.02, rz: 0.035 };
  pose.lKnee = { rx: 0.2 + Math.max(0, -shift) * 0.24, ry: 0, rz: 0 };
  pose.lAnkle = { rx: -0.08 + Math.max(0, shift) * 0.1, ry: 0, rz: 0 };
  pose.lToe = { rx: 0.08, ry: 0, rz: 0 };

  pose.rHip = { rx: -0.06 + shift * 0.16, ry: -0.02, rz: -0.03 };
  pose.rKnee = { rx: 0.14 + Math.max(0, shift) * 0.2, ry: 0, rz: 0 };
  pose.rAnkle = { rx: -0.1 + Math.max(0, -shift) * 0.08, ry: 0, rz: 0 };
  pose.rToe = { rx: 0.06, ry: 0, rz: 0 };

  return pose;
}

function solveSkeleton(t: number): Record<JointId, Vec3> {
  const pose = cinematicPose(t);
  const rotation: Partial<Record<JointId, Mat3>> = {};
  const position: Partial<Record<JointId, Vec3>> = {};

  for (const joint of TREE) {
    const local = eulerXYZ(pose[joint.id].rx, pose[joint.id].ry, pose[joint.id].rz);
    if (!joint.parent) {
      rotation[joint.id] = local;
      position[joint.id] = add(joint.offset, {
        x: Math.sin(t * 0.41) * 0.018,
        y: Math.sin(t * 1.28) * 0.01,
        z: 0,
      });
      continue;
    }
    const parentR = rotation[joint.parent] ?? IDENTITY;
    const parentT = position[joint.parent] ?? { x: 0, y: 0, z: 0 };
    rotation[joint.id] = mulM(parentR, local);
    position[joint.id] = add(parentT, mulV(parentR, joint.offset));
  }

  return position as Record<JointId, Vec3>;
}

function projectPoint(
  point: Vec3,
  width: number,
  height: number,
  azimuth: number,
  elevation: number,
): Projected {
  const cosA = Math.cos(azimuth);
  const sinA = Math.sin(azimuth);
  const x1 = point.x * cosA - point.z * sinA;
  const z1 = point.x * sinA + point.z * cosA;
  const cosE = Math.cos(elevation);
  const sinE = Math.sin(elevation);
  const y2 = point.y * cosE - z1 * sinE;
  const z2 = point.y * sinE + z1 * cosE;
  const focal = 3.15;
  const s = focal / (focal + z2 + 0.15);
  const scale = height * 0.5;
  return {
    x: point.x,
    y: point.y,
    z: z2,
    s,
    px: width * 0.42 + x1 * s * scale,
    py: height * 0.84 - y2 * s * scale,
  };
}

function layersFor(elapsed: number, reduceMotion: boolean): NeuralLayers {
  if (reduceMotion) {
    return {
      signal: 0.15,
      joints: 1,
      bones: 1,
      mesh: 1,
      trails: 0.55,
      particles: 0.7,
      embedding: 0.8,
      living: 1,
      scanY: -0.12,
      revealed: true,
    };
  }

  const scanY = lerp(1.92, -0.12, smoothstep(0.45, 7.8, elapsed));
  return {
    signal: smoothstep(0, 1.2, elapsed) * (1 - smoothstep(3.8, 6.4, elapsed) * 0.78),
    joints: smoothstep(0.7, 3.0, elapsed),
    bones: smoothstep(1.8, 4.2, elapsed),
    mesh: smoothstep(3.2, 6.2, elapsed),
    trails: smoothstep(5.2, 7.6, elapsed),
    particles: smoothstep(6.0, 8.8, elapsed),
    embedding: smoothstep(7.2, 10.2, elapsed),
    living: smoothstep(8.6, 11.4, elapsed),
    scanY,
    revealed: elapsed > 7.8,
  };
}

function scanAlpha(worldY: number, layers: NeuralLayers) {
  if (layers.revealed) return 1;
  return smoothstep(layers.scanY - 0.08, layers.scanY + 0.16, worldY);
}

function createParticles(): Particle[] {
  const rand = mulberry32(20260821);
  const particles: Particle[] = [];

  for (const bone of BONES) {
    const count = bone.kind === "hand" ? 2 : bone.kind === "spine" ? 5 : 4;
    for (let i = 0; i < count; i += 1) {
      particles.push({
        a: bone.a,
        b: bone.b,
        u: rand(),
        speed: 0.09 + rand() * 0.16,
        orbit: 0.012 + rand() * 0.028,
        phase: rand() * Math.PI * 2,
        size: 0.7 + rand() * 1.4,
        kind: "flow",
      });
    }
  }

  for (let i = 0; i < 36; i += 1) {
    particles.push({
      a: "chest",
      b: "spine",
      u: rand(),
      speed: 0.04 + rand() * 0.08,
      orbit: 0.08 + rand() * 0.16,
      phase: rand() * Math.PI * 2,
      size: 0.8 + rand() * 1.6,
      kind: "embed",
    });
  }

  return particles;
}

export function createNeuralHumanState(): NeuralHumanState {
  const empty = { x: 0, y: 0, z: 0 };
  const joints = Object.fromEntries(TREE.map((joint) => [joint.id, { ...empty }])) as Record<
    JointId,
    Vec3
  >;
  const projected = Object.fromEntries(
    TREE.map((joint) => [joint.id, { ...empty, s: 1, px: 0, py: 0 }]),
  ) as Record<JointId, Projected>;

  return {
    joints,
    projected,
    particles: createParticles(),
    trails: {
      head: [],
      lWrist: [],
      rWrist: [],
      lAnkle: [],
      rAnkle: [],
    },
    elapsed: 0,
    layers: layersFor(0, false),
  };
}

export function tickNeuralHuman(
  state: NeuralHumanState,
  dt: number,
  elapsed: number,
  width: number,
  height: number,
  pointer: { x: number; y: number },
  reduceMotion: boolean,
) {
  state.elapsed = elapsed;
  state.layers = layersFor(elapsed, reduceMotion);
  state.joints = solveSkeleton(reduceMotion ? 1.85 : elapsed * 0.92);

  const azimuth = 0.62 + pointer.x * 0.2 + Math.sin(elapsed * 0.13) * 0.04;
  const elevation = 0.16 + pointer.y * 0.08;

  for (const joint of TREE) {
    state.projected[joint.id] = projectPoint(
      state.joints[joint.id],
      width,
      height,
      azimuth,
      elevation,
    );
  }

  if (!reduceMotion) {
    for (const key of TRAIL_KEYS) {
      const point = state.projected[key];
      const trail = state.trails[key];
      trail.push({ x: point.px, y: point.py, z: point.z });
      const max = 28;
      if (trail.length > max) trail.splice(0, trail.length - max);
    }

    for (const particle of state.particles) {
      particle.u = (particle.u + dt * particle.speed) % 1;
      particle.phase += dt * 0.7;
    }
  }
}

function sampleBone(state: NeuralHumanState, a: JointId, b: JointId, u: number): Vec3 {
  const pa = state.joints[a];
  const pb = state.joints[b];
  return {
    x: lerp(pa.x, pb.x, u),
    y: lerp(pa.y, pb.y, u),
    z: lerp(pa.z, pb.z, u),
  };
}

function drawCapsule(
  ctx: CanvasRenderingContext2D,
  a: Projected,
  b: Projected,
  radiusA: number,
  radiusB: number,
  fill: string,
  stroke: string,
) {
  const dx = b.px - a.px;
  const dy = b.py - a.py;
  const length = Math.hypot(dx, dy) || 1;
  ctx.save();
  ctx.translate(a.px, a.py);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.beginPath();
  ctx.moveTo(0, -radiusA);
  ctx.lineTo(length, -radiusB);
  ctx.arc(length, 0, Math.max(0.6, radiusB), -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, radiusA);
  ctx.arc(0, 0, Math.max(0.6, radiusA), Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  azimuth: number,
  elevation: number,
  alpha: number,
) {
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i += 1) {
    const a = projectPoint({ x: i * 0.22, y: 0, z: -0.55 }, width, height, azimuth, elevation);
    const b = projectPoint({ x: i * 0.22, y: 0, z: 0.7 }, width, height, azimuth, elevation);
    ctx.strokeStyle = rgba(SILVER, alpha * 0.12 * (1 - Math.abs(i) / 4));
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }
  for (let i = -2; i <= 3; i += 1) {
    const a = projectPoint({ x: -0.72, y: 0, z: i * 0.2 }, width, height, azimuth, elevation);
    const b = projectPoint({ x: 0.72, y: 0, z: i * 0.2 }, width, height, azimuth, elevation);
    ctx.strokeStyle = rgba(SILVER, alpha * 0.11);
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSignal(
  ctx: CanvasRenderingContext2D,
  state: NeuralHumanState,
  width: number,
  height: number,
) {
  const alpha = state.layers.signal;
  if (alpha < 0.02) return;

  ctx.save();
  for (let i = 0; i < 11; i += 1) {
    const y = height * (0.1 + i * 0.07);
    const wave = Math.sin(state.elapsed * 1.4 + i * 0.55) * 8;
    ctx.strokeStyle = rgba(SILVER, alpha * (0.06 + (i % 3 === 0 ? 0.05 : 0)));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * 0.05, y);
    ctx.lineTo(width * 0.28 + wave, y);
    ctx.stroke();
  }

  ctx.lineCap = "round";
  for (const bone of BONES) {
    if (bone.kind === "hand") continue;
    const a = state.projected[bone.a];
    const b = state.projected[bone.b];
    ctx.strokeStyle = rgba(SILVER, alpha * 0.18);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }

  const wrist = state.projected.rWrist;
  ctx.strokeStyle = rgba(PHOSPHOR, alpha * 0.4);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(width * 0.08, height * 0.2);
  ctx.quadraticCurveTo(width * 0.22, height * 0.16, wrist.px, wrist.py);
  ctx.stroke();
  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, state: NeuralHumanState) {
  const { mesh } = state.layers;
  if (mesh < 0.02) return;
  const ls = state.projected.lShoulder;
  const rs = state.projected.rShoulder;
  const chest = state.projected.chest;
  const lh = state.projected.lHip;
  const rh = state.projected.rHip;
  const root = state.projected.root;
  const reveal = scanAlpha(
    (state.joints.chest.y + state.joints.root.y) * 0.5,
    state.layers,
  );
  const alpha = mesh * reveal * 0.2;
  if (alpha < 0.01) return;

  ctx.beginPath();
  ctx.moveTo(ls.px, ls.py);
  ctx.quadraticCurveTo(chest.px, chest.py - 12, rs.px, rs.py);
  ctx.quadraticCurveTo(
    (rs.px + rh.px) * 0.5 + 6,
    (rs.py + rh.py) * 0.5,
    rh.px,
    rh.py,
  );
  ctx.quadraticCurveTo(root.px, root.py + 10, lh.px, lh.py);
  ctx.quadraticCurveTo(
    (ls.px + lh.px) * 0.5 - 6,
    (ls.py + lh.py) * 0.5,
    ls.px,
    ls.py,
  );
  ctx.closePath();
  ctx.fillStyle = rgba(SILVER, alpha);
  ctx.fill();
  ctx.strokeStyle = rgba(SILVER, alpha * 1.6);
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawMesh(ctx: CanvasRenderingContext2D, state: NeuralHumanState) {
  const { mesh, living } = state.layers;
  if (mesh < 0.02) return;

  drawTorso(ctx, state);

  const capsules = BONES.map((bone) => {
    const a = state.projected[bone.a];
    const b = state.projected[bone.b];
    const defA = BY_ID[bone.a];
    const defB = BY_ID[bone.b];
    return {
      bone,
      a,
      b,
      z: (a.z + b.z) * 0.5,
      ra: defA.bodyR * a.s * 108,
      rb: defB.bodyR * b.s * 108,
      shade: clamp(0.34 + (0.66 - (a.z + b.z) * 0.16)),
    };
  }).sort((left, right) => left.z - right.z);

  for (const capsule of capsules) {
    const reveal = scanAlpha(
      (state.joints[capsule.bone.a].y + state.joints[capsule.bone.b].y) * 0.5,
      state.layers,
    );
    const alpha = mesh * reveal * (0.14 + capsule.shade * 0.16 + living * 0.05);
    if (alpha < 0.01) continue;
    drawCapsule(
      ctx,
      capsule.a,
      capsule.b,
      capsule.ra,
      capsule.rb,
      rgba(SILVER, alpha),
      rgba(SILVER, alpha * 1.7),
    );
  }

  const head = state.projected.head;
  const headReveal = scanAlpha(state.joints.head.y, state.layers);
  const headR = 18.5 * head.s;
  const headAlpha = mesh * headReveal * 0.24;
  if (headAlpha > 0.01) {
    ctx.beginPath();
    ctx.ellipse(head.px, head.py - 2, headR * 0.82, headR, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(SILVER, headAlpha);
    ctx.fill();
    ctx.strokeStyle = rgba(SILVER, headAlpha * 1.6);
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
}

function drawBones(ctx: CanvasRenderingContext2D, state: NeuralHumanState) {
  if (state.layers.bones < 0.02) return;

  const bones = BONES.map((bone) => ({
    bone,
    a: state.projected[bone.a],
    b: state.projected[bone.b],
    z: (state.projected[bone.a].z + state.projected[bone.b].z) * 0.5,
  })).sort((left, right) => left.z - right.z);

  ctx.save();
  ctx.lineCap = "round";
  for (const item of bones) {
    const reveal = scanAlpha(
      (state.joints[item.bone.a].y + state.joints[item.bone.b].y) * 0.5,
      state.layers,
    );
    const alpha = state.layers.bones * reveal * (item.bone.kind === "hand" ? 0.55 : 0.78);
    if (alpha < 0.02) continue;
    ctx.strokeStyle = rgba(SILVER, alpha);
    ctx.lineWidth = item.bone.kind === "spine" ? 2.1 : item.bone.kind === "hand" ? 1.2 : 1.65;
    ctx.beginPath();
    ctx.moveTo(item.a.px, item.a.py);
    ctx.lineTo(item.b.px, item.b.py);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrails(ctx: CanvasRenderingContext2D, state: NeuralHumanState) {
  if (state.layers.trails < 0.02) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const key of TRAIL_KEYS) {
    const trail = state.trails[key];
    if (trail.length < 3) continue;
    const accent = key === "rWrist" || key === "lWrist";
    ctx.beginPath();
    trail.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = accent
      ? rgba(PHOSPHOR, state.layers.trails * 0.58)
      : rgba(SILVER, state.layers.trails * 0.32);
    ctx.lineWidth = accent ? 1.8 : 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  state: NeuralHumanState,
  width: number,
  height: number,
  azimuth: number,
  elevation: number,
) {
  if (state.layers.particles < 0.02 && state.layers.embedding < 0.02) return;

  for (const particle of state.particles) {
    const along = sampleBone(state, particle.a, particle.b, particle.u);
    const swirl = particle.kind === "embed" ? particle.orbit : particle.orbit * 0.45;
    const point = {
      x: along.x + Math.cos(particle.phase) * swirl,
      y: along.y + Math.sin(particle.phase * 0.8) * swirl * 0.45,
      z: along.z + Math.sin(particle.phase) * swirl,
    };
    const projected = projectPoint(point, width, height, azimuth, elevation);
    const reveal = scanAlpha(point.y, state.layers);
    const layer = particle.kind === "embed" ? state.layers.embedding : state.layers.particles;
    const alpha = layer * reveal * (particle.kind === "embed" ? 0.55 : 0.72);
    if (alpha < 0.02) continue;

    const radius = particle.size * projected.s;
    const color = particle.kind === "embed" ? PHOSPHOR : SILVER;
    ctx.beginPath();
    ctx.arc(projected.px, projected.py, radius, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, alpha);
    ctx.fill();
  }
}

function drawJoints(ctx: CanvasRenderingContext2D, state: NeuralHumanState) {
  if (state.layers.joints < 0.02) return;

  const joints = TREE.map((def) => ({
    def,
    point: state.projected[def.id],
    world: state.joints[def.id],
  })).sort((left, right) => left.point.z - right.point.z);

  for (const item of joints) {
    const reveal = scanAlpha(item.world.y, state.layers);
    const alpha = state.layers.joints * reveal;
    if (alpha < 0.02) continue;

    const radius = item.def.jointR * item.point.s;
    const glow = ctx.createRadialGradient(
      item.point.px,
      item.point.py,
      0,
      item.point.px,
      item.point.py,
      radius * 3.4,
    );
    glow.addColorStop(0, rgba(PHOSPHOR, alpha * 0.42));
    glow.addColorStop(0.35, rgba(PHOSPHOR, alpha * 0.1));
    glow.addColorStop(1, rgba(PHOSPHOR, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(item.point.px, item.point.py, radius * 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(item.point.px, item.point.py, radius, 0, Math.PI * 2);
    ctx.fillStyle = rgba(SILVER, alpha * 0.92);
    ctx.fill();
    ctx.strokeStyle = rgba(PHOSPHOR, alpha * 0.55);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawScan(ctx: CanvasRenderingContext2D, state: NeuralHumanState, width: number) {
  if (state.layers.revealed || state.elapsed < 0.35) return;
  const samples = TREE.map((joint) => state.projected[joint.id]);
  const ys = samples.map((point) => point.py);
  const minY = Math.min(...ys) - 14;
  const maxY = Math.max(...ys) + 22;
  const y = lerp(minY, maxY, smoothstep(0.45, 7.8, state.elapsed));

  ctx.save();
  const band = ctx.createLinearGradient(0, y - 16, 0, y + 16);
  band.addColorStop(0, rgba(PHOSPHOR, 0));
  band.addColorStop(0.5, rgba(PHOSPHOR, 0.2));
  band.addColorStop(1, rgba(PHOSPHOR, 0));
  ctx.fillStyle = band;
  ctx.fillRect(width * 0.12, y - 16, width * 0.62, 32);
  ctx.strokeStyle = rgba(SILVER, 0.42);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.14, y);
  ctx.lineTo(width * 0.72, y);
  ctx.stroke();
  ctx.restore();
}

function drawReadout(ctx: CanvasRenderingContext2D, state: NeuralHumanState, height: number) {
  const label =
    state.elapsed < 2.4
      ? "MOTION SIGNAL"
      : state.elapsed < 5.8
        ? "3D RECONSTRUCTION"
        : state.elapsed < 9.2
          ? "NEURAL REPRESENTATION"
          : "PHYSICAL INTELLIGENCE";

  ctx.save();
  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  ctx.fillStyle = rgba(SILVER, 0.38 + state.layers.living * 0.12);
  ctx.fillText(label, 18, height - 16);
  ctx.restore();
}

function drawSelectedJoint(
  ctx: CanvasRenderingContext2D,
  state: NeuralHumanState,
  selectedJoint?: JointId,
) {
  if (!selectedJoint) return;
  const point = state.projected[selectedJoint];
  if (!point) return;

  ctx.save();
  ctx.strokeStyle = rgba(PHOSPHOR, 0.92);
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(point.px, point.py, 17 * point.s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(point.px + 14, point.py - 14);
  ctx.lineTo(point.px + 42, point.py - 36);
  ctx.lineTo(point.px + 58, point.py - 36);
  ctx.stroke();
  ctx.fillStyle = rgba(SILVER, 0.82);
  ctx.font = "500 9px 'IBM Plex Mono', monospace";
  ctx.fillText("ACTIVE", point.px + 44, point.py - 41);
  ctx.restore();
}

export function drawNeuralHuman(
  ctx: CanvasRenderingContext2D,
  state: NeuralHumanState,
  width: number,
  height: number,
  pointer: { x: number; y: number },
  selectedJoint?: JointId,
) {
  ctx.clearRect(0, 0, width, height);
  const azimuth = 0.62 + pointer.x * 0.2 + Math.sin(state.elapsed * 0.13) * 0.04;
  const elevation = 0.16 + pointer.y * 0.08;

  const vignette = ctx.createRadialGradient(
    width * 0.46,
    height * 0.52,
    height * 0.12,
    width * 0.46,
    height * 0.52,
    height * 0.78,
  );
  vignette.addColorStop(0, "rgba(12, 16, 12, 0)");
  vignette.addColorStop(1, "rgba(5, 5, 5, 0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  drawFloor(ctx, width, height, azimuth, elevation, 0.7 + state.layers.mesh * 0.3);
  drawSignal(ctx, state, width, height);
  drawMesh(ctx, state);
  drawBones(ctx, state);
  drawTrails(ctx, state);
  drawParticles(ctx, state, width, height, azimuth, elevation);
  drawJoints(ctx, state);
  drawSelectedJoint(ctx, state, selectedJoint);
  drawScan(ctx, state, width);
  drawReadout(ctx, state, height);
}
