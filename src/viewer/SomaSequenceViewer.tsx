import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
import { CircleNotch } from "@phosphor-icons/react/CircleNotch";
import { Pause } from "@phosphor-icons/react/Pause";
import { Play } from "@phosphor-icons/react/Play";
import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MeshSequenceMetadata } from "./types";

interface LoadedSequence {
  metadata: MeshSequenceMetadata;
  faces: Uint32Array;
  vertices: Float32Array;
}

interface SomaSequenceViewerProps {
  metadataUrl: string;
  active?: boolean;
}

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

export function SomaSequenceViewer({ metadataUrl, active = true }: SomaSequenceViewerProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sequenceRef = useRef<LoadedSequence | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rangeId = useId();
  const reduceMotion = useReducedMotion();
  const [metadata, setMetadata] = useState<MeshSequenceMetadata | null>(null);
  const [frame, setFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const controller = new AbortController();
    let disposed = false;
    let animationFrame = 0;
    setStatus("loading");
    setError("");
    setFrame(0);
    setIsPlaying(false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.Fog("#050505", 4.5, 9);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 40);
    camera.up.set(0, 0, 1);
    camera.position.set(3.15, -3.45, 2.25);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.target.set(0, 0, 1.02);
    controls.minDistance = 1.2;
    controls.maxDistance = 7;
    controlsRef.current = controls;

    const ambient = new THREE.HemisphereLight("#f4f0fa", "#251934", 1.45);
    scene.add(ambient);
    const key = new THREE.DirectionalLight("#d9d2ff", 5.4);
    key.position.set(2.2, -2.8, 4.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#9b6cff", 4.8);
    rim.position.set(-3.2, 2.4, 2.8);
    scene.add(rim);

    const grid = new THREE.GridHelper(8, 24, "#463856", "#1b1720");
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.006;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.62;
    scene.add(grid);

    const horizon = new THREE.Mesh(
      new THREE.CircleGeometry(2.7, 96),
      new THREE.MeshBasicMaterial({
        color: "#140f1b",
        transparent: true,
        opacity: 0.74,
        side: THREE.DoubleSide,
      }),
    );
    horizon.position.z = -0.012;
    scene.add(horizon);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    loadSequence(metadataUrl, controller.signal)
      .then((sequence) => {
        if (disposed) return;
        sequenceRef.current = sequence;
        setMetadata(sequence.metadata);

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(sequence.metadata.vertexCount * 3);
        positions.set(sequence.vertices.subarray(0, positions.length));
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(sequence.faces, 1));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        geometryRef.current = geometry;

        const material = new THREE.MeshStandardMaterial({
          color: "#d9d4df",
          roughness: 0.34,
          metalness: 0.22,
          side: THREE.DoubleSide,
        });
        materialRef.current = material;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        scene.add(mesh);

        setStatus("ready");
        if (!reduceMotion) setIsPlaying(true);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || disposed) return;
        setError(reason instanceof Error ? reason.message : "Mesh sequence failed to load.");
        setStatus("error");
      });

    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      geometryRef.current?.dispose();
      materialRef.current?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      geometryRef.current = null;
      materialRef.current = null;
      sequenceRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [metadataUrl, reduceMotion]);

  useEffect(() => {
    const sequence = sequenceRef.current;
    const geometry = geometryRef.current;
    if (!sequence || !geometry) return;
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const offset = frame * sequence.metadata.vertexCount * 3;
    (positions.array as Float32Array).set(
      sequence.vertices.subarray(offset, offset + sequence.metadata.vertexCount * 3),
    );
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }, [frame]);

  useEffect(() => {
    if (!active || !isPlaying || !metadata || reduceMotion) return;
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % metadata.frameCount);
    }, 1000 / metadata.fps);
    return () => window.clearInterval(timer);
  }, [active, isPlaying, metadata, reduceMotion]);

  useEffect(() => {
    if (materialRef.current) materialRef.current.wireframe = wireframe;
  }, [wireframe]);

  const resetCamera = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(3.15, -3.45, 2.25);
    camera.up.set(0, 0, 1);
    controls.target.set(0, 0, 1.02);
    controls.update();
  };

  const duration = metadata ? metadata.frameCount / metadata.fps : 0;
  const currentTime = metadata ? frame / metadata.fps : 0;

  return (
    <div className="soma-viewer">
      <div className="soma-viewer__stage" ref={canvasHostRef}>
        <div className="soma-viewer__stage-meta" aria-hidden="true">
          <span>SOMA / GLOBAL SURFACE</span>
          <span>DRAG TO ORBIT · SCROLL TO ZOOM</span>
        </div>
        <div className={`soma-viewer__status is-${status}`} role="status">
          {status === "loading" ? (
            <><CircleNotch className="is-spinning" aria-hidden="true" /> Loading mesh sequence</>
          ) : null}
          {status === "error" ? error : null}
        </div>
        <div className="soma-viewer__axis" aria-hidden="true">
          <i>X</i><i>Y</i><i>Z</i>
        </div>
      </div>

      <div className="soma-viewer__console">
        <div className="soma-viewer__transport">
          <button
            type="button"
            onClick={() => setIsPlaying((current) => !current)}
            disabled={status !== "ready" || Boolean(reduceMotion)}
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={resetCamera} aria-label="Reset camera">
            <ArrowCounterClockwise aria-hidden="true" />
          </button>
        </div>

        <div className="soma-viewer__timeline">
          <label htmlFor={rangeId}>Frame {String(frame + 1).padStart(2, "0")}</label>
          <strong>{currentTime.toFixed(2)}s</strong>
          <input
            id={rangeId}
            type="range"
            min="0"
            max={Math.max((metadata?.frameCount ?? 1) - 1, 0)}
            value={frame}
            disabled={status !== "ready"}
            onChange={(event) => {
              setFrame(Number(event.target.value));
              setIsPlaying(false);
            }}
            aria-valuetext={`Frame ${frame + 1} at ${currentTime.toFixed(2)} seconds`}
          />
          <div><span>0.00s</span><span>{duration.toFixed(2)}s</span></div>
        </div>

        <button
          type="button"
          className={`soma-viewer__mode${wireframe ? " is-active" : ""}`}
          onClick={() => setWireframe((current) => !current)}
          aria-pressed={wireframe}
        >
          <span>Surface mode</span>
          <strong>{wireframe ? "Topology" : "Shaded mesh"}</strong>
        </button>

        <dl className="soma-viewer__readout">
          <div><dt>Vertices</dt><dd>{metadata?.vertexCount.toLocaleString() ?? "—"}</dd></div>
          <div><dt>Triangles</dt><dd>{metadata?.triangleCount.toLocaleString() ?? "—"}</dd></div>
          <div><dt>Rate</dt><dd>{metadata ? `${metadata.fps} fps` : "—"}</dd></div>
          <div><dt>Sequence</dt><dd>{metadata ? `${metadata.frameCount} frames` : "—"}</dd></div>
        </dl>
      </div>
    </div>
  );
}
