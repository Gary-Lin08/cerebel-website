import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CircleNotch } from "@phosphor-icons/react/CircleNotch";
import { Pause } from "@phosphor-icons/react/Pause";
import { Play } from "@phosphor-icons/react/Play";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createJointGlow, createMuscleVolume } from "./muscle-volumes";
import { createParticleMaterial, createShellMaterial, createSurfaceSampler } from "./particle-surface";
import type { SwingAnalysisBundle, SwingAnnotation, SwingSeries } from "./types";
import "./golf-swing.css";

interface GolfSwingAnalysisProps {
  dataUrl: string;
  active?: boolean;
}

interface LoadedSwing {
  bundle: SwingAnalysisBundle;
  vertices: Float32Array;
  faces: Uint32Array;
  bones: THREE.Group;
}

type Speed = "auto" | 0.25 | 1;

const TRAIL_COLOR = "#52e07c";
const TRAIL_SUBSTEPS = 6;
const SPEEDS: Speed[] = ["auto", 0.25, 1];
// Director pacing: the swing runs slow, freezes on each finding, then settles into the full exposure.
const AUTO_RATE = 0.45;
const FINDING_HOLD_SECONDS = 2.8;
const END_HOLD_SECONDS = 2.8;
const MANUAL_END_HOLD_SECONDS = 1.4;
const STACK_BREAKPOINT = 720;
// Share of the stage given to the full-body exposure; the rest is the anatomy close-up.
const HERO_SHARE_WIDE = 0.62;
const HERO_SHARE_STACKED = 0.58;
const BODY_SAMPLES = 24_000;
const GHOST_SAMPLES = 9_000;
const BONE_COLOR = "#eee9dd";
const DEFAULT_ACCENT = "#b99bff";
const UP = new THREE.Vector3(0, 0, 1);

async function loadSwing(dataUrl: string, signal: AbortSignal): Promise<LoadedSwing> {
  const response = await fetch(dataUrl, { signal });
  if (!response.ok) throw new Error("Swing analysis could not be loaded.");
  const bundle = (await response.json()) as SwingAnalysisBundle;
  if (bundle.format !== "cerebel-swing-analysis-v1") throw new Error("Swing analysis format is not supported.");

  const [verticesBuffer, facesBuffer, gltf] = await Promise.all([
    fetch(bundle.surface.verticesUrl, { signal }).then((r) => {
      if (!r.ok) throw new Error("Surface sequence could not be loaded.");
      return r.arrayBuffer();
    }),
    fetch(bundle.surface.facesUrl, { signal }).then((r) => {
      if (!r.ok) throw new Error("Surface faces could not be loaded.");
      return r.arrayBuffer();
    }),
    new GLTFLoader().loadAsync(bundle.skeleton.boneModelUrl),
  ]);

  const packed = new Int16Array(verticesBuffer);
  const { offset, scale } = bundle.surface.quantisation;
  const vertices = new Float32Array(packed.length);
  for (let i = 0; i < packed.length; i += 1) {
    const axis = i % 3;
    vertices[i] = (packed[i] + 32768) * scale[axis] + offset[axis];
  }
  return { bundle, vertices, faces: new Uint32Array(facesBuffer), bones: gltf.scene };
}

function catmullRom(points: THREE.Vector3[], substeps: number): number[] {
  const out: number[] = [];
  const p = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  const v = new THREE.Vector3();
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let s = 0; s < substeps; s += 1) {
      const t = s / substeps;
      const t2 = t * t;
      const t3 = t2 * t;
      const [a, b, c, d] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
      v.set(0, 0, 0)
        .addScaledVector(a, -0.5 * t3 + t2 - 0.5 * t)
        .addScaledVector(b, 1.5 * t3 - 2.5 * t2 + 1)
        .addScaledVector(c, -1.5 * t3 + 2 * t2 + 0.5 * t)
        .addScaledVector(d, 0.5 * t3 - 0.5 * t2);
      out.push(v.x, v.y, v.z);
    }
  }
  const last = points[points.length - 1];
  out.push(last.x, last.y, last.z);
  return out;
}

