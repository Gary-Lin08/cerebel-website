import * as THREE from "three";
import { createSurfaceSampler } from "../../viewer/particle-surface";
import { type Act, type Ctx, clamp01, damp, lerp, smooth } from "../stage";

export type SwingData = {
  fps: number;
  frameCount: number;
  phases: { id: string; label: string; start: number; end: number }[];
  disclosure: { badge: string; club: string; coaching: string };
  highlights: string[];
  series: { id: string; label: string; unit: string; values: number[] }[];
  annotations: {
    id: string; title: string; detail: string; hold: number; cue: string; series: string;
    start: number; end: number;
    metric: { value: string; caption: string };
    goal?: { value: number; label: string };
  }[];
  surface: {
    vertexCount: number; facesUrl: string; verticesUrl: string;
    quantisation: { offset: number[]; scale: number[] };
    ground: number; forward: number[]; ball: number[]; club: number[][];
  };
};

const DATA_URL = "/viewer-data/golf-1872/swing-analysis.json";
const BODY_POINTS = 22000;
const GHOST_POINTS = 5200;

const pointVertex = /* glsl */ `
  uniform float uSize, uOpacity, uTime;
  attribute float aSeed;
  varying float vLight; varying float vSeed;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vec3 v = normalize(-mv.xyz);
    float facing = abs(dot(n, v));
    // Rim-lit silver: edges of the body glow, faces stay quiet.
    vLight = 0.25 + 0.75 * pow(1.0 - facing, 1.6) + 0.25 * max(dot(n, normalize(vec3(0.4, 0.8, 0.5))), 0.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, uSize * (0.75 + 0.5 * aSeed) * (4.2 / -mv.z));
    vSeed = aSeed;
  }`;
const pointFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor; uniform float uOpacity;
  varying float vLight; varying float vSeed;
  void main(){
    vec2 q = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.12, length(q));
    gl_FragColor = vec4(uColor * vLight, a * uOpacity);
  }`;

// Act 1 — the team's own 60 fps golf capture. Scroll is the clock.
export function createSwing(onData: (d: SwingData) => void, onFrame: (frame: number) => void): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  // The capture is z-up; stand it up in three's y-up world.
  const world = new THREE.Group();
  world.rotation.x = -Math.PI / 2;
  scene.add(world);

  let data: SwingData | null = null;
  let vertices: Float32Array;
  let pose: Float32Array;
  let stride = 0;
  let sampler: ReturnType<typeof createSurfaceSampler>;
  let bodyGeometry: THREE.BufferGeometry;
  let bodyMaterial: THREE.ShaderMaterial;
  const ghosts: { frame: number; material: THREE.ShaderMaterial }[] = [];
  let clubLine: THREE.Line;
  let trail: THREE.Line;
  let trailGlow: THREE.Points;
  const centre = new THREE.Vector3();
  let faceAngle = 0;
  let yaw = 0.5;
  let frameNow = 0;

  const makeMaterial = (color: number, opacity: number, size: number, additive = true) =>
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uSize: { value: size }, uTime: { value: 0 } },
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

  function writePose(frame: number) {
    const f0 = Math.floor(frame);
    const f1 = Math.min(f0 + 1, data!.frameCount - 1);
    const k = frame - f0;
    const a = f0 * stride;
    const b = f1 * stride;
    for (let i = 0; i < stride; i += 1) pose[i] = vertices[a + i] + (vertices[b + i] - vertices[a + i]) * k;
  }

  const ready = fetch(DATA_URL)
    .then((r) => r.json())
    .then(async (json: SwingData) => {
      const [vb, fb] = await Promise.all([
        fetch(json.surface.verticesUrl).then((r) => r.arrayBuffer()),
        fetch(json.surface.facesUrl).then((r) => r.arrayBuffer()),
      ]);
      const packed = new Int16Array(vb);
      const { offset, scale } = json.surface.quantisation;
      vertices = new Float32Array(packed.length);
      for (let i = 0; i < packed.length; i += 1) vertices[i] = (packed[i] + 32768) * scale[i % 3] + offset[i % 3];
      const faces = new Uint32Array(fb);
      stride = json.surface.vertexCount * 3;
      pose = new Float32Array(stride);
      data = json;

      for (let v = 0; v < stride; v += 3) centre.add(new THREE.Vector3(vertices[v], vertices[v + 1], vertices[v + 2]));
      centre.multiplyScalar(3 / stride);
      world.position.set(-centre.x, -json.surface.ground, centre.y);
      faceAngle = Math.atan2(json.surface.forward[0], -json.surface.forward[1]);

      sampler = createSurfaceSampler(vertices.subarray(0, stride), faces, BODY_POINTS);
      bodyGeometry = new THREE.BufferGeometry();
      bodyGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BODY_POINTS * 3), 3));
      bodyGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(BODY_POINTS * 3), 3));
      bodyGeometry.setAttribute("aSeed", new THREE.BufferAttribute(sampler.seeds, 1));
      bodyGeometry.boundingSphere = new THREE.Sphere(centre.clone(), 5);
      bodyMaterial = makeMaterial(0xdfe4f2, 0.9, 5);
      world.add(new THREE.Points(bodyGeometry, bodyMaterial));

      // Earlier poses stay behind as violet exposures: address, top, impact.
      const top = json.phases.find((p) => p.id === "top")?.start ?? 62;
      const impact = json.phases.find((p) => p.id === "impact")?.start ?? 77;
      for (const frame of [0, top, impact + 1]) {
        const g = new THREE.BufferGeometry();
        const positions = new Float32Array(GHOST_POINTS * 3);
        const normals = new Float32Array(GHOST_POINTS * 3);
        sampler.write(vertices.subarray(frame * stride, (frame + 1) * stride), positions, normals, GHOST_POINTS);
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
        g.setAttribute("aSeed", new THREE.BufferAttribute(sampler.seeds.subarray(0, GHOST_POINTS), 1));
        g.boundingSphere = bodyGeometry.boundingSphere;
        const material = makeMaterial(0x8552ff, 0, 4);
        world.add(new THREE.Points(g, material));
        ghosts.push({ frame, material });
      }

      // Estimated club and the path of its head.
      const club = json.surface.club;
      clubLine = new THREE.Line(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)),
        new THREE.LineBasicMaterial({ color: 0x9b6cff, transparent: true, opacity: 0.95 }),
      );
      clubLine.frustumCulled = false;
      world.add(clubLine);
      const SUB = 6;
      const path: number[] = [];
      for (let i = 0; i < club.length - 1; i += 1) {
        for (let s = 0; s < SUB; s += 1) {
          const k = s / SUB;
          path.push(lerp(club[i][3], club[i + 1][3], k), lerp(club[i][4], club[i + 1][4], k), lerp(club[i][5], club[i + 1][5], k));
        }
      }
      const pathAttr = new THREE.BufferAttribute(new Float32Array(path), 3);
      trail = new THREE.Line(
        new THREE.BufferGeometry().setAttribute("position", pathAttr),
        new THREE.LineBasicMaterial({ color: 0xb79bff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }),
      );
      trail.frustumCulled = false;
      world.add(trail);
      trailGlow = new THREE.Points(
        new THREE.BufferGeometry().setAttribute("position", pathAttr),
        new THREE.PointsMaterial({ color: 0x8552ff, size: 0.035, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      trailGlow.frustumCulled = false;
      world.add(trailGlow);

      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0213, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf2f4fa }));
      ball.position.fromArray(json.surface.ball);
      world.add(ball);

      // A floor of dots, fading with distance from the player.
      const dots: number[] = [];
      for (let x = -24; x <= 24; x += 1) {
        for (let y = -24; y <= 24; y += 1) dots.push(centre.x + x * 0.22, centre.y + y * 0.22, json.surface.ground);
      }
      const floor = new THREE.Points(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(dots), 3)),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { uCentre: { value: new THREE.Vector2(centre.x, centre.y) } },
          vertexShader: `uniform vec2 uCentre; varying float vA; void main(){ vA = 1.0 - smoothstep(0.6, 5.0, length(position.xy - uCentre)); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 9.0 / -mv.z; }`,
          fragmentShader: `precision highp float; varying float vA; void main(){ float a = smoothstep(0.5, 0.2, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vec3(0.62, 0.6, 0.8), a * vA * 0.5); }`,
        }),
      );
      world.add(floor);
      onData(json);
    });

  // Scroll → frame. Each finding travels to its most extreme frame, then holds there.
  function frameFor(ctx: Ctx) {
    if (!data) return 0;
    const hold = (id: string) => data!.annotations.find((a) => a.id === id)?.hold ?? 0;
    const stops: [string, number, number][] = [
      ["sway", 0, hold("sway")],
      ["trail-knee", hold("sway"), hold("trail-knee")],
      ["lead-arm", hold("trail-knee"), hold("lead-arm")],
      ["hang-back", hold("lead-arm"), hold("hang-back")],
      ["finish", hold("hang-back"), data.frameCount - 1],
    ];
    let frame = 0;
    for (const [id, from, to] of stops) {
      const c = ctx.local(id);
      if (c <= 0) break;
      frame = lerp(from, to, smooth(0, 0.55, c));
    }
    return frame;
  }

  const yawFor: Record<string, number> = { "swing-intro": 0.55, sway: 0.0, "trail-knee": -0.75, "lead-arm": 0.35, "hang-back": 0.0, finish: 0.8 };

  const act: Act = {
    scene,
    camera,
    ready,
    offset: { x: 0.17, y: 0 },
    update(ctx: Ctx) {
      if (!data) return;
      const wide = ctx.aspect > 1.05;
      act.offset!.x = wide ? 0.17 : 0;
      act.offset!.y = wide ? 0 : 0.16;
      const target = frameFor(ctx);
      frameNow = damp(frameNow, target, 14, ctx.dt);
      if (Math.abs(frameNow - target) < 0.01) frameNow = target;
      writePose(frameNow);
      sampler.write(pose, bodyGeometry.attributes.position.array as Float32Array, bodyGeometry.attributes.normal.array as Float32Array);
      bodyGeometry.attributes.position.needsUpdate = true;
      bodyGeometry.attributes.normal.needsUpdate = true;
      const px = Math.min(window.devicePixelRatio || 1, 1.5);
      bodyMaterial.uniforms.uSize.value = (wide ? 5.2 : 4.2) * px;
      for (const g of ghosts) {
        g.material.uniforms.uSize.value = 4.2 * px;
        g.material.uniforms.uOpacity.value = 0.36 * smooth(2, 9, frameNow - g.frame);
      }

      const club = data.surface.club;
      const f0 = Math.floor(frameNow);
      const f1 = Math.min(f0 + 1, club.length - 1);
      const k = frameNow - f0;
      const cp = clubLine.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < 6; i += 1) cp[i] = lerp(club[f0][i], club[f1][i], k);
      clubLine.geometry.attributes.position.needsUpdate = true;
      const drawn = Math.max(0, Math.round(frameNow * 6));
      trail.geometry.setDrawRange(0, drawn);
      trailGlow.geometry.setDrawRange(0, drawn);

      // Camera walks to the angle that shows the active finding.
      let wanted = yawFor["swing-intro"];
      for (const id in yawFor) if (ctx.local(id) > 0) wanted = yawFor[id];
      yaw = damp(yaw, wanted, 2.2, ctx.dt);
      const intro = clamp01(ctx.local("swing-intro"));
      const finish = clamp01(ctx.local("finish"));
      const radius = (wide ? 6.0 : 8.4) - smooth(0, 1, intro) * 0.8 + smooth(0.2, 1, finish) * 1.2;
      const angle = faceAngle + yaw + ctx.pointer.x * 0.1 + (ctx.reduced ? 0 : Math.sin(ctx.time * 0.25) * 0.03);
      const lookY = 0.86;
      camera.position.set(Math.sin(angle) * radius, lookY + 0.35 + ctx.pointer.y * 0.2, Math.cos(angle) * radius);
      camera.lookAt(0, lookY, 0);
      onFrame(frameNow);
    },
  };
  return act;
}
