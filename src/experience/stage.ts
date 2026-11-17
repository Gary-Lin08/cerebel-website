import * as THREE from "three";
import { ACTS, chapters } from "./data";
import { createCloud } from "./cloud";

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
  interaction: number;
};

export interface Act {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ready: Promise<unknown>;
  /** Backdrop for this act: top, bottom and glow colours. Every act has its own. */
  bg?: [number, number, number];
  /** The two colours the shared cloud of lights takes in this act. */
  tint?: [number, number];
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
export const WIPE = 0.6; // half-width of a scene wipe, in viewport heights
export const ENTER = 0.34; // a chapter's copy (headline trace and fill, body) comes in over this much scroll

// Rest points: one per chapter, where the page comes to rest when the hand lets go (see snap.ts). By default just
// after the headline has finished and any scene change is over; chapters whose act settles later say so in data.ts.
export const RESTS = spans.map((s, i) => {
  if (i === 0) return 0;
  const sceneChange = s.act !== spans[i - 1].act;
  return s.start + (s.rest ?? Math.max(ENTER + 0.12, sceneChange ? WIPE + 0.06 : 0));
});

// Scene time. Around every rest point the scene holds completely still for HOLD on either side, and the motion
// between two rest points runs a little faster to make up the distance. So a page at rest always shows a still
// picture, and stopping slightly short of or past a rest point looks the same as stopping on it. Copy is not
// held: it is driven by the raw scroll position (index.ts).
export const HOLD = 0.1;
export function sceneTime(u: number) {
  for (let i = 0; i < RESTS.length; i += 1) {
    const r = RESTS[i];
    if (u <= r + HOLD) {
      if (u >= r - HOLD) return r;
      if (i === 0) return u;
      const a = RESTS[i - 1];
      return a + ((u - (a + HOLD)) / (r - HOLD - (a + HOLD))) * (r - a);
    }
  }
  const last = RESTS[RESTS.length - 1];
  return last + Math.max(0, u - (last + HOLD));
}

const NOISE = /* glsl */ `
// A hash without sin(): the sine version loses precision on large pixel coordinates and its output lines up
// in columns, which showed as vertical streaks in the grain.
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

// Between acts the incoming scene comes up through the outgoing one behind a drifting, cloud-shaped front,
// not a ruled edge. The backdrop and the cloud of lights are already the same in both (see palette()), so
// only the subjects change hands. The outgoing scene eases toward the lens as it goes; the incoming settles back.
const compositeFrag = /* glsl */ `
precision highp float;
uniform sampler2D tA; uniform sampler2D tB;
uniform float uWipe; uniform float uTime; uniform float uVel; uniform float uAspect; uniform vec2 uRes; uniform float uFrost;
varying vec2 vUv;
${NOISE}
vec3 sampleScene(sampler2D t, vec2 uv, float ca){
  vec2 d = (uv - 0.5) * ca;
  return vec3(texture2D(t, uv + d).r, texture2D(t, uv).g, texture2D(t, uv - d).b);
}
void main(){
  float ca = 0.0005 + min(abs(uVel), 1.0) * 0.0028;
  // Ground glass: each pixel looks a pixel or two aside, in a direction fixed to the screen.
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 tooth = (vec2(hash(cell), hash(cell.yx + vec2(113.0, 57.0))) - 0.5) * uFrost / uRes;
  bool wiping = uWipe > 0.001;
  float blend = 1.0;
  float glow = 0.0;
  vec2 uvA = vUv;
  vec2 uvB = vUv;
  if (wiping) {
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    float shape = fbm(p * 1.7 + vec2(0.0, uTime * 0.015)) - 0.5;
    float front = vUv.y - 0.22 * (vUv.x - 0.5) + shape * 0.55;
    float side = front - mix(-0.62, 1.62, uWipe);
    blend = smoothstep(-0.3, 0.3, side);
    uvA = (vUv - 0.5) * (1.0 - uWipe * 0.045) + 0.5;
    uvB = (vUv - 0.5) * (1.0 + (1.0 - uWipe) * 0.045) + 0.5;
    glow = exp(-side * side * 9.0) * sin(uWipe * 3.14159);
  }
  vec3 col = sampleScene(tA, uvA + tooth * 0.5, ca);
  if (wiping) col = mix(sampleScene(tB, uvB + tooth * 0.5, ca), col, blend);
  // Diffusion, as through a soft filter on the lens: a wide, cheap blur of the scene is laid back over it, so
  // lights bloom, edges lose their hardness and the dark areas fill with the colour around them.
  vec3 haze = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float ang = float(i) * 2.399963 + hash(cell) * 6.2832;
    float rad = (i < 6 ? 7.0 : 19.0) * uFrost / 1.5;
    vec2 o = vec2(cos(ang), sin(ang)) * rad / uRes;
    vec3 tap = texture2D(tA, uvA + o).rgb;
    if (wiping) tap = mix(texture2D(tB, uvB + o).rgb, tap, blend);
    haze += tap;
  }
  haze /= 12.0;
  col = mix(col, max(col, haze), 0.3) + haze * 0.06;
  // Keep the blacks: diffusion lifts everything, so the tone curve is pulled back down at the bottom.
  col = mix(col, smoothstep(0.0, 1.0, col), 0.4);
  col += glow * col * 0.35;
  vec2 q = vUv - 0.5; q.x *= uAspect;
  col *= 1.0 - 0.42 * smoothstep(0.35, 1.05, length(q));
  // Film grain: coarse enough to see, moving every frame, strongest in the mid-tones.
  // Whole-pixel grains only: a fractional grain size makes columns of uneven width, which also reads as streaks.
  vec2 gcell = floor(gl_FragCoord.xy / max(1.0, floor(uFrost / 1.5 * 1.35 + 0.5)));
  // The grain holds for a sixth of a second and cross-fades to the next pattern, so it drifts instead of fizzing.
  float gt = uTime * 6.0;
  vec2 s0 = vec2(mod(floor(gt) * 37.0, 289.0), mod(floor(gt) * 91.0, 311.0));
  vec2 s1 = vec2(mod((floor(gt) + 1.0) * 37.0, 289.0), mod((floor(gt) + 1.0) * 91.0, 311.0));
  float g0 = hash(gcell + s0) + hash(gcell.yx + s0.yx + 151.0) - 1.0;
  float g1 = hash(gcell + s1) + hash(gcell.yx + s1.yx + 151.0) - 1.0;
  float grain = mix(g0, g1, smoothstep(0.0, 1.0, fract(gt)));
  float luma = dot(col, vec3(0.3, 0.59, 0.11));
  col += grain * (0.019 + 0.033 * smoothstep(0.0, 0.35, luma) * (1.0 - 0.6 * smoothstep(0.6, 1.0, luma)));
  float sheen = smoothstep(0.55, 0.0, abs((vUv.x * uAspect * 0.55 + (1.0 - vUv.y)) - 0.32));
  col += vec3(0.75, 0.82, 1.0) * sheen * 0.022;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createStage(canvas: HTMLCanvasElement, acts: Act[], anchorRoot: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x050507, 1);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rtA = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  const rtB = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  // While two acts are on screen both are drawn every frame; they go to lighter targets (2 samples) for that stretch.
  const rtA2 = new THREE.WebGLRenderTarget(2, 2, { samples: 2 });
  const rtB2 = new THREE.WebGLRenderTarget(2, 2, { samples: 2 });
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
      uRes: { value: new THREE.Vector2(1, 1) },
      uFrost: { value: 1.6 }, // reach of the frosting, in device pixels
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: compositeFrag,
    depthTest: false,
  });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite));

  // Backdrop: a slow two-colour field with a glow behind the subject, different for every act.
  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uTime: { value: 0 }, uAspect: { value: 1 }, uCentre: { value: new THREE.Vector2(0.5, 0.5) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    // A graded field, a glow behind the subject, and over both a slow weather of colour: uneven banks of the
    // act's two light colours, warped so no edge is straight and nothing repeats. Never an even wash.
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uTop, uBottom, uGlow, uA, uB; uniform float uTime, uAspect; uniform vec2 uCentre; varying vec2 vUv;
      ${NOISE}
      float blob(vec2 p, vec2 c, float r){ return exp(-dot(p - c, p - c) / (r * r)); }
      void main(){
        vec2 p = vUv; p.x *= uAspect;
        vec2 c = uCentre; c.x *= uAspect;
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y + 0.25 * (vUv.x - 0.5)));
        float t = uTime * 0.02;
        vec2 w = p * 1.15 + vec2(fbm(p * 0.9 + t), fbm(p * 0.9 - t + 7.3)) * 1.1;
        float bankA = smoothstep(0.42, 0.78, fbm(w + vec2(t, 3.1)));
        float bankB = smoothstep(0.46, 0.82, fbm(w * 1.3 + vec2(11.7, -t * 1.3)));
        float veil = smoothstep(0.35, 0.7, fbm(w * 0.6 + 21.0));
        float g = blob(p, c, 0.55) * (0.6 + 0.4 * veil);
        g += blob(p, c + vec2(sin(uTime * 0.11) * 0.5, cos(uTime * 0.09) * 0.3), 0.32) * 0.4;
        g += blob(p, c + vec2(cos(uTime * 0.07) * 0.7, sin(uTime * 0.13) * 0.4 - 0.2), 0.24) * 0.28;
        col += uGlow * g;
        float lift = 0.35 + 0.65 * smoothstep(-0.1, 0.9, vUv.y);
        col += uA * bankA * 0.15 * lift;
        col += uB * bankB * 0.11 * (1.3 - lift);
        col *= 0.86 + 0.28 * veil;
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const bgScene = new THREE.Scene();
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial));

  // The shared cloud, drawn behind every act with its own camera.
  const cloud = createCloud();
  const cloudScene = new THREE.Scene();
  const cloudRig = new THREE.Group();
  cloudRig.add(cloud.points);
  cloudScene.add(cloudRig);
  const cloudCam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  cloudCam.position.set(0, 0, 11);
  const cloudSpin = { x: 0, y: 0, vx: 0, vy: 0 };
  const cloudGlow = { x: 0, y: 0, vx: 0, vy: 0 };
  const pointerWas = { x: 0, y: 0 };
  const pointerVel = { x: 0, y: 0 };

  // Colours drift across act boundaries: within a screen and a half of a boundary, both acts are
  // given the same mix of their two palettes, so the backdrop and the cloud never jump.
  const DRIFT = 1.5;
  const mixTop = new THREE.Color();
  const mixBottom = new THREE.Color();
  const mixGlow = new THREE.Color();
  const mixA = new THREE.Color();
  const mixB = new THREE.Color();
  const other = new THREE.Color();
  function palette(index: number, u: number) {
    const span = actSpans[index];
    const towardNext = u > (span.start + span.end) / 2;
    const neighbour = towardNext ? index + 1 : index - 1;
    const here = acts[index];
    const bg = here.bg ?? [0x050507, 0x050507, 0x000000];
    const tint = here.tint ?? [0x9b6cff, 0x39e6b0];
    mixTop.setHex(bg[0]);
    mixBottom.setHex(bg[1]);
    mixGlow.setHex(bg[2]);
    mixA.setHex(tint[0]);
    mixB.setHex(tint[1]);
    if (neighbour < 0 || neighbour >= acts.length) return;
    const edge = towardNext ? span.end : span.start;
    // 0 on this act's side, 1 on the neighbour's; exactly one half at the boundary for both acts.
    const across = smooth(edge - DRIFT, edge + DRIFT, u);
    const k = towardNext ? across : 1 - across;
    const there = acts[neighbour];
    const nbg = there.bg ?? [0x050507, 0x050507, 0x000000];
    const ntint = there.tint ?? [0x9b6cff, 0x39e6b0];
    mixTop.lerp(other.setHex(nbg[0]), k);
    mixBottom.lerp(other.setHex(nbg[1]), k);
    mixGlow.lerp(other.setHex(nbg[2]), k);
    mixA.lerp(other.setHex(ntint[0]), k);
    mixB.lerp(other.setHex(ntint[1]), k);
  }

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
    rtA2.setSize(width * dpr, height * dpr);
    rtB2.setSize(width * dpr, height * dpr);
    composite.uniforms.uAspect.value = width / height;
    composite.uniforms.uRes.value.set(width * dpr, height * dpr);
    composite.uniforms.uFrost.value = 1.5 * dpr;
  }
  resize();
  window.addEventListener("resize", resize);

  let interaction = 0;
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
      interaction,
    };
    act.camera.aspect = aspect;
    const off = act.offset ?? { x: 0, y: 0 };
    act.camera.setViewOffset(width, height, -off.x * width, off.y * height, width, height);
    act.update(ctx);
    act.camera.updateMatrixWorld();
    renderer.setRenderTarget(target);
    palette(index, u);
    bgMaterial.uniforms.uTop.value.copy(mixTop);
    bgMaterial.uniforms.uBottom.value.copy(mixBottom);
    bgMaterial.uniforms.uGlow.value.copy(mixGlow);
    bgMaterial.uniforms.uA.value.copy(mixA);
    bgMaterial.uniforms.uB.value.copy(mixB);
    cloud.uniforms.uA.value.copy(mixA);
    cloud.uniforms.uB.value.copy(mixB);
    bgMaterial.uniforms.uTime.value = reduced ? 0 : time;
    bgMaterial.uniforms.uAspect.value = aspect;
    bgMaterial.uniforms.uCentre.value.set(0.5 + off.x, 0.52 + off.y * 0.5);
    renderer.autoClear = true;
    renderer.render(bgScene, quadCam);
    renderer.autoClear = false;
    cloudCam.aspect = aspect;
    cloudCam.updateProjectionMatrix();
    renderer.render(cloudScene, cloudCam);
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
    interaction = damp(interaction, anchorRoot.closest(".xp")?.classList.contains("is-interactive") ? 1 : 0, 1.8, dt);
    pointer.x = damp(pointer.x, pointer.tx * interaction, 3, dt);
    pointer.y = damp(pointer.y, pointer.ty * interaction, 3, dt);
    // The cloud turns with the pointer on a heavy spring and rolls slowly as the page scrolls.
    const h = Math.min(dt, 0.033);
    // The cloud is stirred, not steered: moving the pointer pushes it round like a hand through water.
    // It takes the push slowly, keeps turning for a while and coasts to a stop. Nothing pulls it back.
    const push = 1 - Math.exp(-1.6 * h);
    cloudSpin.vy += ((pointer.x - pointerWas.x) / h * 0.55 - cloudSpin.vy) * push;
    cloudSpin.vx += (-(pointer.y - pointerWas.y) / h * 0.3 - cloudSpin.vx) * push;
    const coast = Math.exp(-0.5 * h);
    cloudSpin.vy *= coast;
    cloudSpin.vx *= coast;
    cloudSpin.y += cloudSpin.vy * h;
    cloudSpin.x = THREE.MathUtils.clamp(cloudSpin.x + cloudSpin.vx * h, -0.6, 0.6);
    cloudRig.rotation.set(cloudSpin.x, cloudSpin.y + u * 0.14, 0);
    cloudGlow.vx += ((pointer.x - cloudGlow.x) * 9 - cloudGlow.vx * 6.6) * h;
    cloudGlow.vy += ((pointer.y - cloudGlow.y) * 9 - cloudGlow.vy * 6.6) * h;
    cloudGlow.x += cloudGlow.vx * h;
    cloudGlow.y += cloudGlow.vy * h;
    pointerVel.x = damp(pointerVel.x, (pointer.x - pointerWas.x) / h, 6, h);
    pointerVel.y = damp(pointerVel.y, (pointer.y - pointerWas.y) / h, 6, h);
    pointerWas.x = pointer.x;
    pointerWas.y = pointer.y;
    cloud.uniforms.uGlow.value.set(cloudGlow.x, cloudGlow.y);
    cloud.uniforms.uVel.value.set(THREE.MathUtils.clamp(pointerVel.x, -2, 2) * 0.3, THREE.MathUtils.clamp(pointerVel.y, -2, 2) * 0.3);
    cloud.uniforms.uTime.value = reduced ? 0 : time * 0.45;
    cloud.uniforms.uAspect.value = width / height;
    cloud.uniforms.uSize.value = (width > height ? 1.5 : 1.15) * dpr;
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
    const targetA = b >= 0 ? rtA2 : rtA;
    renderAct(a, u, time, dt, velocity, targetA);
    if (b >= 0) renderAct(b, u, time, dt, velocity, rtB2);
    composite.uniforms.tA.value = targetA.texture;
    composite.uniforms.tB.value = rtB2.texture;
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
