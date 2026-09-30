import { CircleNotch } from "@phosphor-icons/react/CircleNotch";
import { Pause } from "@phosphor-icons/react/Pause";
import { Play } from "@phosphor-icons/react/Play";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { SwingAnalysisBundle } from "./types";
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

const TRAIL_COLOR = "#52e07c";
const TRAIL_SUBSTEPS = 6;
const HOLD_SECONDS = 1.4;
const SPEEDS = [0.25, 0.5, 1] as const;
const STACK_BREAKPOINT = 720;
const CALLOUT_WIDTH = 196;

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

/** Club, ball, ball tracer and glowing club-head trail for one figure. */
function createSwingProps(club: number[][], ball: number[], target: THREE.Vector3, up: THREE.Vector3) {
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
    new THREE.MeshStandardMaterial({ color: "#f7f5f2", roughness: 0.45 }),
  );
  const tracer = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 }),
  );
  group.add(shaft, head, ballMesh, tracer);

  const heads = club.map((row) => new THREE.Vector3(row[3], row[4], row[5]));
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

  const ballRest = new THREE.Vector3(...(ball as [number, number, number]));
  const grips = club.map((row) => new THREE.Vector3(row[0], row[1], row[2]));
  const flightPos = new THREE.Vector3();
  const grip = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  return {
    group,
    materials: [core, glow],
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

      const segments = Math.max(0, Math.round(frame * TRAIL_SUBSTEPS));
      trailGeometry.instanceCount = segments;

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

function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight("#d8d2ff", "#0b0a0f", 1.25));
  const key = new THREE.DirectionalLight("#ffffff", 2.1);
  key.position.set(-2.6, -2.2, 4.2);
  const rim = new THREE.DirectionalLight("#a98bff", 1.3);
  rim.position.set(2.8, 2.4, 2.6);
  scene.add(key, rim);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 64),
    new THREE.MeshBasicMaterial({ color: "#0d0c12", transparent: true, opacity: 0.9 }),
  );
  floor.position.z = -0.001;
  scene.add(floor);
  const rings = new THREE.PolarGridHelper(2.4, 8, 6, 64, "#27232f", "#1a1720");
  rings.rotation.x = Math.PI / 2;
  scene.add(rings);
}

