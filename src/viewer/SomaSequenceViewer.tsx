import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
import { CircleNotch } from "@phosphor-icons/react/CircleNotch";
import { Pause } from "@phosphor-icons/react/Pause";
import { Play } from "@phosphor-icons/react/Play";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createParticleMaterial, createShellMaterial, createSurfaceSampler } from "./particle-surface";
import type { MeshSequenceMetadata } from "./types";
import "./motion-stage.css";

interface LoadedSequence {
  metadata: MeshSequenceMetadata;
  faces: Uint32Array;
  vertices: Float32Array;
}

interface SomaSequenceViewerProps {
  metadataUrl: string;
  active?: boolean;
}

type SurfaceStyle = "particles" | "topology";

const STYLES: { id: SurfaceStyle; label: string }[] = [
  { id: "particles", label: "Particles" },
  { id: "topology", label: "Topology" },
];
const COMPACT_BREAKPOINT = 720;
const BODY_SAMPLES = 24_000;
const EXPOSURE_SAMPLES = 5_000;
// Above this net speed the subject is going somewhere, so the camera travels with it.
const TRAVEL_SPEED = 0.8;
const thumbSpring = { type: "spring", stiffness: 460, damping: 32, mass: 0.8 } as const;

function isMetadata(value: unknown): value is MeshSequenceMetadata {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MeshSequenceMetadata>;
  return (
    candidate.format === "cerebel-mesh-sequence-v1"
    && Number.isInteger(candidate.vertexCount)
    && Number.isInteger(candidate.triangleCount)
    && Number.isInteger(candidate.frameCount)
    && typeof candidate.fps === "number"
    && typeof candidate.verticesUrl === "string"
    && typeof candidate.facesUrl === "string"
  );
}

async function loadSequence(
  metadataUrl: string,
  signal: AbortSignal,
): Promise<LoadedSequence> {
  const metadataResponse = await fetch(metadataUrl, { signal });
  if (!metadataResponse.ok) throw new Error("Mesh metadata could not be loaded.");
  const metadataValue: unknown = await metadataResponse.json();
  if (!isMetadata(metadataValue)) throw new Error("Mesh manifest is not valid.");

  const [verticesResponse, facesResponse] = await Promise.all([
    fetch(metadataValue.verticesUrl, { signal }),
    fetch(metadataValue.facesUrl, { signal }),
  ]);
  if (!verticesResponse.ok || !facesResponse.ok) {
    throw new Error("Mesh sequence assets could not be loaded.");
  }

  const [verticesBuffer, facesBuffer] = await Promise.all([
    verticesResponse.arrayBuffer(),
    facesResponse.arrayBuffer(),
  ]);
  const vertices = new Float32Array(verticesBuffer);
  const faces = new Uint32Array(facesBuffer);
  const expectedVertices =
    metadataValue.frameCount * metadataValue.vertexCount * 3;
  const expectedIndices = metadataValue.triangleCount * 3;

  if (vertices.length !== expectedVertices || faces.length !== expectedIndices) {
    throw new Error("Mesh sequence dimensions do not match its manifest.");
  }

  return { metadata: metadataValue, vertices, faces };
}

/** Mean position of a pose, read from every 24th vertex: enough to follow the body cheaply. */
function centroidOf(pose: Float32Array, offset: number, vertexCount: number, out: THREE.Vector3) {
  let x = 0;
  let y = 0;
  let z = 0;
  let n = 0;
  for (let v = 0; v < vertexCount; v += 24) {
    const o = offset + v * 3;
    x += pose[o];
    y += pose[o + 1];
    z += pose[o + 2];
    n += 1;
  }
  return out.set(x / n, y / n, z / n);
}

