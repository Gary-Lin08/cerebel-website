import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "motion/react";
import { useCompact } from "../hooks";

const humanPointsUrl = "/assets/cerebel-kinetic-human-points.bin";
const cerebellumPointsUrl = "/assets/cerebel-cerebellum-points.bin";
const pairedPoster = "/assets/egocentric-smpl-synchronized-demo-poster.jpg";
let particleBuffersPromise: Promise<[ArrayBuffer, ArrayBuffer]> | undefined;

function loadParticleBuffers() {
  particleBuffersPromise ??= Promise.all([
    fetch(humanPointsUrl, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error(`Human particle surface failed with ${response.status}.`);
      return response.arrayBuffer();
    }),
    fetch(cerebellumPointsUrl, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error(`Cerebellar particle surface failed with ${response.status}.`);
      return response.arrayBuffer();
    }),
  ]);
  return particleBuffersPromise;
}

type Pointer = { x: number; y: number; active: boolean };
type Transition = { target: number; touched: boolean };
type ViewState = {
  dragging: boolean;
  startX: number;
  startY: number;
  startRotationX: number;
  startRotationY: number;
  rotationX: number;
  rotationY: number;
  scale: number;
  pinchDistance: number;
  pinchScale: number;
  moved: boolean;
  downAt: number;
  touches: Map<number, { x: number; y: number }>;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const distanceBetween = (points: Array<{ x: number; y: number }>) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

export function ParticleMorphHero() {
  const compact = useCompact();
  const reduceMotion = Boolean(useReducedMotion());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<Pointer>({ x: 0, y: 0, active: false });
  const transition = useRef<Transition>({ target: 0, touched: false });
  const view = useRef<ViewState>({ dragging: false, startX: 0, startY: 0, startRotationX: 0, startRotationY: 0, rotationX: 0, rotationY: 0, scale: 1, pinchDistance: 0, pinchScale: 1, moved: false, downAt: 0, touches: new Map() });
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    let disposed = false;
    let frame = 0;
    let observer: IntersectionObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let disposeScene: (() => void) | undefined;

    const load = async () => {
      try {
        const [THREE, [humanBuffer, cerebellumBuffer]] = await Promise.all([
          import("three"),
          loadParticleBuffers(),
        ]);
        if (disposed) return;
        const humanSource = new Float32Array(humanBuffer);
        const cerebellumSource = new Float32Array(cerebellumBuffer);
        const requestedCount = compact ? 12_000 : 28_000;
        const count = Math.min(requestedCount, humanSource.length / 3, cerebellumSource.length / 3);
        const humanPoints = humanSource.slice(0, count * 3);
        const cerebellumPoints = cerebellumSource.slice(0, count * 3);

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
        renderer.setClearAlpha(0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.set(0, 0, 9.4);
        const group = new THREE.Group();
        group.rotation.set(-0.08, -0.52, 0.04);
        scene.add(group);
        const uniforms = {
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2() },
          uHover: { value: new THREE.Vector2(4, 4) },
          uHoverOpen: { value: 0 },
          uMorph: { value: 0 },
          uPixelRatio: { value: renderer.getPixelRatio() },
        };
        const material = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending, uniforms,
          vertexShader: `uniform float uTime; uniform vec2 uPointer; uniform vec2 uHover; uniform float uHoverOpen; uniform float uMorph; uniform float uPixelRatio; attribute vec3 aHuman; attribute vec3 aCerebellum; attribute float aSeed; varying float vMorph; varying float vHover; varying float vSeed; void main() { vec3 point = mix(aCerebellum, aHuman, uMorph); float breath = sin(uTime * 0.72 + aSeed * 18.0) * 0.022; float drift = sin(uTime * 0.42 + aSeed * 9.0) * 0.012; point += normalize(point + vec3(0.001)) * breath; point.x += drift + uPointer.x * (0.035 + 0.02 * sin(aSeed * 11.0)); point.y += cos(uTime * 0.51 + aSeed * 13.0) * 0.01 + uPointer.y * 0.025; vec4 mvPosition = modelViewMatrix * vec4(point, 1.0); vec4 clipPosition = projectionMatrix * mvPosition; gl_Position = clipPosition; vec2 ndc = clipPosition.xy / clipPosition.w; vHover = (1.0 - smoothstep(0.075, 0.31, length(ndc - uHover))) * uHoverOpen; float sparkle = 1.45 + 0.8 * sin(aSeed * 74.0 + uTime * 0.4); gl_PointSize = max(1.25, sparkle * (1.0 + vHover * 0.24) * uPixelRatio * (11.0 / -mvPosition.z)); vMorph = uMorph; vSeed = aSeed; }`,
          fragmentShader: `varying float vMorph; varying float vHover; varying float vSeed; void main() { float radius = length(gl_PointCoord - 0.5); float alpha = smoothstep(0.52, 0.11, radius); vec3 silver = vec3(0.96, 0.97, 0.98); vec3 violet = vec3(0.54, 0.30, 1.0); vec3 phosphor = vec3(0.22, 1.0, 0.08); vec3 color = mix(violet, silver, vMorph); float signal = step(0.986, fract(vSeed * 147.0)); color = mix(color, phosphor, signal * (0.22 + 0.34 * (1.0 - vMorph))); color = mix(color, vec3(1.0), vHover * 0.24); gl_FragColor = vec4(color, alpha * (0.82 + vHover * 0.18 + signal * 0.16)); }`,
        });
        const resize = () => {
          const { width, height } = stage.getBoundingClientRect();
          if (!width || !height) return;
          renderer.setSize(width, height, false); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
          uniforms.uPixelRatio.value = renderer.getPixelRatio(); camera.aspect = width / height; camera.updateProjectionMatrix();
        };
        let visible = true;
        const startedAt = performance.now();
        const render = () => {
          if (disposed || !visible) { frame = 0; return; }
          const elapsed = (performance.now() - startedAt) / 1000;
          uniforms.uTime.value = reduceMotion ? 0 : elapsed;
          uniforms.uPointer.value.lerp(pointer.current as any, 0.04);
          uniforms.uHover.value.lerp(new THREE.Vector2(pointer.current.x * 2, -pointer.current.y * 2), 0.12);
          uniforms.uHoverOpen.value += ((pointer.current.active ? 1 : 0) - uniforms.uHoverOpen.value) * 0.11;
          if (!transition.current.touched) transition.current.target = reduceMotion ? 0 : clamp((elapsed - 0.35) / 1.35);
          uniforms.uMorph.value += (transition.current.target - uniforms.uMorph.value) * 0.055;
          group.rotation.y += ((-0.52 + view.current.rotationY + pointer.current.x * 0.08) - group.rotation.y) * 0.075;
          group.rotation.x += ((-0.08 + view.current.rotationX - pointer.current.y * 0.05) - group.rotation.x) * 0.075;
          const targetScale = view.current.scale * (compact ? 1.02 : 1.82);
          group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
          group.position.x = (compact ? 0.18 : -0.72) + (reduceMotion ? 0 : Math.cos(elapsed * 0.31) * 0.06);
          group.position.y = (compact ? 0 : -0.72) + (reduceMotion ? 0 : Math.sin(elapsed * 0.48) * 0.075);
          renderer.render(scene, camera); frame = window.requestAnimationFrame(render);
        };
        observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !frame) render(); }, { threshold: 0.12 });
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(stage);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(humanPoints, 3)); geometry.setAttribute("aHuman", new THREE.BufferAttribute(humanPoints, 3)); geometry.setAttribute("aCerebellum", new THREE.BufferAttribute(cerebellumPoints, 3));
        const seeds = new Float32Array(count);
        for (let index = 0; index < count; index += 1) seeds[index] = Math.random();
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
        group.add(new THREE.Points(geometry, material)); resize(); observer.observe(stage); setStatus("ready"); render();
        disposeScene = () => { scene.traverse((child) => { if (child instanceof THREE.Points) child.geometry.dispose(); }); material.dispose(); renderer.dispose(); };
      } catch (error) {
        console.warn("Cerebel particle surface could not be loaded.", error);
        if (!disposed) setStatus("fallback");
      }
    };

    void load();

    return () => {
      disposed = true;
      observer?.disconnect();
      resizeObserver?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      disposeScene?.();
    };
  }, [compact, reduceMotion]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        view.current.scale = Math.max(0.7, Math.min(1.48, view.current.scale * Math.exp(-event.deltaY * 0.006)));
        return;
      }

      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.72;
      const delta = horizontal ? event.deltaX : event.deltaY;
      const current = transition.current;
      // Vertical wheel only scrubs while the page rests at the top, so it can never trap a reader mid-scroll.
      const atTop = window.scrollY <= 1;
      const canConsume = horizontal || (atTop && ((delta > 0 && current.target < 0.995) || (delta < 0 && current.target > 0.005)));
      if (!canConsume) return;
      event.preventDefault();
      current.touched = true;
      current.target = clamp(current.target + delta * 0.0015);
    };
    let safariGestureScale = 1;
    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      safariGestureScale = view.current.scale;
    };
    const handleGestureChange = (event: Event) => {
      event.preventDefault();
      const scale = (event as Event & { scale?: number }).scale ?? 1;
      view.current.scale = Math.max(0.7, Math.min(1.48, safariGestureScale * scale));
    };
    const handleGestureEnd = (event: Event) => event.preventDefault();

    stage.addEventListener("wheel", handleNativeWheel, { passive: false });
    stage.addEventListener("gesturestart", handleGestureStart, { passive: false });
    stage.addEventListener("gesturechange", handleGestureChange, { passive: false });
    stage.addEventListener("gestureend", handleGestureEnd, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleNativeWheel);
      stage.removeEventListener("gesturestart", handleGestureStart);
      stage.removeEventListener("gesturechange", handleGestureChange);
      stage.removeEventListener("gestureend", handleGestureEnd);
    };
  }, []);

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    pointer.current = {
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5,
      active: true,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    updatePointer(event);
    const current = view.current;
    current.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (current.touches.size === 1) {
      current.dragging = true;
      current.moved = false;
      current.downAt = performance.now();
      current.startX = event.clientX;
      current.startY = event.clientY;
      current.startRotationX = current.rotationX;
      current.startRotationY = current.rotationY;
    } else if (current.touches.size === 2) {
      current.dragging = false;
      current.moved = true;
      current.pinchDistance = distanceBetween(Array.from(current.touches.values()));
      current.pinchScale = current.scale;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    updatePointer(event);
    const current = view.current;
    if (current.touches.has(event.pointerId)) current.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (current.touches.size >= 2) {
      const nextDistance = distanceBetween(Array.from(current.touches.values()));
      current.scale = Math.max(0.7, Math.min(1.48, current.pinchScale * (nextDistance / Math.max(current.pinchDistance, 1))));
      return;
    }
    if (!current.dragging) return;
    if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 6) current.moved = true;
    current.rotationY = current.startRotationY + (event.clientX - current.startX) * 0.008;
    current.rotationX = Math.max(-0.72, Math.min(0.54, current.startRotationX + (event.clientY - current.startY) * 0.006));
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const current = view.current;
    const shouldToggle = current.touches.size === 1 && !current.moved && performance.now() - current.downAt < 360;
    current.touches.delete(event.pointerId);
    current.dragging = false;
    if (shouldToggle) {
      transition.current.touched = true;
      transition.current.target = transition.current.target > 0.5 ? 0 : 1;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = transition.current;
    const isMorphKey = event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End";
    const isZoomKey = event.key === "+" || event.key === "=" || event.key === "-" || event.key === "0";
    if (!isMorphKey && !isZoomKey) return;
    event.preventDefault();
    if (isMorphKey) {
      current.touched = true;
      if (event.key === "Home") current.target = 0;
      else if (event.key === "End") current.target = 1;
      else current.target = clamp(current.target + (event.key === "ArrowRight" ? 0.14 : -0.14));
    } else if (event.key === "0") {
      view.current.scale = 1;
      view.current.rotationX = 0;
      view.current.rotationY = 0;
    } else {
      view.current.scale = Math.max(0.7, Math.min(1.48, view.current.scale + (event.key === "-" ? -0.1 : 0.1)));
    }
  }

  function handlePointerLeave() {
    pointer.current = { x: 0, y: 0, active: false };
    if (!view.current.touches.size) view.current.dragging = false;
  }

  return (
    <div className={`particle-hero particle-hero--${status}${status === "ready" ? " is-ready" : ""}`}>
      <div
        className="particle-hero__surface"
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-label="Three-dimensional particle study. Tap or scroll to traverse forms, drag to rotate, pinch to zoom, or use arrow and plus-minus keys."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
      >
        {status === "fallback" ? (
          <img className="particle-hero__fallback" src={pairedPoster} alt="Synchronized wearable and reconstructed motion evidence." />
        ) : (
          <canvas ref={canvasRef} aria-label="Particle animation transitioning from cerebellar motion field to articulated body." />
        )}
        <div className="particle-hero__measure" aria-hidden="true"><span>cerebellum</span><i /><span>tap to morph · drag to rotate</span><i /><span>body</span></div>
      </div>
    </div>
  );
}
