import * as THREE from "three";
import { ACTS, chapters } from "./data";

THREE.ColorManagement.enabled = false;

export type Ctx = {
  /** 0..1 across the act (may run slightly outside while a wipe is on screen). */
  t: number;
  /** Local progress of a chapter: <0 before it, 0..1 inside, >1 after. */
  local: (id: string) => number;
  time: number;
  dt: number;
  pointer: { x: number; y: number };
  velocity: number;
  aspect: number;
  reduced: boolean;
};

export interface Act {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ready: Promise<unknown>;
  /** Backdrop for this act: top, bottom and glow colours. Every act has its own. */
  bg?: [number, number, number];
  /** Subject offset on screen as a fraction of the viewport (x right, y up). */
  offset?: { x: number; y: number };
  update(ctx: Ctx): void;
  anchors?: () => Record<string, THREE.Vector3>;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (current: number, target: number, rate: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

// Timeline in viewport-height units.
let cursor = 0;
export const spans = chapters.map((c) => {
  const start = cursor;
  cursor += c.length;
  return { ...c, start, end: cursor };
});
export const TOTAL = cursor;
export const actSpans = ACTS.map((_, i) => {
  const mine = spans.filter((s) => s.act === i);
  return { start: mine[0].start, end: mine[mine.length - 1].end };
});
const WIPE = 0.34; // half-width of a scene wipe, in viewport heights

const compositeFrag = /* glsl */ `
precision highp float;
uniform sampler2D tA; uniform sampler2D tB;
uniform float uWipe; uniform float uTime; uniform float uVel; uniform float uAspect;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 sampleScene(sampler2D t, vec2 uv, float ca){
  vec2 d = (uv - 0.5) * ca;
  return vec3(texture2D(t, uv + d).r, texture2D(t, uv).g, texture2D(t, uv - d).b);
}
void main(){
  float slope = 0.34;
  // The incoming scene rises from the bottom behind a slanted edge.
  float edge = vUv.y - slope * (vUv.x - 0.5);
  float line = mix(-slope * 0.5 - 0.02, 1.0 + slope * 0.5 + 0.02, uWipe);
  float side = edge - line;
  float ca = 0.0006 + min(abs(uVel), 1.0) * 0.008;
  // Each scene drifts a little against the edge so the cut reads as two planes.
  vec2 uvA = vUv + vec2(0.0, uWipe * 0.06);
  vec2 uvB = vUv - vec2(0.0, (1.0 - uWipe) * 0.06);
  vec3 col = side > 0.0 ? sampleScene(tA, uvA, ca) : sampleScene(tB, uvB, ca);
  float on = step(0.001, uWipe) * step(uWipe, 0.999);
  float glow = exp(-abs(side) * 240.0) + 0.35 * exp(-abs(side) * 28.0) * step(side, 0.0);
  col += on * glow * vec3(0.61, 0.42, 1.0) * 0.9;
  vec2 q = vUv - 0.5; q.x *= uAspect;
  col *= 1.0 - 0.42 * smoothstep(0.35, 1.05, length(q));
  col += (hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 61.0) - 0.5) * 0.045;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createStage(canvas: HTMLCanvasElement, acts: Act[], anchorRoot: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x050507, 1);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rtA = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  const rtB = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const composite = new THREE.ShaderMaterial({
    uniforms: {
      tA: { value: rtA.texture },
      tB: { value: rtB.texture },
      uWipe: { value: 0 },
      uTime: { value: 0 },
      uVel: { value: 0 },
      uAspect: { value: 1 },
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: compositeFrag,
    depthTest: false,
  });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite));

  // Backdrop: a slow two-colour field with a glow behind the subject, different for every act.
  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uTime: { value: 0 }, uAspect: { value: 1 }, uCentre: { value: new THREE.Vector2(0.5, 0.5) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uTop, uBottom, uGlow; uniform float uTime, uAspect; uniform vec2 uCentre; varying vec2 vUv;
      float blob(vec2 p, vec2 c, float r){ return exp(-dot(p - c, p - c) / (r * r)); }
      void main(){
        vec2 p = vUv; p.x *= uAspect;
        vec2 c = uCentre; c.x *= uAspect;
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y + 0.25 * (vUv.x - 0.5)));
        float g = blob(p, c, 0.55) * 0.85;
        g += blob(p, c + vec2(sin(uTime * 0.11) * 0.5, cos(uTime * 0.09) * 0.3), 0.32) * 0.45;
        g += blob(p, c + vec2(cos(uTime * 0.07) * 0.7, sin(uTime * 0.13) * 0.4 - 0.2), 0.24) * 0.3;
        col += uGlow * g;
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const bgScene = new THREE.Scene();
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial));

  let width = 1;
  let height = 1;
  let dpr = 1;
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, width < 800 ? 1.75 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    rtA.setSize(width * dpr, height * dpr);
    rtB.setSize(width * dpr, height * dpr);
    composite.uniforms.uAspect.value = width / height;
  }
  resize();
  window.addEventListener("resize", resize);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / width) * 2 - 1;
    pointer.ty = -((e.clientY / height) * 2 - 1);
  });

  const anchorEls = new Map<string, HTMLElement>();
  anchorRoot.querySelectorAll<HTMLElement>("[data-anchor]").forEach((el) => anchorEls.set(el.dataset.anchor!, el));
  const projected = new THREE.Vector3();

  function renderAct(index: number, u: number, time: number, dt: number, velocity: number, target: THREE.WebGLRenderTarget) {
    const act = acts[index];
    const span = actSpans[index];
    const aspect = width / height;
    const ctx: Ctx = {
      t: (u - span.start) / (span.end - span.start),
      local: (id) => {
        const s = spans.find((x) => x.id === id)!;
        return (u - s.start) / (s.end - s.start);
      },
      time,
      dt,
      pointer,
      velocity,
      aspect,
      reduced,
    };
    act.camera.aspect = aspect;
    const off = act.offset ?? { x: 0, y: 0 };
    act.camera.setViewOffset(width, height, -off.x * width, off.y * height, width, height);
    act.update(ctx);
    act.camera.updateMatrixWorld();
    renderer.setRenderTarget(target);
    const bg = act.bg ?? [0x050507, 0x050507, 0x000000];
    bgMaterial.uniforms.uTop.value.setHex(bg[0]);
    bgMaterial.uniforms.uBottom.value.setHex(bg[1]);
    bgMaterial.uniforms.uGlow.value.setHex(bg[2]);
    bgMaterial.uniforms.uTime.value = reduced ? 0 : time;
    bgMaterial.uniforms.uAspect.value = aspect;
    bgMaterial.uniforms.uCentre.value.set(0.5 + off.x, 0.52 + off.y * 0.5);
    renderer.autoClear = true;
    renderer.render(bgScene, quadCam);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(act.scene, act.camera);
    renderer.autoClear = true;
  }

  function placeAnchors(index: number, visible: boolean) {
    const act = acts[index];
    if (!act.anchors) return;
    const points = act.anchors();
    for (const id in points) {
      const el = anchorEls.get(id);
      if (!el) continue;
      projected.copy(points[id]).project(act.camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.visibility = visible && projected.z < 1 ? "visible" : "hidden";
    }
  }

  let lastAct = -1;
  function frame(u: number, time: number, dt: number, velocity: number) {
    pointer.x = damp(pointer.x, pointer.tx, 5, dt);
    pointer.y = damp(pointer.y, pointer.ty, 5, dt);
    let a = actSpans.findIndex((s) => u < s.end);
    if (a < 0) a = acts.length - 1;
    let b = -1;
    let wipe = 0;
    for (let i = 0; i < actSpans.length - 1; i += 1) {
      const edge = actSpans[i].end;
      if (Math.abs(u - edge) < WIPE) {
        a = i;
        b = i + 1;
        wipe = smooth(0, 1, (u - edge + WIPE) / (2 * WIPE));
      }
    }
    renderAct(a, u, time, dt, velocity, rtA);
    if (b >= 0) renderAct(b, u, time, dt, velocity, rtB);
    composite.uniforms.uWipe.value = b >= 0 ? wipe : 0;
    composite.uniforms.uTime.value = time;
    composite.uniforms.uVel.value = damp(composite.uniforms.uVel.value, velocity, 6, dt);
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);

    const front = b >= 0 && wipe > 0.5 ? b : a;
    if (front !== lastAct) {
      if (lastAct >= 0) placeAnchors(lastAct, false);
      lastAct = front;
    }
    placeAnchors(front, b < 0 || wipe < 0.08 || wipe > 0.92);
    return front;
  }

  return { frame, reduced };
}