/** Club, ball, ball tracer and glowing club-head trail for one figure; `fan` adds the stroboscopic shafts. */
function createSwingProps(
  club: number[][],
  ball: number[],
  target: THREE.Vector3,
  up: THREE.Vector3,
  options: { fan?: boolean; impactIndex?: number } = {},
) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.0095, 1, 12),
    // Brand purple separates the club from both the black field and the pale body.
    // No environment map in this scene, so keep metalness low or it reads as black.
    new THREE.MeshStandardMaterial({ color: "#b99cff", roughness: 0.35, metalness: 0.1, emissive: "#4b2fa0" }),
  );
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshStandardMaterial({ color: "#c7b3ff", roughness: 0.3, metalness: 0.1, emissive: "#4b2fa0" }),
  );
  head.scale.set(0.05, 0.028, 0.04);
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.021, 20, 14),
    new THREE.MeshStandardMaterial({ color: "#f7f5f2", roughness: 0.45, emissive: "#55505c" }),
  );
  const tracer = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 }),
  );
  group.add(shaft, head, ballMesh, tracer);

  const heads = club.map((row) => new THREE.Vector3(row[3], row[4], row[5]));
  const grips = club.map((row) => new THREE.Vector3(row[0], row[1], row[2]));
  const trailGeometry = new LineGeometry();
  trailGeometry.setPositions(catmullRom(heads, TRAIL_SUBSTEPS));
  const core = new LineMaterial({ color: TRAIL_COLOR, linewidth: 2.6, transparent: true, opacity: 0.95 });
  const glow = new LineMaterial({
    color: TRAIL_COLOR,
    linewidth: 10,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const trailGlow = new Line2(trailGeometry, glow);
  const trail = new Line2(trailGeometry, core);
  trailGlow.frustumCulled = false;
  trail.frustumCulled = false;
  group.add(trailGlow, trail);

  // One faint shaft per captured frame: the swing read as a single long exposure.
  let fan: THREE.LineSegments | null = null;
  let fanMaterial: THREE.LineBasicMaterial | null = null;
  if (options.fan) {
    const positions = new Float32Array(club.length * 6);
    const colors = new Float32Array(club.length * 6);
    const impact = options.impactIndex ?? club.length;
    club.forEach((row, index) => {
      positions.set(row, index * 6);
      const weight = 0.3 + 0.7 * Math.exp(-0.5 * ((index - impact) / 9) ** 2);
      for (let k = 0; k < 2; k += 1) {
        colors[index * 6 + k * 3] = 0.78 * weight;
        colors[index * 6 + k * 3 + 1] = 0.7 * weight;
        colors[index * 6 + k * 3 + 2] = 1.0 * weight;
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    fanMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    fan = new THREE.LineSegments(geometry, fanMaterial);
    fan.frustumCulled = false;
    group.add(fan);
  }

  const ballRest = new THREE.Vector3(...(ball as [number, number, number]));
  const flightPos = new THREE.Vector3();
  const grip = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  return {
    group,
    materials: [core, glow],
    fanMaterial,
    dispose() {
      trailGeometry.dispose();
      fan?.geometry.dispose();
      fanMaterial?.dispose();
    },
    update(frame: number, impactIndex: number, fps: number) {
      const i = Math.min(Math.floor(frame), club.length - 1);
      const j = Math.min(i + 1, club.length - 1);
      const a = frame - i;
      grip.lerpVectors(grips[i], grips[j], a);
      tip.lerpVectors(heads[i], heads[j], a);
      axis.subVectors(tip, grip);
      const length = axis.length();
      axis.normalize();
      shaft.position.copy(grip).addScaledVector(axis, length / 2);
      shaft.quaternion.setFromUnitVectors(yAxis, axis);
      shaft.scale.set(1, length, 1);
      head.position.copy(tip);
      head.quaternion.copy(shaft.quaternion);

      trailGeometry.instanceCount = Math.max(0, Math.round(frame * TRAIL_SUBSTEPS));
      fan?.geometry.setDrawRange(0, (i + 1) * 2);

      // Illustrative ball flight after impact: launches toward the target, then leaves frame.
      const flight = (frame - impactIndex) / fps;
      if (flight > 0) {
        const pos = flightPos.copy(ballRest).addScaledVector(target, flight * 38).addScaledVector(up, flight * 9 - 4.9 * flight * flight);
        ballMesh.position.copy(pos);
        ballMesh.visible = flight < 0.5;
        (tracer.geometry as THREE.BufferGeometry).setFromPoints([ballRest, pos]);
        tracer.visible = flight < 0.9;
        (tracer.material as THREE.LineBasicMaterial).opacity = 0.55 * Math.max(0, 1 - flight / 0.9);
      } else {
        ballMesh.position.copy(ballRest);
        ballMesh.visible = true;
        tracer.visible = false;
      }
    },
  };
}

function addAnatomyLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight("#d8d2ff", "#0b0a0f", 1.25));
  const key = new THREE.DirectionalLight("#ffffff", 2.1);
  key.position.set(-2.6, -2.2, 4.2);
  const rim = new THREE.DirectionalLight("#a98bff", 1.3);
  rim.position.set(2.8, 2.4, 2.6);
  scene.add(key, rim);
}

/** A quiet floor: one disc, one ring. No grid. */
function addFloor(scene: THREE.Scene, radius: number) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 96),
    new THREE.MeshBasicMaterial({ color: "#09080d", transparent: true, opacity: 0.7 }),
  );
  disc.position.z = -0.002;
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 128 }, (_, i) => {
        const angle = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      }),
    ),
    new THREE.LineBasicMaterial({ color: "#2a2533", transparent: true, opacity: 0.9 }),
  );
  scene.add(disc, ring);
}

function holdFrameOf(note: SwingAnnotation) {
  return note.hold ?? Math.round((note.start + note.end) / 2);
}

function tracePath(trace: SwingSeries) {
  const low = Math.min(...trace.values);
  const high = Math.max(...trace.values);
  const span = high - low || 1;
  // Leave a little air above and below the trace inside the 0–100 box.
  const y = (value: number) => 90 - ((value - low) / span) * 80;
  const d = trace.values.map((value, index) => `${index ? "L" : "M"}${index} ${y(value).toFixed(2)}`).join(" ");
  return { d, y, zero: low < 0 && high > 0 ? y(0) : null };
}

function formatReading(trace: SwingSeries, frame: number) {
  const i = Math.min(Math.floor(frame), trace.values.length - 1);
  const j = Math.min(i + 1, trace.values.length - 1);
  const value = Math.round(trace.values[i] + (trace.values[j] - trace.values[i]) * (frame - i));
  // A signed reading for quantities that move both ways around their starting point.
  if (trace.values.some((v) => v < -0.5) && value > 0) return `+${value}`;
  return String(value).replace("-", "−");
}

// Selection moves like a physical thumb: quick, with one small settle.
const thumbSpring = { type: "spring", stiffness: 460, damping: 32, mass: 0.8 } as const;

/**
 * The headline number rolls to its value when the finding appears. A range such as
 * "17° → 5°" rolls from its first number to its last, the way the joint itself moved.
 */
function RollingValue({ text, active, still }: { text: string; active: boolean; still: boolean }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parts = text.split(/(\d+)/);
    const numberSlots = parts.map((part, index) => (/^\d+$/.test(part) ? index : -1)).filter((index) => index >= 0);
    const slot = numberSlots[numberSlots.length - 1];
    if (!active || still || slot === undefined) {
      el.textContent = text;
      return;
    }
    const goal = Number(parts[slot]);
    const origin = numberSlots.length > 1 ? Number(parts[numberSlots[numberSlots.length - 2]]) : 0;
    const startedAt = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt - 180) / 900);
      const eased = t <= 0 ? 0 : 1 - (1 - t) ** 4;
      const shown = [...parts];
      shown[slot] = String(Math.round(origin + (goal - origin) * eased));
      el.textContent = shown.join("");
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, active, still]);

  return <strong className="golf-caption__value" ref={ref}>{text}</strong>;
}