export function GolfSwingAnalysis({ dataUrl, active = true }: GolfSwingAnalysisProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const calloutRefs = useRef(new Map<string, HTMLDivElement>());
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef<number>(0.5);
  const activeRef = useRef(active);
  const scrubRef = useRef<HTMLInputElement>(null);
  const focusGroupRef = useRef<string | null>(null);
  const reduceMotion = Boolean(useReducedMotion());

  const [bundle, setBundle] = useState<SwingAnalysisBundle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(0.5);
  const [phaseId, setPhaseId] = useState("address");
  const [activeAnnotations, setActiveAnnotations] = useState<string[]>([]);
  const [focusGroup, setFocusGroup] = useState<string | null>(null);

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
    let hold = 0;
    setStatus("loading");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setScissorTest(true);
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.prepend(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -5.1, 1.7);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 1.15);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.55;

    const surfaceScene = new THREE.Scene();
    const skeletonScene = new THREE.Scene();
    for (const scene of [surfaceScene, skeletonScene]) {
      scene.background = new THREE.Color("#060508");
      addLights(scene);
    }

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
        const geometry = new THREE.BufferGeometry();
        const positions = new THREE.BufferAttribute(vertices.slice(0, vertexStride), 3);
        geometry.setAttribute("position", positions);
        geometry.setIndex(new THREE.BufferAttribute(faces, 1));
        const body = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ color: "#d9d4df", roughness: 0.38, metalness: 0.18 }),
        );
        surfaceRig.add(body);
        const surfaceProps = createSwingProps(
          data.surface.club,
          data.surface.ball,
          new THREE.Vector3(...data.surface.target),
          new THREE.Vector3(0, 0, 1),
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
        const boneMaterial = new THREE.MeshStandardMaterial({ color: "#eee9dd", roughness: 0.6, metalness: 0.04 });
        bones.traverse((node) => {
          if (node instanceof THREE.Mesh) node.material = boneMaterial;
        });
        opensim.add(bones);
        const bodyNodes = data.skeleton.bodyNames.map((name) => bones.getObjectByName(name) ?? null);

        // Muscles as line segments with per-group colour.
        const muscleLayout = data.skeleton.muscles[0].map((points) => points.length);
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
        const groupOfMuscle = data.skeleton.muscleNames.map(
          (name) => data.muscleGroups.find((group) => group.muscles.includes(name)) ?? null,
        );

        const skeletonProps = createSwingProps(
          data.skeleton.club,
          data.skeleton.ball,
          new THREE.Vector3(...data.skeleton.target),
          new THREE.Vector3(...data.skeleton.up),
        );
        opensim.add(skeletonProps.group);
        skeletonRig.add(opensim);
        const pelvisIndex = data.skeleton.bodyNames.indexOf("pelvis");
        const pelvis = new THREE.Vector3(...data.skeleton.frames[0].slice(pelvisIndex * 7, pelvisIndex * 7 + 3) as [number, number, number]);
        pelvis.applyMatrix4(opensim.matrix);
        skeletonRig.position.set(-pelvis.x, -pelvis.y, -data.skeleton.ground * s);
        skeletonScene.add(skeletonRig);

        const lineMaterials = [...surfaceProps.materials, ...skeletonProps.materials];

        // Face-on view: in front of the golfer, slightly toward the trail side.
        const forward = new THREE.Vector3(...data.surface.forward);
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 0, 1));
        camera.position
          .copy(controls.target)
          .addScaledVector(forward, 5.1)
          .addScaledVector(right, 1.5)
          .setZ(controls.target.z + 0.55);
        const baseMuscle = new THREE.Color("#3b3148");
        const tint = new THREE.Color();
        const qa = new THREE.Quaternion();
        const qb = new THREE.Quaternion();
        const anchor = new THREE.Vector3();
        const annotationNodes = data.annotations.map((note) => bones.getObjectByName(note.anchor) ?? null);
        let lastPhase = "";
        let lastAnnotations = "";

        const layout = () => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          renderer.setSize(width, height, false);
          const stacked = width < STACK_BREAKPOINT;
          const vw = stacked ? width : width / 2;
          const vh = stacked ? height / 2 : height;
          camera.aspect = vw / vh;
          camera.updateProjectionMatrix();
          // Fit the full club arc (about ±1.75 m wide, 2.9 m tall) in narrow and wide viewports.
          const fitDistance = Math.max(4.9, 5.4 / camera.aspect);
          camera.position.sub(controls.target).setLength(fitDistance).add(controls.target);
          lineMaterials.forEach((material) => material.resolution.set(vw, vh));
          return { width, height, stacked, vw, vh };
        };
        let view = layout();
        const resizeObserver = new ResizeObserver(() => {
          view = layout();
        });
        resizeObserver.observe(host);

        const applyFrame = (frame: number) => {
          const i = Math.min(Math.floor(frame), count - 1);
          const j = Math.min(i + 1, count - 1);
          const a = frame - i;
          const target = positions.array as Float32Array;
          const from = i * vertexStride;
          const to = j * vertexStride;
          for (let k = 0; k < vertexStride; k += 1) {
            target[k] = vertices[from + k] + (vertices[to + k] - vertices[from + k]) * a;
          }
          positions.needsUpdate = true;
          geometry.computeVertexNormals();

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
          const activeGroups = new Set(annotationsNow.map((note) => note.group).filter(Boolean));
          const focus = focusGroupRef.current;
          let seg = 0;
          data.skeleton.muscles[i].forEach((pointsA, m) => {
            const pointsB = data.skeleton.muscles[j][m];
            const group = groupOfMuscle[m];
            const lit = group && (focus ? focus === group.id : activeGroups.has(group.id));
            if (group) tint.set(group.color).multiplyScalar(lit ? 1 : 0.42);
            else tint.copy(baseMuscle);
            for (let p = 0; p < pointsA.length - 1; p += 1) {
              for (let e = 0; e < 2; e += 1) {
                const pa = pointsA[p + e];
                const pb = pointsB[p + e];
                const o = seg * 6 + e * 3;
                musclePositions[o] = pa[0] + (pb[0] - pa[0]) * a;
                musclePositions[o + 1] = pa[1] + (pb[1] - pa[1]) * a;
                musclePositions[o + 2] = pa[2] + (pb[2] - pa[2]) * a;
                muscleColors[o] = tint.r;
                muscleColors[o + 1] = tint.g;
                muscleColors[o + 2] = tint.b;
              }
              seg += 1;
            }
          });
          muscleGeometry.attributes.position.needsUpdate = true;
          muscleGeometry.attributes.color.needsUpdate = true;

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
        };

        const placeCallouts = () => {
          skeletonRig.updateMatrixWorld(true);
          const offsetX = view.stacked ? 0 : view.vw;
          const offsetY = view.stacked ? view.vh : 0;
          data.annotations.forEach((note, n) => {
            const el = calloutRefs.current.get(note.id);
            const node = annotationNodes[n];
            if (!el || !node) return;
            node.getWorldPosition(anchor);
            anchor.project(camera);
            const x = offsetX + ((anchor.x + 1) / 2) * view.vw;
            const y = offsetY + ((1 - anchor.y) / 2) * view.vh;
            el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
            // Keep the card inside the stage: beside the anchor on wide layouts, below it when stacked.
            const card = el.lastElementChild as HTMLElement | null;
            if (!card) return;
            const cardWidth = card.offsetWidth || CALLOUT_WIDTH;
            let left = view.stacked ? -cardWidth / 2 : 18;
            if (!view.stacked && x + left + cardWidth > view.width - 8) left = -18 - cardWidth;
            left = Math.min(left, view.width - 8 - x - cardWidth);
            left = Math.max(left, 8 - x);
            card.style.left = `${left.toFixed(1)}px`;
            card.style.top = view.stacked ? "16px" : "-12px";
          });
        };

        const render = () => {
          const { width, height, stacked, vw, vh } = view;
          const surfaceBox = stacked ? [0, vh, vw, vh] : [0, 0, vw, vh];
          const skeletonBox = stacked ? [0, 0, vw, vh] : [vw, 0, vw, vh];
          renderer.setViewport(...(surfaceBox as [number, number, number, number]));
          renderer.setScissor(...(surfaceBox as [number, number, number, number]));
          renderer.render(surfaceScene, camera);
          renderer.setViewport(...(skeletonBox as [number, number, number, number]));
          renderer.setScissor(...(skeletonBox as [number, number, number, number]));
          renderer.render(skeletonScene, camera);
          renderer.setViewport(0, 0, width, height);
        };

        let last = performance.now();
        tick = (now: number) => {
          raf = requestAnimationFrame(tick!);
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (!visible || !activeRef.current) return;
          if (playingRef.current) {
            if (frameRef.current >= count - 1) {
              hold += dt;
              if (hold > HOLD_SECONDS) {
                hold = 0;
                frameRef.current = 0;
              }
            } else {
              frameRef.current = Math.min(count - 1, frameRef.current + dt * data.fps * speedRef.current);
            }
            if (scrubRef.current) scrubRef.current.value = String(frameRef.current);
          }
          controls.update();
          applyFrame(frameRef.current);
          render();
          placeCallouts();
        };

        frameRef.current = reduceMotion ? data.impactIndex : 0;
        if (scrubRef.current) scrubRef.current.value = String(frameRef.current);
        setBundle(data);
        setPlaying(!reduceMotion);
        setStatus("ready");
        raf = requestAnimationFrame(tick);

        cleanupScene = () => {
          resizeObserver.disconnect();
          geometry.dispose();
          muscleGeometry.dispose();
          boneMaterial.dispose();
          lineMaterials.forEach((material) => material.dispose());
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
  const scrub = (value: number) => {
    frameRef.current = value;
    setPlaying(false);
  };

  const groupsById = new Map(bundle?.muscleGroups.map((group) => [group.id, group]) ?? []);
  const activeGroupIds = new Set(
    bundle?.annotations.filter((note) => activeAnnotations.includes(note.id)).map((note) => note.group) ?? [],
  );

  return (
    <div className="golf-swing">
      <div className="golf-swing__stage" ref={hostRef} role="img" aria-label="Golf swing replay: GENMO surface reconstruction beside the OpenSim skeleton, each holding an estimated club with a green club-head path.">
        <span className="golf-swing__badge">{bundle?.disclosure.badge ?? "Swing analysis"}</span>
        {bundle ? (
          <>
            <p className="golf-swing__label golf-swing__label--surface">{bundle.surface.label}</p>
            <p className="golf-swing__label golf-swing__label--skeleton">{bundle.skeleton.label}</p>
          </>
        ) : null}
        {bundle?.annotations.map((note) => {
          const group = note.group ? groupsById.get(note.group) : undefined;
          return (
            <div
              key={note.id}
              className={`golf-callout${activeAnnotations.includes(note.id) ? " is-active" : ""}`}
              ref={(el) => {
                if (el) calloutRefs.current.set(note.id, el);
                else calloutRefs.current.delete(note.id);
              }}
              style={{ "--callout-color": group?.color ?? "#b99bff" } as CSSProperties}
              aria-hidden={!activeAnnotations.includes(note.id)}
            >
              <i aria-hidden="true" />
              <div>
                <strong>{note.title}</strong>
                <p>{note.detail}</p>
              </div>
            </div>
          );
        })}
        {status !== "ready" ? (
          <div className="golf-swing__status" role="status">
            {status === "loading" ? <CircleNotch className="golf-swing__spinner" aria-hidden="true" /> : null}
            {status === "loading" ? "Loading swing analysis" : "Swing analysis could not be loaded."}
          </div>
        ) : null}
      </div>

      {bundle ? (
        <div className="golf-swing__console">
          <div className="golf-swing__transport">
            <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause weight="fill" aria-hidden="true" /> : <Play weight="fill" aria-hidden="true" />}
            </button>
            <div className="golf-swing__timeline">
              <input
                ref={scrubRef}
                type="range"
                min={0}
                max={bundle.frameCount - 1}
                step={0.01}
                defaultValue={0}
                onInput={(event) => scrub(Number(event.currentTarget.value))}
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
            <div className="golf-swing__speed" role="group" aria-label="Playback speed">
              {SPEEDS.map((value) => (
                <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)}>
                  {value}×
                </button>
              ))}
            </div>
          </div>

          <div className="golf-swing__insights">
            <div>
              <h3>Muscle groups to train</h3>
              <ul className="golf-swing__groups">
                {bundle.muscleGroups.map((group) => (
                  <li key={group.id}>
                    <button
                      type="button"
                      aria-pressed={focusGroup === group.id}
                      className={activeGroupIds.has(group.id) ? "is-live" : ""}
                      style={{ "--group-color": group.color } as CSSProperties}
                      onClick={() => setFocusGroup((current) => (current === group.id ? null : group.id))}
                    >
                      <i aria-hidden="true" />
                      <strong>{group.label}</strong>
                      <span>{group.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="golf-swing__legend">
              {bundle.highlights.length ? (
                <>
                  <h3>What went well</h3>
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
