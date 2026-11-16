import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
    start: number; end: number; bones?: string[]; group?: string | null;
    metric: { value: string; caption: string };
    goal?: { value: number; label: string };
  }[];
  muscleGroups: { id: string; label: string; muscles: string[] }[];
  skeleton: {
    boneModelUrl: string; toSurfaceAxes: number[][]; scaleToSurface: number; ground: number;
    bodyNames: string[]; frames: number[][]; muscleNames: string[]; muscles: number[][][][]; club: number[][];
  };
  surface: {
    vertexCount: number; facesUrl: string; verticesUrl: string;
    quantisation: { offset: number[]; scale: number[] };
    ground: number; forward: number[]; target: number[]; ball: number[]; club: number[][];
  };
};

const DATA_URL = "/viewer-data/golf-1872/swing-analysis.json";
const BODY_POINTS = 15000;
const SEPARATION = 1.25; // metres between the surface figure and the skeleton
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
    vLight = 0.34 + 0.6 * pow(1.0 - facing, 2.0) + 0.26 * max(dot(n, normalize(vec3(0.4, 0.8, 0.5))), 0.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, uSize * (0.7 + 0.4 * aSeed) * (4.2 / -mv.z));
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
export function createSwing(
  onData: (d: SwingData) => void,
  onFrame: (frame: number, focus: string | null, zoom: number) => void,
  getScrub: () => number | null,
): Act {
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
  // Skeleton: its own reconstruction, so it stands beside the surface rather than inside it.
  let boneNodes: (THREE.Object3D | null)[] = [];
  let boneMaterials: THREE.MeshStandardMaterial[] = [];
  let muscleLines: THREE.LineSegments;
  let muscleGroupOf: (string | null)[] = [];
  let skeletonClub: THREE.Line;
  const side = new THREE.Vector3();
  const figures = { "fig-surface": new THREE.Vector3(), "fig-skeleton": new THREE.Vector3(), joint: new THREE.Vector3() };
  // Each finding pushes the camera in on the joint it is about, from the angle that shows it.
  const focusFor: Record<string, { bone: string; yaw: number; dist: number; lift: number }> = {
    sway: { bone: "pelvis", yaw: 0.25, dist: 3.3, lift: 0.1 },
    "trail-knee": { bone: "tibia_r", yaw: -1.2, dist: 2.5, lift: 0.25 },
    "lead-arm": { bone: "ulna_l", yaw: 0.7, dist: 2.5, lift: 0.3 },
    "hang-back": { bone: "pelvis", yaw: -0.5, dist: 3.9, lift: 0.5 },
  };
  const camTarget = new THREE.Vector3(0, 0.86, 0);
  const bonePos = new THREE.Vector3();
  const wantTarget = new THREE.Vector3();
  let camRadius = 7;
  let camLift = 0.35;
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const BONE = new THREE.Color(0xd4d8e6);
  const BONE_LIT = new THREE.Color(0xa77bff);
  const MUSCLE = new THREE.Color(0x5a5078);
  const MUSCLE_LIT = new THREE.Color(0xb48cff);

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
      const [vb, fb, gltf] = await Promise.all([
        fetch(json.surface.verticesUrl).then((r) => r.arrayBuffer()),
        fetch(json.surface.facesUrl).then((r) => r.arrayBuffer()),
        new GLTFLoader().loadAsync(json.skeleton.boneModelUrl),
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
      bodyMaterial = makeMaterial(0xe2e6f2, 0.8, 3.4, false);
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

      // ---- Skeleton and muscle paths, mapped into the surface's axes and stood beside it.
      const sk = json.skeleton;
      const ax = sk.toSurfaceAxes;
      const k = sk.scaleToSurface;
      const opensim = new THREE.Group();
      opensim.matrixAutoUpdate = false;
      opensim.matrix.set(
        ax[0][0] * k, ax[0][1] * k, ax[0][2] * k, 0,
        ax[1][0] * k, ax[1][1] * k, ax[1][2] * k, 0,
        ax[2][0] * k, ax[2][1] * k, ax[2][2] * k, 0,
        0, 0, 0, 1,
      );
      opensim.add(gltf.scene);
      boneNodes = sk.bodyNames.map((name) => gltf.scene.getObjectByName(name) ?? null);
      boneMaterials = boneNodes.map((node) => {
        const material = new THREE.MeshStandardMaterial({ color: BONE.clone(), roughness: 0.62, metalness: 0.05, emissive: 0x000000 });
        node?.traverse((child) => {
          if (child instanceof THREE.Mesh) child.material = material;
        });
        return material;
      });
      muscleGroupOf = sk.muscleNames.map((name) => json.muscleGroups.find((g) => g.muscles.includes(name))?.id ?? null);
      const segments = sk.muscles[0].reduce((n, pts) => n + pts.length - 1, 0);
      const muscleGeometry = new THREE.BufferGeometry();
      muscleGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segments * 6), 3));
      muscleGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(segments * 6), 3));
      muscleLines = new THREE.LineSegments(muscleGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
      muscleLines.frustumCulled = false;
      opensim.add(muscleLines);
      skeletonClub = new THREE.Line(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)),
        new THREE.LineBasicMaterial({ color: 0x9b6cff, transparent: true, opacity: 0.95 }),
      );
      skeletonClub.frustumCulled = false;
      opensim.add(skeletonClub);

      const pelvisIndex = sk.bodyNames.indexOf("pelvis") * 7;
      const pelvis = new THREE.Vector3(sk.frames[0][pelvisIndex], sk.frames[0][pelvisIndex + 1], sk.frames[0][pelvisIndex + 2]).applyMatrix4(opensim.matrix);
      // Stand it along the target line, on the side away from the copy.
      side.set(json.surface.target[0], json.surface.target[1], 0).normalize().multiplyScalar(-SEPARATION);
      const skeletonRig = new THREE.Group();
      skeletonRig.add(opensim);
      skeletonRig.position.set(centre.x + side.x - pelvis.x, centre.y + side.y - pelvis.y, json.surface.ground - sk.ground * k);
      world.add(skeletonRig);
      scene.add(new THREE.HemisphereLight(0xe6e9ff, 0x2a1f4a, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(2, 4, 3);
      scene.add(key);
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
    // Last chapter: the visitor owns the clock.
    const find = ctx.local("find");
    if (find > 0) frame = getScrub() ?? lerp(data.frameCount - 1, 0, smooth(0, 0.3, find));
    return frame;
  }

  const yawFor: Record<string, number> = { "swing-intro": 0.32, sway: 0.0, "trail-knee": -0.42, "lead-arm": 0.26, "hang-back": 0.0, finish: 0.42, find: 0.0 };

  const act: Act = {
    scene,
    camera,
    ready,
    offset: { x: 0.17, y: 0 },
    bg: [0x061320, 0x04060a, 0x0a3550],
    anchors: () => figures,
    update(ctx: Ctx) {
      if (!data) return;
      const wide = ctx.aspect > 1.05;
      act.offset!.x = wide ? 0.19 : 0;
      act.offset!.y = wide ? 0 : 0.16;
      const target = frameFor(ctx);
      frameNow = damp(frameNow, target, 14, ctx.dt);
      if (Math.abs(frameNow - target) < 0.01) frameNow = target;
      writePose(frameNow);
      sampler.write(pose, bodyGeometry.attributes.position.array as Float32Array, bodyGeometry.attributes.normal.array as Float32Array);
      bodyGeometry.attributes.position.needsUpdate = true;
      bodyGeometry.attributes.normal.needsUpdate = true;
      const px = Math.min(window.devicePixelRatio || 1, 1.5);
      bodyMaterial.uniforms.uSize.value = (wide ? 3.4 : 3.0) * px;
      for (const g of ghosts) {
        g.material.uniforms.uSize.value = 2.8 * px;
        g.material.uniforms.uOpacity.value = 0.22 * smooth(2, 9, frameNow - g.frame);
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

      // Skeleton pose, muscle paths and the bones the active finding is about.
      const sk = data.skeleton;
      const s0 = Math.min(f0, sk.frames.length - 1);
      const s1 = Math.min(f1, sk.frames.length - 1);
      const fa = sk.frames[s0];
      const fbn = sk.frames[s1];
      let note: SwingData["annotations"][number] | undefined;
      for (const a of data.annotations) if (ctx.local(a.id) > 0 && ctx.local(a.id) < 1) note = a;
      const ease = 1 - Math.exp(-6 * ctx.dt);
      boneNodes.forEach((node, b) => {
        if (!node) return;
        const o = b * 7;
        node.position.set(lerp(fa[o], fbn[o], k), lerp(fa[o + 1], fbn[o + 1], k), lerp(fa[o + 2], fbn[o + 2], k));
        qa.set(fa[o + 3], fa[o + 4], fa[o + 5], fa[o + 6]);
        qb.set(fbn[o + 3], fbn[o + 4], fbn[o + 5], fbn[o + 6]);
        node.quaternion.slerpQuaternions(qa, qb, k);
        const lit = !!note?.bones?.includes(sk.bodyNames[b]);
        boneMaterials[b].color.lerp(lit ? BONE_LIT : BONE, ease);
        boneMaterials[b].emissive.lerp(lit ? new THREE.Color(0x3a1c8a) : new THREE.Color(0x000000), ease);
      });
      const mp = muscleLines.geometry.attributes.position.array as Float32Array;
      const mc = muscleLines.geometry.attributes.color.array as Float32Array;
      const ma = sk.muscles[s0];
      const mb = sk.muscles[s1];
      let w = 0;
      for (let m = 0; m < ma.length; m += 1) {
        const lit = note?.group != null && muscleGroupOf[m] === note.group;
        const c = lit ? MUSCLE_LIT : MUSCLE;
        for (let i = 0; i < ma[m].length - 1; i += 1) {
          for (const j of [i, i + 1]) {
            mp[w] = lerp(ma[m][j][0], mb[m][j][0], k);
            mp[w + 1] = lerp(ma[m][j][1], mb[m][j][1], k);
            mp[w + 2] = lerp(ma[m][j][2], mb[m][j][2], k);
            mc[w] += (c.r - mc[w]) * ease;
            mc[w + 1] += (c.g - mc[w + 1]) * ease;
            mc[w + 2] += (c.b - mc[w + 2]) * ease;
            w += 3;
          }
        }
      }
      muscleLines.geometry.attributes.position.needsUpdate = true;
      muscleLines.geometry.attributes.color.needsUpdate = true;
      const sc = skeletonClub.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < 6; i += 1) sc[i] = lerp(sk.club[s0][i], sk.club[s1][i], k);
      skeletonClub.geometry.attributes.position.needsUpdate = true;

      // Camera walks to the angle that shows the active finding.
      let wanted = yawFor["swing-intro"];
      for (const id in yawFor) if (ctx.local(id) > 0) wanted = yawFor[id];
      const intro = clamp01(ctx.local("swing-intro"));
      const finish = clamp01(ctx.local("finish"));
      let radius = (wide ? 6.8 : 12.5) - smooth(0, 1, intro) * 0.6 + smooth(0.2, 1, finish) * 0.8;
      let lift = 0.35;
      const mx = side.x * 0.5;
      const mz = -side.y * 0.5;
      wantTarget.set(mx, 0.86, mz);
      let focusId: string | null = null;
      let zoom = 0;
      if (note && focusFor[note.id]) {
        const f = focusFor[note.id];
        const c = ctx.local(note.id);
        zoom = smooth(0.4, 0.7, c) * (1 - smooth(0.92, 1.0, c));
        focusId = note.id;
        scene.updateMatrixWorld(true);
        boneNodes[sk.bodyNames.indexOf(f.bone)]?.getWorldPosition(bonePos);
        figures.joint.copy(bonePos);
        wantTarget.lerp(bonePos, zoom * 0.9);
        wanted = lerp(wanted, f.yaw, zoom);
        radius = lerp(radius, wide ? f.dist : f.dist * 1.5, zoom);
        lift = lerp(lift, f.lift, zoom);
      }
      yaw = damp(yaw, wanted, 3, ctx.dt);
      camTarget.x = damp(camTarget.x, wantTarget.x, 3.4, ctx.dt);
      camTarget.y = damp(camTarget.y, wantTarget.y, 3.4, ctx.dt);
      camTarget.z = damp(camTarget.z, wantTarget.z, 3.4, ctx.dt);
      camRadius = damp(camRadius, radius, 3.4, ctx.dt);
      camLift = damp(camLift, lift, 3, ctx.dt);
      const angle = faceAngle + yaw + ctx.pointer.x * 0.08 + (ctx.reduced ? 0 : Math.sin(ctx.time * 0.25) * 0.02);
      camera.position.set(camTarget.x + Math.sin(angle) * camRadius, camTarget.y + camLift + ctx.pointer.y * 0.15, camTarget.z + Math.cos(angle) * camRadius);
      camera.lookAt(camTarget);
      figures["fig-surface"].set(0, 0, 0);
      figures["fig-skeleton"].set(side.x, 0, -side.y);
      onFrame(frameNow, focusId, zoom);
    },
  };
  return act;
}