export function GolfSwingAnalysis({ dataUrl, active = true }: GolfSwingAnalysisProps) {
  const layoutId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const readingRefs = useRef(new Map<string, HTMLOutputElement>());
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef<Speed>("auto");
  const activeRef = useRef(active);
  const scrubRef = useRef<HTMLInputElement>(null);
  const focusGroupRef = useRef<string | null>(null);
  // Bumped whenever the viewer moves the playhead, so the director re-reads which findings are still ahead.
  const seekRef = useRef(0);
  const reduceMotion = Boolean(useReducedMotion());

  const [bundle, setBundle] = useState<SwingAnalysisBundle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("auto");
  const [phaseId, setPhaseId] = useState("address");
  const [activeAnnotations, setActiveAnnotations] = useState<string[]>([]);
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  // Which finding's coaching notes are unfolded. It follows the replay until the viewer picks one.
  // `undefined` means nothing has been chosen yet, so the first finding is shown; `null` means all folded.
  const [openNote, setOpenNote] = useState<string | null | undefined>(undefined);
  const [followedNote, setFollowedNote] = useState<string | null>(null);
  const liveNote = activeAnnotations[0] ?? null;
  if (liveNote !== followedNote) {
    setFollowedNote(liveNote);
    if (liveNote) setOpenNote(liveNote);
  }

  // The render loop reads these through refs so it never restarts on UI changes.
  useEffect(() => {
    activeRef.current = active;
    speedRef.current = speed;
    playingRef.current = playing;
    focusGroupRef.current = focusGroup;
  }, [active, speed, playing, focusGroup]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const controller = new AbortController();
    let disposed = false;
    let raf = 0;
    let visible = true;
    setStatus("loading");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setScissorTest(true);
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.prepend(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -5.1, 1.7);
    // The close-up shares the main camera's direction, so one drag turns both views.
    const detailCamera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
    detailCamera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    // Aim at the middle of the club arc, not the body, so no floor is wasted below the feet.
    controls.target.set(0, 0, 1.26);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.autoRotate = !reduceMotion;

    const surfaceScene = new THREE.Scene();
    surfaceScene.background = new THREE.Color("#050505");
    surfaceScene.add(new THREE.HemisphereLight("#e6e0ff", "#0b0a0f", 1.6));
    addFloor(surfaceScene, 2.1);
    const skeletonScene = new THREE.Scene();
    skeletonScene.background = new THREE.Color("#07060a");
    addAnatomyLights(skeletonScene);
    addFloor(skeletonScene, 1.5);

    let tick: ((now: number) => void) | null = null;
    let cleanupScene = () => {};
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    observer.observe(host);

    loadSwing(dataUrl, controller.signal)
      .then(({ bundle: data, vertices, faces, bones }) => {
        if (disposed) return;
        const count = data.frameCount;
        const vertexStride = data.surface.vertexCount * 3;
        const compact = host.clientWidth < STACK_BREAKPOINT;

        // ---------------------------------------------------------------- surface figure
        const surfaceRig = new THREE.Group();
        let cx = 0;
        let cy = 0;
        for (let v = 0; v < data.surface.vertexCount; v += 1) {
          cx += vertices[v * 3];
          cy += vertices[v * 3 + 1];
        }
        cx /= data.surface.vertexCount;
        cy /= data.surface.vertexCount;
        surfaceRig.position.set(-cx, -cy, -data.surface.ground);

        const pose = vertices.slice(0, vertexStride);
        const shellGeometry = new THREE.BufferGeometry();
        const shellPositions = new THREE.BufferAttribute(pose, 3);
        shellGeometry.setAttribute("position", shellPositions);
        shellGeometry.setIndex(new THREE.BufferAttribute(faces, 1));
        const shellMaterial = createShellMaterial();
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        shell.frustumCulled = false;
        surfaceRig.add(shell);

        // The live body: the same silver particle surface as the Hero, now driven by a real capture.
        const bodyCount = compact ? BODY_SAMPLES / 2 : BODY_SAMPLES;
        const sampler = createSurfaceSampler(pose, faces, bodyCount);
        const bodyGeometry = new THREE.BufferGeometry();
        const bodyPositions = new THREE.BufferAttribute(new Float32Array(bodyCount * 3), 3);
        const bodyNormals = new THREE.BufferAttribute(new Float32Array(bodyCount * 3), 3);
        bodyGeometry.setAttribute("position", bodyPositions);
        bodyGeometry.setAttribute("normal", bodyNormals);
        bodyGeometry.setAttribute("aSeed", new THREE.BufferAttribute(sampler.seeds, 1));
        const bodyMaterial = createParticleMaterial("#f2f1f7", compact ? 10 : 9, THREE.NormalBlending);
        const bodyPoints = new THREE.Points(bodyGeometry, bodyMaterial);
        bodyPoints.frustumCulled = false;
        surfaceRig.add(bodyPoints);

        // Earlier poses stay behind as exposures: address, top of the backswing, impact.
        const topPhase = data.phases.find((phase) => phase.id === "top");
        const ghostFrames = [
          0,
          topPhase ? Math.round((topPhase.start + topPhase.end) / 2) : Math.round(data.impactIndex * 0.8),
          data.impactIndex,
        ];
        const ghostCount = Math.min(compact ? GHOST_SAMPLES / 2 : GHOST_SAMPLES, bodyCount);
        const ghosts = ghostFrames.map((frame) => {
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(ghostCount * 3);
          const normals = new Float32Array(ghostCount * 3);
          sampler.write(vertices.subarray(frame * vertexStride, (frame + 1) * vertexStride), positions, normals, ghostCount);
          geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
          geometry.setAttribute("aSeed", new THREE.BufferAttribute(sampler.seeds.subarray(0, ghostCount), 1));
          const material = createParticleMaterial("#b9a6ff", compact ? 8 : 7, THREE.AdditiveBlending);
          material.uniforms.uOpacity.value = 0;
          const points = new THREE.Points(geometry, material);
          points.frustumCulled = false;
          points.renderOrder = -1;
          surfaceRig.add(points);
          return { frame, geometry, material, opacity: 0 };
        });

        const surfaceProps = createSwingProps(
          data.surface.club,
          data.surface.ball,
          new THREE.Vector3(...data.surface.target),
          new THREE.Vector3(0, 0, 1),
          { fan: true, impactIndex: data.impactIndex },
        );
        surfaceRig.add(surfaceProps.group);
        surfaceScene.add(surfaceRig);

        // ---------------------------------------------------------------- skeleton figure
        const skeletonRig = new THREE.Group();
        const opensim = new THREE.Group();
        const axes = data.skeleton.toSurfaceAxes;
        const s = data.skeleton.scaleToSurface;
        opensim.matrixAutoUpdate = false;
        opensim.matrix.set(
          axes[0][0] * s, axes[0][1] * s, axes[0][2] * s, 0,
          axes[1][0] * s, axes[1][1] * s, axes[1][2] * s, 0,
          axes[2][0] * s, axes[2][1] * s, axes[2][2] * s, 0,
          0, 0, 0, 1,
        );
        opensim.add(bones);
        const bodyNodes = data.skeleton.bodyNames.map((name) => bones.getObjectByName(name) ?? null);
        // One material per bone, so a finding can light the bones it is about and quiet the rest.
        const boneMaterials = bodyNodes.map((node) => {
          const material = new THREE.MeshStandardMaterial({
            color: BONE_COLOR,
            roughness: 0.6,
            metalness: 0.04,
            emissive: "#000000",
          });
          node?.traverse((child) => {
            if (child instanceof THREE.Mesh) child.material = material;
          });
          return material;
        });
        const boneBase = new THREE.Color(BONE_COLOR);
        const boneLevels = bodyNodes.map(() => 0);
        let boneQuiet = 0;

        const groupOfMuscle = data.skeleton.muscleNames.map(
          (name) => data.muscleGroups.find((group) => group.muscles.includes(name)) ?? null,
        );
        // The muscle groups behind the findings are drawn as volumes; every other muscle stays a faint line.
        const volumes = data.muscleGroups.map((group) => {
          const members = groupOfMuscle.flatMap((owner, m) => (owner === group ? [m] : []));
          const counts = members.map((m) => data.skeleton.muscles[0][m].length);
          const volume = createMuscleVolume(group.color, counts);
          opensim.add(volume.group);
          return { id: group.id, members, paths: counts.map((n) => new Float32Array(n * 3)), volume };
        });

        const muscleLayout = data.skeleton.muscles[0].map((points, m) => (groupOfMuscle[m] ? 1 : points.length));
        const segmentCount = muscleLayout.reduce((sum, n) => sum + n - 1, 0);
        const musclePositions = new Float32Array(segmentCount * 6);
        const muscleColors = new Float32Array(segmentCount * 6);
        const muscleGeometry = new THREE.BufferGeometry();
        muscleGeometry.setAttribute("position", new THREE.BufferAttribute(musclePositions, 3));
        muscleGeometry.setAttribute("color", new THREE.BufferAttribute(muscleColors, 3));
        const muscles = new THREE.LineSegments(
          muscleGeometry,
          new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false }),
        );
        muscles.renderOrder = 2;
        muscles.frustumCulled = false;
        opensim.add(muscles);
        const baseMuscle = new THREE.Color("#3b3148");
        for (let o = 0; o < muscleColors.length; o += 3) baseMuscle.toArray(muscleColors, o);

        const skeletonProps = createSwingProps(
          data.skeleton.club,
          data.skeleton.ball,
          new THREE.Vector3(...data.skeleton.target),
          new THREE.Vector3(...data.skeleton.up),
        );
        opensim.add(skeletonProps.group);

        // Where the pelvis stood at address: the reference the hip findings are measured against.
        const pelvisIndex = data.skeleton.bodyNames.indexOf("pelvis");
        const pelvisStart = new THREE.Vector3(
          ...(data.skeleton.frames[0].slice(pelvisIndex * 7, pelvisIndex * 7 + 3) as [number, number, number]),
        );
        const skeletonUp = new THREE.Vector3(...data.skeleton.up);
        const plumbGeometry = new THREE.BufferGeometry().setFromPoints([
          pelvisStart.clone().addScaledVector(skeletonUp, data.skeleton.ground - pelvisStart.dot(skeletonUp)),
          pelvisStart.clone().addScaledVector(skeletonUp, 0.34),
        ]);
        const plumbMaterial = new THREE.LineDashedMaterial({
          color: "#f4f0fa",
          dashSize: 0.03,
          gapSize: 0.022,
          transparent: true,
          opacity: 0,
          depthTest: false,
        });
        const plumb = new THREE.Line(plumbGeometry, plumbMaterial);
        plumb.computeLineDistances();
        plumb.renderOrder = 3;
        opensim.add(plumb);

        skeletonRig.add(opensim);
        const pelvis = pelvisStart.clone().applyMatrix4(opensim.matrix);
        skeletonRig.position.set(-pelvis.x, -pelvis.y, -data.skeleton.ground * s);
        skeletonScene.add(skeletonRig);
        const jointGlow = createJointGlow();
        skeletonScene.add(jointGlow.sprite);

        const heroLines = surfaceProps.materials;
        const detailLines = skeletonProps.materials;

        // Face-on view: in front of the golfer, slightly toward the trail side.
        const forward = new THREE.Vector3(...data.surface.forward);
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 0, 1));
        camera.position
          .copy(controls.target)
          .addScaledVector(forward, 5.1)
          .addScaledVector(right, 1.5)
          .setZ(controls.target.z + 0.3);
        const qa = new THREE.Quaternion();
        const qb = new THREE.Quaternion();
        const anchor = new THREE.Vector3();
        const viewDirection = new THREE.Vector3();
        const detailTarget = new THREE.Vector3(0, 0, 0.95);
        const detailGoal = new THREE.Vector3();
        let detailDistance = 3.9;
        let detailYaw = 0;
        const annotationNodes = data.annotations.map((note) => bones.getObjectByName(note.anchor) ?? null);
        const noteBones = data.annotations.map((note) => new Set(note.bones ?? [note.anchor]));
        const noteAccents = data.annotations.map(
          (note) => new THREE.Color(data.muscleGroups.find((group) => group.id === note.group)?.color ?? DEFAULT_ACCENT),
        );
        const accent = new THREE.Color(DEFAULT_ACCENT);
        const pelvisNode = bones.getObjectByName("pelvis") ?? null;
        const holds = data.annotations.map((note) => ({ id: note.id, frame: holdFrameOf(note) }));
        const visited = new Set<string>();
        let seenSeek = seekRef.current;
        let holdLeft = 0;
        let holdTotal = 1;
        let endHold = 0;
        let lastPhase = "";
        let lastAnnotations = "";
        let lastReadingFrame = -1;
        let currentNote = -1;

        const layout = () => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          renderer.setSize(width, height, false);
          const stacked = width < STACK_BREAKPOINT;
          // GL boxes are measured from the bottom-left corner of the canvas.
          const heroW = stacked ? width : Math.round(width * HERO_SHARE_WIDE);
          const heroH = stacked ? Math.round(height * HERO_SHARE_STACKED) : height;
          const hero: [number, number, number, number] = stacked ? [0, height - heroH, heroW, heroH] : [0, 0, heroW, heroH];
          const detail: [number, number, number, number] = stacked ? [0, 0, width, height - heroH] : [heroW, 0, width - heroW, height];
          // Slide the figure off-centre so the caption card has clear ground: right on wide stages, up on stacked ones.
          if (stacked) camera.setViewOffset(hero[2], hero[3], 0, Math.round(hero[3] * 0.13), hero[2], hero[3]);
          else camera.setViewOffset(hero[2], hero[3], -Math.round(hero[2] * 0.08), 0, hero[2], hero[3]);
          detailCamera.aspect = detail[2] / detail[3];
          detailCamera.updateProjectionMatrix();
          // Wide stages fit the full club arc (about ±1.75 m wide, 2.9 m tall). Phones keep the body
          // legible instead and let the far edges of the arc leave the frame.
          const fitDistance = stacked ? Math.max(4.9, 4.4 / camera.aspect) : Math.max(4.9, 6.1 / camera.aspect);
          camera.position.sub(controls.target).setLength(fitDistance).add(controls.target);
          heroLines.forEach((material) => material.resolution.set(hero[2], hero[3]));
          detailLines.forEach((material) => material.resolution.set(detail[2], detail[3]));
          return { width, height, stacked, hero, detail };
        };
        let view = layout();
        const resizeObserver = new ResizeObserver(() => {
          view = layout();
        });
        resizeObserver.observe(host);

        const particleScale = () => renderer.getPixelRatio() * (view.hero[3] / 620);

        const applyFrame = (frame: number) => {
          const i = Math.min(Math.floor(frame), count - 1);
          const j = Math.min(i + 1, count - 1);
          const a = frame - i;
          const from = i * vertexStride;
          const to = j * vertexStride;
          for (let k = 0; k < vertexStride; k += 1) {
            pose[k] = vertices[from + k] + (vertices[to + k] - vertices[from + k]) * a;
          }
          shellPositions.needsUpdate = true;
          shellGeometry.computeVertexNormals();
          sampler.write(pose, bodyPositions.array as Float32Array, bodyNormals.array as Float32Array);
          bodyPositions.needsUpdate = true;
          bodyNormals.needsUpdate = true;

          const fa = data.skeleton.frames[i];
          const fb = data.skeleton.frames[j];
          bodyNodes.forEach((node, b) => {
            if (!node) return;
            const o = b * 7;
            node.position.set(
              fa[o] + (fb[o] - fa[o]) * a,
              fa[o + 1] + (fb[o + 1] - fa[o + 1]) * a,
              fa[o + 2] + (fb[o + 2] - fa[o + 2]) * a,
            );
            qa.set(fa[o + 3], fa[o + 4], fa[o + 5], fa[o + 6]);
            qb.set(fb[o + 3], fb[o + 4], fb[o + 5], fb[o + 6]);
            node.quaternion.slerpQuaternions(qa, qb, a);
          });

          const annotationsNow = data.annotations.filter((note) => frame >= note.start && frame <= note.end);
          const musclesA = data.skeleton.muscles[i];
          const musclesB = data.skeleton.muscles[j];
          let seg = 0;
          musclesA.forEach((pointsA, m) => {
            if (groupOfMuscle[m]) return;
            const pointsB = musclesB[m];
            for (let p = 0; p < pointsA.length - 1; p += 1) {
              for (let e = 0; e < 2; e += 1) {
                const pa = pointsA[p + e];
                const pb = pointsB[p + e];
                const o = seg * 6 + e * 3;
                musclePositions[o] = pa[0] + (pb[0] - pa[0]) * a;
                musclePositions[o + 1] = pa[1] + (pb[1] - pa[1]) * a;
                musclePositions[o + 2] = pa[2] + (pb[2] - pa[2]) * a;
              }
              seg += 1;
            }
          });
          muscleGeometry.attributes.position.needsUpdate = true;
          volumes.forEach(({ members, paths }) => {
            members.forEach((m, slot) => {
              const pointsA = musclesA[m];
              const pointsB = musclesB[m];
              const path = paths[slot];
              for (let p = 0; p < pointsA.length; p += 1) {
                for (let axis = 0; axis < 3; axis += 1) {
                  path[p * 3 + axis] = pointsA[p][axis] + (pointsB[p][axis] - pointsA[p][axis]) * a;
                }
              }
            });
          });

          surfaceProps.update(frame, data.impactIndex, data.fps);
          skeletonProps.update(frame, data.impactIndex, data.fps);

          const phase = data.phases.find((p) => frame >= p.start && frame < p.end + 1) ?? data.phases[data.phases.length - 1];
          if (phase.id !== lastPhase) {
            lastPhase = phase.id;
            setPhaseId(phase.id);
          }
          const ids = annotationsNow.map((note) => note.id).join(",");
          if (ids !== lastAnnotations) {
            lastAnnotations = ids;
            setActiveAnnotations(annotationsNow.map((note) => note.id));
          }
          currentNote = annotationsNow.length ? data.annotations.indexOf(annotationsNow[0]) : -1;
        };

        /** Exposures, close-up framing and the anchor marker all ease toward their targets. */
        const direct = (frame: number, dt: number, settled: boolean, elapsed: number) => {
          const ease = 1 - Math.exp(-dt * 5);
          ghosts.forEach((ghost) => {
            const shown = frame > ghost.frame + 3;
            const goal = shown ? (settled ? 0.95 : 0.5) : 0;
            ghost.opacity += (goal - ghost.opacity) * ease;
            ghost.material.uniforms.uOpacity.value = ghost.opacity;
            ghost.material.uniforms.uPixelRatio.value = particleScale();
          });
          bodyMaterial.uniforms.uPixelRatio.value = particleScale();
          if (surfaceProps.fanMaterial) {
            surfaceProps.fanMaterial.opacity += ((settled ? 0.5 : 0.26) - surfaceProps.fanMaterial.opacity) * ease;
          }

          // What is being called out: the finding on screen, or the muscle group picked in the plan.
          const focus = focusGroupRef.current;
          const note = currentNote >= 0 ? data.annotations[currentNote] : null;
          const litGroup = focus ?? note?.group ?? null;
          const pulse = reduceMotion ? 0 : 0.5 + 0.5 * Math.sin(elapsed * 3.2);
          volumes.forEach(({ id, paths, volume }) => volume.update(paths, litGroup === id ? 1 : 0, ease, pulse));

          const litBones = note ? noteBones[currentNote] : null;
          if (note) accent.copy(noteAccents[currentNote]);
          boneQuiet += ((note ? 1 : 0) - boneQuiet) * ease;
          boneMaterials.forEach((material, b) => {
            boneLevels[b] += ((litBones?.has(data.skeleton.bodyNames[b]) ? 1 : 0) - boneLevels[b]) * ease;
            const level = boneLevels[b];
            // Bones outside the finding fall back; the ones it names take the finding's colour.
            material.color.copy(boneBase).multiplyScalar(1 - 0.58 * boneQuiet * (1 - level)).lerp(accent, 0.3 * level);
            material.emissive.copy(accent).multiplyScalar(level * (0.1 + 0.05 * pulse));
          });

          skeletonRig.updateMatrixWorld(true);
          const node = note ? annotationNodes[currentNote] : null;
          // With a muscle group picked and no finding on screen, the close-up goes to that group's finding angle.
          const focusNote = !note && focus ? data.annotations.find((item) => item.group === focus) ?? null : null;
          const close = Boolean(node || focusNote);
          if (node) node.getWorldPosition(detailGoal);
          else if (pelvisNode) {
            pelvisNode.getWorldPosition(detailGoal);
            if (!focusNote) detailGoal.setZ(0.95);
          }
          const slow = 1 - Math.exp(-dt * 3.2);
          detailTarget.lerp(detailGoal, slow);
          detailDistance += ((close ? 1.75 : 3.9) - detailDistance) * slow;
          detailYaw += (THREE.MathUtils.degToRad((note ?? focusNote)?.viewYaw ?? 0) - detailYaw) * slow;
          viewDirection.subVectors(camera.position, controls.target).normalize().applyAxisAngle(UP, detailYaw);
          detailCamera.position.copy(detailTarget).addScaledVector(viewDirection, detailDistance);
          detailCamera.lookAt(detailTarget);

          if (node) node.getWorldPosition(jointGlow.sprite.position);
          jointGlow.material.color.copy(accent);
          jointGlow.material.opacity += ((node ? 0.12 + 0.06 * pulse : 0) - jointGlow.material.opacity) * ease;

          const hipFinding = currentNote >= 0 && data.annotations[currentNote].anchor === "pelvis";
          plumbMaterial.opacity += ((hipFinding ? 0.75 : 0) - plumbMaterial.opacity) * ease;

          const marker = markerRef.current;
          if (marker) {
            if (node) {
              node.getWorldPosition(anchor).project(detailCamera);
              const [, , dw, dh] = view.detail;
              const left = view.stacked ? 0 : view.hero[2];
              const top = view.stacked ? view.hero[3] : 0;
              marker.style.transform = `translate3d(${(left + ((anchor.x + 1) / 2) * dw).toFixed(1)}px, ${(top + ((1 - anchor.y) / 2) * dh).toFixed(1)}px, 0)`;
            }
            marker.dataset.visible = node ? "true" : "false";
          }
        };

        /** The source footage is never played: it is stepped to whichever frame the replay is on. */
        const syncVideo = (frame: number) => {
          const video = videoRef.current;
          if (!video || video.readyState < 1 || video.seeking) return;
          const time = Math.min((Math.floor(frame) + 0.5) / data.fps, video.duration - 0.001);
          if (Math.abs(video.currentTime - time) > 0.004) video.currentTime = time;
        };

        const writeReadings = (frame: number) => {
          const deck = deckRef.current;
          if (deck) deck.style.setProperty("--playhead", `${((frame / (count - 1)) * 100).toFixed(2)}%`);
          captionRef.current?.style.setProperty("--hold", holdLeft > 0 ? (1 - holdLeft / holdTotal).toFixed(3) : "0");
          const step = Math.round(frame * 4);
          if (step === lastReadingFrame) return;
          lastReadingFrame = step;
          data.series?.forEach((trace) => {
            const output = readingRefs.current.get(trace.id);
            if (output) output.textContent = formatReading(trace, frame);
          });
        };

        const render = () => {
          renderer.setViewport(...view.hero);
          renderer.setScissor(...view.hero);
          renderer.render(surfaceScene, camera);
          renderer.setViewport(...view.detail);
          renderer.setScissor(...view.detail);
          renderer.render(skeletonScene, detailCamera);
          renderer.setViewport(0, 0, view.width, view.height);
        };

        let last = performance.now();
        let elapsed = 0;
        tick = (now: number) => {
          raf = requestAnimationFrame(tick!);
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (!visible || !activeRef.current) return;
          elapsed += dt;

          if (seenSeek !== seekRef.current) {
            // The viewer moved the playhead: findings behind it are done, the rest are still ahead.
            seenSeek = seekRef.current;
            visited.clear();
            holds.forEach((hold) => {
              if (hold.frame <= frameRef.current) visited.add(hold.id);
            });
            holdLeft = 0;
            endHold = 0;
          }

          const auto = speedRef.current === "auto";
          if (playingRef.current) {
            if (frameRef.current >= count - 1) {
              endHold += dt;
              if (endHold > (auto ? END_HOLD_SECONDS : MANUAL_END_HOLD_SECONDS)) {
                endHold = 0;
                frameRef.current = 0;
                visited.clear();
              }
            } else if (auto && holdLeft > 0) {
              holdLeft -= dt;
            } else {
              const rate = auto ? AUTO_RATE : (speedRef.current as number);
              let next = frameRef.current + dt * data.fps * rate;
              if (auto) {
                const due = holds.find((hold) => !visited.has(hold.id) && frameRef.current <= hold.frame && next >= hold.frame);
                if (due) {
                  next = due.frame;
                  visited.add(due.id);
                  holdLeft = FINDING_HOLD_SECONDS;
                  holdTotal = FINDING_HOLD_SECONDS;
                }
              }
              frameRef.current = Math.min(count - 1, next);
            }
            if (scrubRef.current) scrubRef.current.value = String(frameRef.current);
          }

          // A slow sway of the camera, never a full orbit.
          controls.autoRotateSpeed = 0.42 * Math.cos(elapsed * 0.3);
          controls.update();
          applyFrame(frameRef.current);
          direct(frameRef.current, dt, frameRef.current >= count - 1, elapsed);
          writeReadings(frameRef.current);
          syncVideo(frameRef.current);
          render();
        };

        frameRef.current = reduceMotion ? data.impactIndex : 0;
        if (scrubRef.current) scrubRef.current.value = String(frameRef.current);
        seekRef.current += 1;
        setBundle(data);
        setPlaying(!reduceMotion);
        setStatus("ready");
        raf = requestAnimationFrame(tick);

        cleanupScene = () => {
          resizeObserver.disconnect();
          shellGeometry.dispose();
          shellMaterial.dispose();
          bodyGeometry.dispose();
          bodyMaterial.dispose();
          ghosts.forEach((ghost) => {
            ghost.geometry.dispose();
            ghost.material.dispose();
          });
          muscleGeometry.dispose();
          plumbGeometry.dispose();
          plumbMaterial.dispose();
          boneMaterials.forEach((material) => material.dispose());
          volumes.forEach(({ volume }) => volume.dispose());
          jointGlow.dispose();
          surfaceProps.dispose();
          skeletonProps.dispose();
          [...heroLines, ...detailLines].forEach((material) => material.dispose());
        };
      })
      .catch(() => {
        if (!disposed && !controller.signal.aborted) setStatus("error");
      });

    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(raf);
      observer.disconnect();
      cleanupScene();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dataUrl, reduceMotion]);

  const togglePlay = () => setPlaying((value) => !value);
  const seek = (value: number, keepPlaying = false) => {
    frameRef.current = value;
    seekRef.current += 1;
    if (scrubRef.current) scrubRef.current.value = String(value);
    if (!keepPlaying) setPlaying(false);
  };

  const groupsById = new Map(bundle?.muscleGroups.map((group) => [group.id, group]) ?? []);
  const activeGroupIds = new Set(
    bundle?.annotations.filter((note) => activeAnnotations.includes(note.id)).map((note) => note.group) ?? [],
  );
  const accentOf = (note: SwingAnnotation) => (note.group ? groupsById.get(note.group)?.color : undefined) ?? DEFAULT_ACCENT;
  // The muscle group the close-up is lighting: the one picked in the plan, else the live finding's.
  const litGroup = groupsById.get(focusGroup ?? bundle?.annotations.find((note) => note.id === liveNote)?.group ?? "");
  const lastFrame = (bundle?.frameCount ?? 2) - 1;

  return (
    <div className="golf-swing">
      <div
        className="golf-swing__stage"
        ref={hostRef}
        role="img"
        aria-label="Golf swing replay. The player's phone video runs in step with a particle surface reconstruction that swings an estimated club and leaves its earlier poses behind as exposures; beside it, a close-up of the skeleton and muscles follows each finding."
      >
        <span className="golf-swing__badge">{bundle?.disclosure.badge ?? "Swing analysis"}</span>
        {bundle ? (
          <>
            <p className="golf-swing__label golf-swing__label--surface">{bundle.surface.label}</p>
            <p className="golf-swing__label golf-swing__label--skeleton">{bundle.skeleton.label}</p>
          </>
        ) : null}

        {bundle?.sourceVideo ? (
          // The real footage beside its reconstruction, stepped frame for frame by the replay.
          <figure className="golf-source" style={{ "--aspect": bundle.sourceVideo.aspect } as CSSProperties} aria-hidden="true">
            <video ref={videoRef} src={bundle.sourceVideo.url} muted playsInline preload="auto" disablePictureInPicture tabIndex={-1} />
            <figcaption>
              <span>{bundle.sourceVideo.label}</span>
              <small><i />In sync</small>
            </figcaption>
          </figure>
        ) : null}

        <i className="golf-swing__marker" ref={markerRef} aria-hidden="true" />
        <p
          className="golf-swing__muscle"
          data-visible={litGroup ? "true" : "false"}
          style={{ "--accent": litGroup?.color ?? DEFAULT_ACCENT } as CSSProperties}
          aria-hidden="true"
        >
          <i />
          <span>Strengthen</span>
          <strong key={litGroup?.id}>{litGroup?.label}</strong>
        </p>

        <div className="golf-caption" ref={captionRef} aria-hidden="true">
          {bundle?.annotations.map((note) => (
            <article
              key={note.id}
              className={activeAnnotations.includes(note.id) ? "is-active" : undefined}
              style={{ "--accent": accentOf(note) } as CSSProperties}
            >
              {note.metric ? (
                <>
                  <RollingValue text={note.metric.value} active={activeAnnotations.includes(note.id)} still={reduceMotion} />
                  <span className="golf-caption__metric">{note.metric.caption}</span>
                </>
              ) : null}
              <h3>{note.title}</h3>
              {/* Lead with the fix; the full reasoning is in the plan under the timeline. */}
              {note.cue ? <p className="golf-caption__cue"><b>Fix</b>{note.cue}</p> : <p>{note.detail}</p>}
              <span className="golf-caption__hold"><i /></span>
            </article>
          ))}
        </div>

        {bundle?.annotations.length ? (
          <LayoutGroup id={`${layoutId}-steps`}>
            <nav className="golf-steps" aria-label="Findings">
              {bundle.annotations.map((note, index) => {
                const current = activeAnnotations.includes(note.id);
                return (
                  <button
                    key={note.id}
                    type="button"
                    className={current ? "is-active" : undefined}
                    aria-current={current ? "step" : undefined}
                    aria-label={`Finding ${index + 1}: ${note.title}`}
                    style={{ "--accent": accentOf(note) } as CSSProperties}
                    onClick={() => seek(holdFrameOf(note))}
                  >
                    {current ? <motion.i className="golf-steps__pill" layoutId="pill" transition={thumbSpring} aria-hidden="true" /> : null}
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </button>
                );
              })}
            </nav>
          </LayoutGroup>
        ) : null}

        {status !== "ready" ? (
          <div className="golf-swing__status" role="status">
            {status === "loading" ? <CircleNotch className="golf-swing__spinner" aria-hidden="true" /> : null}
            {status === "loading" ? "Loading swing analysis" : "Swing analysis could not be loaded."}
          </div>
        ) : null}
      </div>

      {bundle ? (
        <div className="golf-swing__console">
          {/* On stacked layouts the caption card stays short; the fix reads here instead. */}
          <p className="golf-swing__reading" aria-hidden="true">
            {(() => {
              const live = bundle.annotations.find((note) => note.id === liveNote);
              if (!live) return "Four findings, each read from the measured traces below.";
              return live.cue ? <><b>Fix</b>{live.cue}</> : live.detail;
            })()}
          </p>
          <div className="golf-deck" ref={deckRef}>
            <div className="golf-deck__controls">
              <button type="button" className="golf-deck__play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause weight="fill" aria-hidden="true" /> : <Play weight="fill" aria-hidden="true" />}
              </button>
              <LayoutGroup id={`${layoutId}-speed`}>
                <div className="golf-swing__speed" role="group" aria-label="Playback">
                  {SPEEDS.map((value) => (
                    <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)}>
                      {speed === value ? <motion.i className="golf-swing__speed-thumb" layoutId="thumb" transition={thumbSpring} aria-hidden="true" /> : null}
                      <span>{value === "auto" ? "Replay" : `${value}×`}</span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            </div>
            <div className="golf-swing__timeline">
              <input
                ref={scrubRef}
                type="range"
                min={0}
                max={lastFrame}
                step={0.01}
                defaultValue={0}
                onInput={(event) => seek(Number(event.currentTarget.value))}
                aria-label="Swing frame"
              />
              <ol className="golf-swing__phases">
                {bundle.phases.map((phase) => (
                  <li
                    key={phase.id}
                    className={[
                      phase.id === phaseId ? "is-active" : "",
                      phase.end - phase.start < 2 ? "is-brief" : "",
                    ].filter(Boolean).join(" ") || undefined}
                    style={{ flexGrow: phase.end - phase.start + 1 }}
                  >
                    {phase.label}
                  </li>
                ))}
              </ol>
            </div>

            {bundle.series?.map((trace) => {
              const { d, y, zero } = tracePath(trace);
              const findings = bundle.annotations.filter((note) => note.series === trace.id);
              return (
                <div className="golf-track" key={trace.id}>
                  <div className="golf-track__head">
                    <span>{trace.label}</span>
                    <p>
                      <output
                        ref={(el) => {
                          if (el) readingRefs.current.set(trace.id, el);
                          else readingRefs.current.delete(trace.id);
                        }}
                      >
                        {formatReading(trace, 0)}
                      </output>
                      <small>{trace.unit}</small>
                    </p>
                  </div>
                  <div className="golf-track__lane">
                    <svg viewBox={`0 0 ${lastFrame} 100`} preserveAspectRatio="none" aria-hidden="true">
                      {zero === null ? null : <line className="golf-track__zero" x1="0" x2={lastFrame} y1={zero} y2={zero} />}
                      <path d={d} />
                      {/* Where the trace should have stayed through each finding's window. */}
                      {findings.map((note) => (note.goal ? (
                        <line
                          key={note.id}
                          className="golf-track__goal"
                          style={{ "--accent": accentOf(note) } as CSSProperties}
                          x1={note.start}
                          x2={note.end}
                          y1={y(note.goal.value)}
                          y2={y(note.goal.value)}
                        />
                      ) : null))}
                    </svg>
                    {findings.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        className={activeAnnotations.includes(note.id) ? "is-active" : undefined}
                        style={{
                          "--accent": accentOf(note),
                          left: `${(note.start / lastFrame) * 100}%`,
                          width: `${((note.end - note.start) / lastFrame) * 100}%`,
                        } as CSSProperties}
                        onClick={() => seek(holdFrameOf(note))}
                        aria-label={`Go to finding: ${note.title}`}
                      />
                    ))}
                    <i className="golf-track__playhead" aria-hidden="true" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="golf-swing__insights">
            <section className="golf-plan" aria-label="What to work on">
              <h3>What to work on</h3>
              <ol>
                {bundle.annotations.map((note, index) => {
                  const open = openNote === undefined ? index === 0 : openNote === note.id;
                  const group = note.group ? groupsById.get(note.group) : undefined;
                  const panelId = `${layoutId}-plan-${note.id}`;
                  return (
                    <li
                      key={note.id}
                      className={[open ? "is-open" : "", liveNote === note.id ? "is-live" : ""].filter(Boolean).join(" ") || undefined}
                      style={{ "--accent": accentOf(note) } as CSSProperties}
                    >
                      <button
                        type="button"
                        className="golf-plan__head"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => {
                          if (open) {
                            setOpenNote(null);
                            return;
                          }
                          setOpenNote(note.id);
                          seek(holdFrameOf(note));
                        }}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{note.title}</strong>
                        {note.metric ? <em>{note.metric.value}</em> : null}
                        <CaretDown aria-hidden="true" />
                      </button>
                      <motion.div
                        id={panelId}
                        className="golf-plan__body"
                        initial={false}
                        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 34, mass: 0.9 }}
                        inert={!open}
                      >
                        <dl>
                          <div>
                            <dt>What we saw</dt>
                            <dd>{note.detail}</dd>
                          </div>
                          {note.why ? <div><dt>Why it matters</dt><dd>{note.why}</dd></div> : null}
                          {note.cue ? <div className="is-action"><dt>Feel</dt><dd>{note.cue}</dd></div> : null}
                          {note.drill ? <div className="is-action"><dt>Drill</dt><dd>{note.drill}</dd></div> : null}
                        </dl>
                        {note.check ? (
                          <p className="golf-plan__check"><span>Next capture</span>{note.check}</p>
                        ) : null}
                        {group ? (
                          <button
                            type="button"
                            className={`golf-plan__muscle${activeGroupIds.has(group.id) ? " is-live" : ""}`}
                            aria-pressed={focusGroup === group.id}
                            onClick={() => setFocusGroup((current) => (current === group.id ? null : group.id))}
                          >
                            <i aria-hidden="true" />
                            <span>Strengthen</span>
                            <strong>{group.label}</strong>
                            <small>{group.role}</small>
                          </button>
                        ) : null}
                      </motion.div>
                    </li>
                  );
                })}
              </ol>
            </section>
            <div className="golf-swing__legend">
              {bundle.highlights.length ? (
                <>
                  <h3>What you're doing well</h3>
                  <ul className="golf-swing__highlights">
                    {bundle.highlights.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </>
              ) : null}
              <p><i className="golf-swing__swatch golf-swing__swatch--trail" aria-hidden="true" />Estimated club-head path</p>
              <p className="golf-swing__disclosure">{bundle.disclosure.club}</p>
              <p className="golf-swing__disclosure">{bundle.disclosure.coaching}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