export function SomaSequenceViewer({ metadataUrl, active = true }: SomaSequenceViewerProps) {
  const layoutId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLOutputElement>(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const activeRef = useRef(active);
  const trailRef = useRef(true);
  const styleRef = useRef<SurfaceStyle>("particles");
  const resetRef = useRef<() => void>(() => {});
  const reduceMotion = Boolean(useReducedMotion());
  const [metadata, setMetadata] = useState<MeshSequenceMetadata | null>(null);
  const [playing, setPlaying] = useState(false);
  const [trail, setTrail] = useState(true);
  const [style, setStyle] = useState<SurfaceStyle>("particles");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  // The render loop reads these through refs so it never restarts on UI changes.
  useEffect(() => {
    activeRef.current = active;
    playingRef.current = playing;
    trailRef.current = trail;
    styleRef.current = style;
  }, [active, playing, trail, style]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const controller = new AbortController();
    let disposed = false;
    let raf = 0;
    let visible = true;
    setStatus("loading");
    setError("");
    setPlaying(false);
    frameRef.current = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.Fog("#050505", 6, 15);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.prepend(renderer.domElement);

    // Wheel zoom is off on purpose: the page must keep scrolling when the pointer crosses the stage.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.56;

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      // Lift the picture so the floating control bar never sits on the subject's feet.
      const lift = width < COMPACT_BREAKPOINT ? 0.15 : 0.08;
      camera.setViewOffset(width, height, 0, Math.round(height * lift), width, height);
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    }, { threshold: 0.01 });
    observer.observe(host);

    let cleanupScene = () => {};

    loadSequence(metadataUrl, controller.signal)
      .then(({ metadata: data, vertices, faces }) => {
        if (disposed) return;
        const count = data.frameCount;
        const stride = data.vertexCount * 3;
        const compact = host.clientWidth < COMPACT_BREAKPOINT;

        const pose = vertices.slice(0, stride);
        const shellGeometry = new THREE.BufferGeometry();
        const shellPositions = new THREE.BufferAttribute(pose, 3);
        shellGeometry.setAttribute("position", shellPositions);
        shellGeometry.setIndex(new THREE.BufferAttribute(faces, 1));
        const shellMaterial = createShellMaterial();
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        shell.frustumCulled = false;
        // Topology view: the reconstructed mesh itself, drawn over the same shell.
        const wireMaterial = new THREE.MeshBasicMaterial({ color: "#b99bff", wireframe: true, transparent: true, opacity: 0.5 });
        const wire = new THREE.Mesh(shellGeometry, wireMaterial);
        wire.frustumCulled = false;
        wire.visible = false;
        scene.add(shell, wire);

        const bodyCount = compact ? BODY_SAMPLES / 2 : BODY_SAMPLES;
        const sampler = createSurfaceSampler(pose, faces, bodyCount);
        const bodyGeometry = new THREE.BufferGeometry();
        const bodyPositions = new THREE.BufferAttribute(new Float32Array(bodyCount * 3), 3);
        const bodyNormals = new THREE.BufferAttribute(new Float32Array(bodyCount * 3), 3);
        bodyGeometry.setAttribute("position", bodyPositions);
        bodyGeometry.setAttribute("normal", bodyNormals);
        bodyGeometry.setAttribute("aSeed", new THREE.BufferAttribute(sampler.seeds, 1));
        const bodyMaterial = createParticleMaterial("#f2f1f7", compact ? 10 : 9, THREE.NormalBlending);
        const body = new THREE.Points(bodyGeometry, bodyMaterial);
        body.frustumCulled = false;
        scene.add(body);

        // Is the subject going somewhere, or working on the spot?
        const first = centroidOf(vertices, 0, data.vertexCount, new THREE.Vector3());
        const last = centroidOf(vertices, (count - 1) * stride, data.vertexCount, new THREE.Vector3());
        const travel = new THREE.Vector3().subVectors(last, first).setZ(0);
        const travelling = travel.length() / (count / data.fps) > TRAVEL_SPEED;
        travel.normalize();

        // Earlier poses stay behind as exposures, the way a stroboscopic photograph stacks them.
        const exposureSlots = compact ? 4 : 6;
        const exposureStep = Math.max(2, Math.round(data.fps * (travelling ? 0.25 : 0.12)));
        const exposureStrength = travelling ? 0.9 : 0.4;
        const exposureCount = Math.min(compact ? EXPOSURE_SAMPLES / 2 : EXPOSURE_SAMPLES, bodyCount);
        const exposures = Array.from({ length: exposureSlots }, () => {
          const geometry = new THREE.BufferGeometry();
          const positions = new THREE.BufferAttribute(new Float32Array(exposureCount * 3), 3);
          const normals = new THREE.BufferAttribute(new Float32Array(exposureCount * 3), 3);
          geometry.setAttribute("position", positions);
          geometry.setAttribute("normal", normals);
          geometry.setAttribute("aSeed", new THREE.BufferAttribute(sampler.seeds.subarray(0, exposureCount), 1));
          const material = createParticleMaterial("#b9a6ff", compact ? 8 : 7, THREE.AdditiveBlending);
          material.uniforms.uOpacity.value = 0;
          const points = new THREE.Points(geometry, material);
          points.frustumCulled = false;
          points.renderOrder = -1;
          scene.add(points);
          return { geometry, positions, normals, material, frame: -1, used: false };
        });

        // A floor of dots across the whole path, so travel reads as travel.
        let ground = Infinity;
        for (let v = 2; v < stride; v += 3) ground = Math.min(ground, vertices[v]);
        const [minX, minY] = data.bounds.min;
        const [maxX, maxY] = data.bounds.max;
        const dots: number[] = [];
        for (let x = Math.floor(minX - 2); x <= Math.ceil(maxX + 2); x += 0.5) {
          for (let y = Math.floor(minY - 2); y <= Math.ceil(maxY + 2); y += 0.5) dots.push(x, y, ground);
        }
        const floorGeometry = new THREE.BufferGeometry();
        floorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dots, 3));
        const floorMaterial = new THREE.PointsMaterial({ color: "#5a516b", size: 0.032, sizeAttenuation: true, transparent: true, opacity: 0.9 });
        const floor = new THREE.Points(floorGeometry, floorMaterial);
        scene.add(floor);

        // Travelling subjects are filmed side-on with room behind them for the exposures; the rest three-quarter.
        const up = new THREE.Vector3(0, 0, 1);
        // Look a little behind a travelling subject; less so on a narrow stage, or it leaves the frame.
        const lead = travelling ? travel.clone().multiplyScalar(compact ? -0.6 : -1.5) : new THREE.Vector3();
        const offset = travelling
          ? new THREE.Vector3().crossVectors(up, travel).multiplyScalar(compact ? 8.4 : 6.2).addScaledVector(up, 0.5).addScaledVector(travel, 0.6)
          : new THREE.Vector3(3.15, -3.45, 1.15).setLength(compact ? 5.6 : 4.9);
        const targetHeight = first.z;
        const follow = new THREE.Vector3();
        const centre = new THREE.Vector3();
        const delta = new THREE.Vector3();
        const frameSubject = (snap: boolean, dt: number) => {
          centroidOf(pose, 0, data.vertexCount, centre);
          follow.copy(centre).add(lead).setZ(targetHeight);
          const ease = snap ? 1 : 1 - Math.exp(-dt * (travelling ? 9 : 2));
          delta.subVectors(follow, controls.target).multiplyScalar(ease);
          controls.target.add(delta);
          camera.position.add(delta);
        };
        const placeCamera = () => {
          centroidOf(pose, 0, data.vertexCount, centre);
          controls.target.copy(centre).add(lead).setZ(targetHeight);
          camera.position.copy(controls.target).add(offset);
          controls.update();
        };
        placeCamera();
        resetRef.current = placeCamera;

        const applyFrame = (frame: number) => {
          const i = Math.min(Math.floor(frame), count - 1);
          const j = Math.min(i + 1, count - 1);
          const a = frame - i;
          const from = i * stride;
          const to = j * stride;
          for (let k = 0; k < stride; k += 1) {
            pose[k] = vertices[from + k] + (vertices[to + k] - vertices[from + k]) * a;
          }
          shellPositions.needsUpdate = true;
          shellGeometry.computeVertexNormals();
          sampler.write(pose, bodyPositions.array as Float32Array, bodyNormals.array as Float32Array);
          bodyPositions.needsUpdate = true;
          bodyNormals.needsUpdate = true;

          const particles = styleRef.current === "particles";
          body.visible = particles;
          wire.visible = !particles;
          const scale = renderer.getPixelRatio() * (host.clientHeight / 620);
          bodyMaterial.uniforms.uPixelRatio.value = scale;

          exposures.forEach((exposure) => {
            exposure.used = false;
          });
          const newest = Math.floor(frame / exposureStep);
          for (let k = 0; k < exposureSlots; k += 1) {
            const source = (newest - k) * exposureStep;
            if (source < 0) break;
            const exposure = exposures[(newest - k) % exposureSlots];
            if (exposure.frame !== source) {
              sampler.write(
                vertices.subarray(source * stride, (source + 1) * stride),
                exposure.positions.array as Float32Array,
                exposure.normals.array as Float32Array,
                exposureCount,
              );
              exposure.positions.needsUpdate = true;
              exposure.normals.needsUpdate = true;
              exposure.frame = source;
            }
            exposure.used = true;
            const age = (frame - source) / (exposureSlots * exposureStep);
            // Fade in as the body leaves the pose, then out with age.
            const arrive = Math.min(1, (frame - source) / (exposureStep * 0.7));
            exposure.material.uniforms.uOpacity.value = trailRef.current
              ? exposureStrength * arrive * Math.max(0, 1 - age)
              : 0;
            exposure.material.uniforms.uPixelRatio.value = scale;
          }
          exposures.forEach((exposure) => {
            if (!exposure.used) exposure.material.uniforms.uOpacity.value = 0;
          });
        };

        const writeReadout = (frame: number) => {
          if (scrubRef.current && playingRef.current) scrubRef.current.value = String(frame);
          barRef.current?.style.setProperty("--playhead", `${((frame / (count - 1)) * 100).toFixed(2)}%`);
          if (timeRef.current) timeRef.current.textContent = (frame / data.fps).toFixed(2);
        };

        let lastTime = performance.now();
        let elapsed = 0;
        let lastFrame = -1;
        const tick = (now: number) => {
          raf = requestAnimationFrame(tick);
          const dt = Math.min(0.1, (now - lastTime) / 1000);
          lastTime = now;
          if (!visible || !activeRef.current || document.hidden) return;
          elapsed += dt;

          let wrapped = false;
          if (playingRef.current) {
            frameRef.current += dt * data.fps;
            if (frameRef.current >= count - 1) {
              frameRef.current = 0;
              wrapped = true;
            }
          }
          // A scrub can move the subject metres in one step; the camera cuts rather than chases.
          const jumped = wrapped || Math.abs(frameRef.current - lastFrame) > data.fps * 0.5;
          lastFrame = frameRef.current;

          applyFrame(frameRef.current);
          frameSubject(jumped, dt);
          if (!travelling && !reduceMotion) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.5 * Math.cos(elapsed * 0.28);
          }
          controls.update();
          writeReadout(frameRef.current);
          renderer.render(scene, camera);
        };

        setMetadata(data);
        setStatus("ready");
        setPlaying(!reduceMotion);
        raf = requestAnimationFrame(tick);

        cleanupScene = () => {
          shellGeometry.dispose();
          shellMaterial.dispose();
          wireMaterial.dispose();
          bodyGeometry.dispose();
          bodyMaterial.dispose();
          exposures.forEach((exposure) => {
            exposure.geometry.dispose();
            exposure.material.dispose();
          });
          floorGeometry.dispose();
          floorMaterial.dispose();
        };
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || disposed) return;
        setError(reason instanceof Error ? reason.message : "Mesh sequence failed to load.");
        setStatus("error");
      });

    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(raf);
      observer.disconnect();
      resizeObserver.disconnect();
      cleanupScene();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      resetRef.current = () => {};
    };
  }, [metadataUrl, reduceMotion]);

  const duration = metadata ? (metadata.frameCount - 1) / metadata.fps : 0;

  return (
    <div className="motion-stage">
      <div
        className="motion-stage__canvas"
        ref={hostRef}
        role="img"
        aria-label="Reconstructed body surface replaying the captured motion as silver particles, with earlier poses left behind as fading exposures."
      >
        <p className="motion-stage__label">
          Body surface
          {metadata ? <span>{metadata.fps} fps</span> : null}
        </p>
        <p className="motion-stage__hint" aria-hidden="true">Drag to orbit</p>

        {status !== "ready" ? (
          <div className="motion-stage__status" role="status">
            {status === "loading" ? (
              <><CircleNotch className="motion-stage__spinner" aria-hidden="true" /> Loading surface sequence</>
            ) : error}
          </div>
        ) : null}
      </div>

      <div className="motion-stage__bar" ref={barRef}>
        <button
          type="button"
          className="motion-stage__play"
          onClick={() => setPlaying((current) => !current)}
          disabled={status !== "ready"}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause weight="fill" aria-hidden="true" /> : <Play weight="fill" aria-hidden="true" />}
        </button>

        <input
          ref={scrubRef}
          className="motion-stage__scrub"
          type="range"
          min={0}
          max={Math.max((metadata?.frameCount ?? 2) - 1, 1)}
          step={0.01}
          defaultValue={0}
          disabled={status !== "ready"}
          onInput={(event) => {
            frameRef.current = Number(event.currentTarget.value);
            setPlaying(false);
          }}
          aria-label="Motion frame"
        />

        <p className="motion-stage__time">
          <output ref={timeRef}>0.00</output>
          <span>/ {duration.toFixed(2)} s</span>
        </p>

        <LayoutGroup id={`${layoutId}-style`}>
          <div className="motion-stage__segment" role="group" aria-label="Surface style">
            {STYLES.map((option) => (
              <button key={option.id} type="button" aria-pressed={style === option.id} onClick={() => setStyle(option.id)}>
                {style === option.id ? (
                  <motion.i className="motion-stage__thumb" layoutId="thumb" transition={thumbSpring} aria-hidden="true" />
                ) : null}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        <button
          type="button"
          className="motion-stage__toggle"
          role="switch"
          aria-checked={trail}
          onClick={() => setTrail((current) => !current)}
        >
          <i aria-hidden="true" />
          Exposures
        </button>

        <button type="button" className="motion-stage__reset" onClick={() => resetRef.current()} aria-label="Reset camera">
          <ArrowCounterClockwise aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
