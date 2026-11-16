import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { type Act, type Ctx, clamp01, damp, lerp, smooth } from "../stage";
import { asset, loadBinary } from "../paths";

// Act 2 — a modelled snowboard carve. There is no snow capture in the repo yet, so nothing here is a
// measurement: the capture's bone model is posed by code and every figure follows from the two stated inputs
// (speed and arc), by ordinary turn mechanics. Replace with a reconstructed capture when one exists.
export const SKI = { speed: 15, wavelength: 40, amplitude: 2.25, g: 9.81 };
const K = (2 * Math.PI) / SKI.wavelength;
/** Peak values of the modelled turn, for the copy. */
export function skiPeak() {
  const curvature = SKI.amplitude * K * K;
  const lateral = SKI.speed * SKI.speed * curvature;
  return {
    kmh: SKI.speed * 3.6,
    radius: 1 / curvature,
    lean: (Math.atan(lateral / SKI.g) * 180) / Math.PI,
    load: Math.hypot(SKI.g, lateral) / SKI.g,
  };
}

const BONE = 0xd4d8e6;

// Camera set-ups, as offsets from the rider: three-quarter front, low beside the board, low and close in
// front, high overhead, the far side, a chase from behind, and a wide pull-out.
const SHOTS: [number, number, number][] = [
  [2.2, 0.9, -3.8],
  [4.6, 0.55, -0.9],
  [2.2, 0.4, -4.0],
  [0.4, 5.6, 2.2],
  [-2.8, 0.7, -2.6],
  [-0.6, 1.5, 4.2],
  [-3.4, 2.6, -5.6],
];

export function createSki(onValues: (v: { kmh: number; radius: number; lean: number; load: number }) => void): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x14303a, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-3, 6, 4);
  scene.add(sun);

  // The slope: everything lives in a tilted frame, x across the hill, -z down it.
  const slope = new THREE.Group();
  slope.rotation.x = 0.3;
  scene.add(slope);

  const path = (s: number, out = new THREE.Vector3()) => out.set(SKI.amplitude * Math.sin(K * s), 0, -s);

  // Snow as a field of dots with long rolls in it, plus the carved line and a gate at each apex.
  const dots: number[] = [];
  for (let x = -40; x <= 40; x += 1) for (let z = -10; z <= 190; z += 1) dots.push(x * 0.55, 0, -z * 0.55);
  const snow = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(dots), 3)),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uAt: { value: new THREE.Vector3() } },
      vertexShader: `uniform vec3 uAt; varying float vA; void main(){ vec3 p = position; p.y += sin(p.x * 0.35) * 0.25 + sin(p.z * 0.21 + p.x * 0.1) * 0.3 - 0.36; vA = 1.0 - smoothstep(4.0, 24.0, length(p.xz - uAt.xz)); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 30.0 / -mv.z; }`,
      fragmentShader: `precision highp float; varying float vA; void main(){ float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vec3(0.86, 0.96, 1.0), a * vA * 0.9); }`,
    }),
  );
  snow.frustumCulled = false;
  slope.add(snow);
  const TRACK = 900;
  const trackPts = new Float32Array(TRACK * 3);
  for (let i = 0; i < TRACK; i += 1) path((i / TRACK) * 110).toArray(trackPts, i * 3);
  const track = new THREE.Line(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(trackPts, 3)),
    new THREE.LineBasicMaterial({ color: 0x7ff0d0, transparent: true, opacity: 0.9 }),
  );
  track.position.y = 0.02;
  track.frustumCulled = false;
  slope.add(track);
  // Things to ride through: a gate at every apex, hoops of light over the line, and trees built from points.
  for (let n = 0; n < 6; n += 1) {
    const s = (n + 0.5) * (SKI.wavelength / 2);
    const sideOf = Math.sin(K * s) > 0 ? 1 : -1;
    for (const [off, tall] of [[-0.75, 1.5], [-3.4, 1.5]] as const) {
      const colour = n % 2 === 0 ? 0x9b6cff : 0x39e6b0;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, tall, 8), new THREE.MeshBasicMaterial({ color: colour }));
      post.position.set(sideOf * (SKI.amplitude + off), tall / 2, -s);
      slope.add(post);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      flag.position.set(sideOf * (SKI.amplitude + off) - sideOf * 0.27, tall - 0.2, -s);
      slope.add(flag);
    }
  }
  {
    const ring: number[] = [];
    const tint: number[] = [];
    for (let n = 1; n <= 11; n += 1) {
      const s = n * 9;
      const centre = path(s);
      const dir = new THREE.Vector3(SKI.amplitude * K * Math.cos(K * s), 0, -1).normalize();
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      for (let layer = 0; layer < 3; layer += 1) {
        const radius = 1.55 + layer * 0.22;
        const count = 90 + layer * 30;
        for (let i = 0; i < count; i += 1) {
          const ang = (i / count) * Math.PI * 2;
          const p = centre.clone().addScaledVector(side, Math.cos(ang) * radius).add(new THREE.Vector3(0, 1.15 + Math.sin(ang) * radius, 0)).addScaledVector(dir, layer * 0.25);
          if (p.y < 0) continue;
          ring.push(p.x, p.y, p.z);
          tint.push(n % 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ring), 3));
    geo.setAttribute("aTint", new THREE.BufferAttribute(new Float32Array(tint), 1));
    const hoops = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aTint; varying float vT; void main(){ vT = aTint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 26.0 / -mv.z; }`,
      fragmentShader: `precision highp float; varying float vT; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(mix(vec3(0.66, 0.48, 1.0), vec3(0.25, 0.95, 0.68), vT), a * 0.8); }`,
    }));
    hoops.frustumCulled = false;
    slope.add(hoops);

    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees: number[] = [];
    for (let t = 0; t < 90; t += 1) {
      const z = -rnd() * 115;
      const x = (rnd() < 0.5 ? -1 : 1) * (5.5 + rnd() * 16);
      const h = 2.6 + rnd() * 3.2;
      for (let i = 0; i < 150; i += 1) {
        const u = Math.pow(rnd(), 0.7);
        const ang = rnd() * 6.283;
        const rad = (1 - u) * h * 0.26 * (0.5 + 0.5 * rnd());
        trees.push(x + Math.cos(ang) * rad, 0.3 + u * h, z + Math.sin(ang) * rad);
      }
    }
    const forest = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(trees), 3)),
      new THREE.PointsMaterial({ color: 0x4fd6b4, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    forest.frustumCulled = false;
    slope.add(forest);
  }


  // ---- Skeleton: the same bone model the golf capture uses, posed here by code.
  // Each rigid group is carried from its pose in the capture's first frame to the ski pose by the
  // rotation that maps one pair of directions onto another, so proportions and bone shapes are real.
  const material = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.58, metalness: 0.05 });
  const loadedMaterials = [-1, 1].map(() => new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.58, emissive: 0x000000 }));
  const skier = new THREE.Group();
  slope.add(skier);
  const Y = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();
  type Body = { node: THREE.Object3D | null; p0: THREE.Vector3; q0: THREE.Quaternion };
  const body: Record<string, Body> = {};
  const rest = {
    hipLine: new THREE.Vector3(), shoulderLine: new THREE.Vector3(), trunk: new THREE.Vector3(), shoulderMid: new THREE.Vector3(),
    foot: { r: new THREE.Vector3(), l: new THREE.Vector3() }, thigh: 0.41, shin: 0.43, upper: 0.29, fore: 0.26,
  };
  let rigged = false;
  const ready = Promise.all([
    fetch(asset("/viewer-data/golf-1872/swing-analysis.json")).then((res) => res.json()),
    loadBinary("/viewer-data/golf-1872/opensim/rajagopal-bones.glb").then((b) => new GLTFLoader().parseAsync(b, "")),
  ]).then(([json, gltf]) => {
    const names: string[] = json.skeleton.bodyNames;
    const frame: number[] = json.skeleton.frames[0];
    names.forEach((name, i) => {
      const node = gltf.scene.getObjectByName(name) ?? null;
      const leg = /_(r|l)$/.test(name) && /femur|tibia|patella/.test(name);
      node?.traverse((child) => {
        if (child instanceof THREE.Mesh) child.material = leg ? loadedMaterials[name.endsWith("_r") ? 1 : 0] : material;
      });
      body[name] = {
        node,
        p0: new THREE.Vector3(frame[i * 7], frame[i * 7 + 1], frame[i * 7 + 2]),
        q0: new THREE.Quaternion(frame[i * 7 + 3], frame[i * 7 + 4], frame[i * 7 + 5], frame[i * 7 + 6]),
      };
    });
    skier.add(gltf.scene);
    rest.hipLine.subVectors(body.femur_r.p0, body.femur_l.p0);
    rest.shoulderLine.subVectors(body.humerus_r.p0, body.humerus_l.p0);
    rest.shoulderMid.addVectors(body.humerus_r.p0, body.humerus_l.p0).multiplyScalar(0.5);
    rest.trunk.subVectors(rest.shoulderMid, body.torso.p0);
    rest.foot.r.subVectors(body.toes_r.p0, body.calcn_r.p0);
    rest.foot.l.subVectors(body.toes_l.p0, body.calcn_l.p0);
    rest.thigh = body.tibia_r.p0.distanceTo(body.femur_r.p0);
    rest.shin = body.talus_r.p0.distanceTo(body.tibia_r.p0);
    rest.upper = body.ulna_r.p0.distanceTo(body.humerus_r.p0);
    rest.fore = body.hand_r.p0.distanceTo(body.ulna_r.p0);
    rigged = true;
  });

  // Rotation taking the frame spanned by (a0, b0) onto the frame spanned by (a1, b1).
  const m0 = new THREE.Matrix4();
  const m1 = new THREE.Matrix4();
  const ex = new THREE.Vector3();
  const ey = new THREE.Vector3();
  const ez = new THREE.Vector3();
  const frameOf = (a: THREE.Vector3, b: THREE.Vector3, out: THREE.Matrix4) => {
    ex.copy(a).normalize();
    ez.crossVectors(ex, b).normalize();
    ey.crossVectors(ez, ex);
    return out.makeBasis(ex, ey, ez);
  };
  const turn = new THREE.Quaternion();
  const carry = (a0: THREE.Vector3, b0: THREE.Vector3, a1: THREE.Vector3, b1: THREE.Vector3, out: THREE.Quaternion) => {
    frameOf(a0, b0, m0);
    frameOf(a1, b1, m1);
    return out.setFromRotationMatrix(m1.multiply(m0.transpose()));
  };
  /** Move a rigid group: every listed body keeps its place relative to `anchor`, turned by `q`. */
  const setGroup = (names: string[], anchor0: THREE.Vector3, anchor1: THREE.Vector3, q: THREE.Quaternion) => {
    for (const name of names) {
      const b = body[name];
      if (!b?.node) continue;
      b.node.position.copy(b.p0).sub(anchor0).applyQuaternion(q).add(anchor1);
      b.node.quaternion.copy(q).multiply(b.q0);
    }
  };
  const carried = (p0: THREE.Vector3, anchor0: THREE.Vector3, anchor1: THREE.Vector3, q: THREE.Quaternion, out: THREE.Vector3) =>
    out.copy(p0).sub(anchor0).applyQuaternion(q).add(anchor1);

  // One board: a rounded deck, tilted onto its edge by the turn.
  const deck = new THREE.Shape();
  deck.absarc(0, 0.62, 0.135, 0, Math.PI, false);
  deck.absarc(0, -0.62, 0.135, Math.PI, Math.PI * 2, false);
  deck.closePath();
  const boardGeo = new THREE.ExtrudeGeometry(deck, { depth: 0.016, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -0.008).rotateX(-Math.PI / 2);
  const board = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ color: 0x151b28, roughness: 0.35, emissive: 0x0c2a30 }));
  board.add(new THREE.LineSegments(new THREE.EdgesGeometry(boardGeo, 30), new THREE.LineBasicMaterial({ color: 0x39e6b0 })));
  skier.add(board);

  // Ground reaction under each foot, along the line the load travels.
  const arrows = [-1, 1].map(() => {
    const arrow = new THREE.ArrowHelper(Y, new THREE.Vector3(), 1, 0x39e6b0, 0.16, 0.09);
    skier.add(arrow);
    return arrow;
  });

  // Snow thrown from the loaded edge.
  const SPRAY = 700;
  const sprayPos = new Float32Array(SPRAY * 3);
  const sprayVel = new Float32Array(SPRAY * 3);
  const sprayAge = new Float32Array(SPRAY).fill(9);
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute("position", new THREE.BufferAttribute(sprayPos, 3));
  sprayGeo.setAttribute("aAge", new THREE.BufferAttribute(sprayAge, 1));
  const spray = new THREE.Points(
    sprayGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aAge; varying float vA; void main(){ vA = clamp(1.0 - aAge / 0.9, 0.0, 1.0); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (10.0 + aAge * 40.0) / -mv.z; }`,
      fragmentShader: `precision highp float; varying float vA; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vec3(0.8, 0.95, 1.0), a * vA * 0.5); }`,
    }),
  );
  spray.frustumCulled = false;
  slope.add(spray);
  let sprayNext = 0;
  let lastS = 0;

  // Two-bone reach: where the middle joint sits between a root and a target, bent toward `pole`.
  const axis = new THREE.Vector3();
  const sideways = new THREE.Vector3();
  function bend(root: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, out: THREE.Vector3) {
    axis.subVectors(target, root);
    const d = Math.min(axis.length(), (l1 + l2) * 0.999);
    axis.normalize();
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    sideways.copy(pole).addScaledVector(axis, -pole.dot(axis)).normalize();
    out.copy(root).addScaledVector(axis, along).addScaledVector(sideways, h);
  }

  const anchors = { "ski-force": new THREE.Vector3() };
  const f = new THREE.Vector3();
  const r = new THREE.Vector3();
  const up = new THREE.Vector3();
  const trunk = new THREE.Vector3();
  const base = new THREE.Vector3();
  const pelvis = new THREE.Vector3();
  const chest = new THREE.Vector3();
  const hip = new THREE.Vector3();
  const ankle = new THREE.Vector3();
  const knee = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const hipDir = new THREE.Vector3();
  const shoulderDir = new THREE.Vector3();
  const footDir = new THREE.Vector3();
  const toeDir = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const view = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const camAt = new THREE.Vector3();
  const camPos = new THREE.Vector3(3, 3, 8);
  const want = new THREE.Vector3();
  const world = new THREE.Vector3();
  let leanNow = 0;

  const act: Act = {
    scene,
    camera,
    ready,
    offset: { x: 0.17, y: 0 },
    bg: [0x0b2230, 0x04080c, 0x0f4a52],
    tint: [0x8fe9ff, 0x39e6b0],
    anchors: () => anchors,
    update(ctx: Ctx) {
      if (!rigged) return;
      const wide = ctx.aspect > 1.05;
      act.offset!.x = wide ? 0.17 : 0;
      act.offset!.y = wide ? 0 : 0.16;
      // Scroll is distance down the hill: about two and a half turns across the act.
      const s = 8 + clamp01(ctx.t * 0.96 + 0.02) * 92;
      path(s, base);
      f.set(SKI.amplitude * K * Math.cos(K * s), 0, -1).normalize();
      r.crossVectors(f, Y).normalize();
      // Signed curvature of the line; positive means the turn centre is toward +r.
      const curvature = SKI.amplitude * K * K * Math.sin(K * s);
      const lateral = SKI.speed * SKI.speed * curvature;
      leanNow = damp(leanNow, Math.atan(lateral / SKI.g), 10, ctx.dt);
      const load = Math.hypot(SKI.g, lateral) / SKI.g;
      const inside = Math.sign(leanNow) || 1;
      up.copy(Y).applyAxisAngle(f, -leanNow); // tilt toward the inside of the turn
      if (up.dot(r) * inside < 0) up.copy(Y).applyAxisAngle(f, leanNow);
      trunk.copy(Y).lerp(up, 0.55).normalize().addScaledVector(f, 0.42).normalize(); // angulated, tipped forward

      // Riding posture, after how carving is coached: knees tracked over the toes, hips and shoulders
      // in line with the board and a little open to the nose, hands low and in front. On the toe edge
      // the hips press forward over the edge with the chest tall; on the heel edge the rider sits as if
      // into a low chair and the chest comes forward to balance. Low at the apex, taller at the change of edge.
      const apex = Math.abs(Math.sin(K * s));
      const swing = Math.sin(K * s);
      const idle = ctx.reduced ? 0 : Math.sin(ctx.time * 1.15);
      toeDir.crossVectors(f, up).normalize(); // across the tilted board, toward the toes
      const toe = smooth(-0.25, 0.25, up.dot(r)); // 1 on the toe edge, 0 on the heel edge
      const height = lerp(lerp(0.56, 0.62, toe), 0.8, 1 - apex) + idle * 0.0025;
      pelvis.copy(base).addScaledVector(up, height).addScaledVector(toeDir, lerp(-0.17, 0.1, toe) * (0.35 + 0.65 * apex));
      const open = 0.25 + swing * 0.08;
      hipDir.copy(f).multiplyScalar(-Math.cos(open)).addScaledVector(r, Math.sin(open));
      shoulderDir.copy(f).multiplyScalar(-Math.cos(open + 0.14)).addScaledVector(r, Math.sin(open + 0.14));
      facing.crossVectors(Y, shoulderDir).normalize();
      // Angulation: the trunk stays nearer to upright than the legs, shoulders close to level with the slope.
      trunk.copy(up).lerp(Y, 0.5).normalize().addScaledVector(toeDir, lerp(0.5, 0.1, toe) * (0.4 + 0.6 * apex)).normalize();
      const qPelvis = carry(rest.hipLine, rest.trunk, hipDir, tmp.copy(up).lerp(trunk, 0.5), new THREE.Quaternion());
      setGroup(["pelvis"], body.pelvis.p0, pelvis, qPelvis);
      carried(body.torso.p0, body.pelvis.p0, pelvis, qPelvis, chest); // the lumbar joint
      const qTorso = carry(rest.trunk, rest.shoulderLine, trunk, shoulderDir, new THREE.Quaternion());
      setGroup(["torso"], body.torso.p0, chest, qTorso);

      edge.crossVectors(up, f).normalize();
      basis.makeBasis(edge, up, f);
      board.position.copy(base).addScaledVector(up, 0.012);
      board.quaternion.setFromRotationMatrix(basis);

      [-1, 1].forEach((sd, i) => {
        const tag = sd > 0 ? "r" : "l";
        const along = sd > 0 ? -0.26 : 0.26; // right foot toward the tail
        // Legs: hip from the pelvis, foot strapped to the board; the knee always folds toward the toes.
        carried(body[`femur_${tag}`].p0, body.pelvis.p0, pelvis, qPelvis, hip);
        ankle.copy(base).addScaledVector(f, along).addScaledVector(up, 0.12);
        pole.copy(toeDir).addScaledVector(f, along * 0.6).addScaledVector(up, 0.3);
        bend(hip, ankle, rest.thigh, rest.shin, pole, knee);
        setGroup([`femur_${tag}`], body[`femur_${tag}`].p0, hip, carry(tmp.subVectors(body[`tibia_${tag}`].p0, body[`femur_${tag}`].p0), rest.hipLine, edge.subVectors(knee, hip), hipDir, turn));
        setGroup([`tibia_${tag}`, `patella_${tag}`], body[`tibia_${tag}`].p0, knee, carry(tmp.subVectors(body[`talus_${tag}`].p0, body[`tibia_${tag}`].p0), rest.hipLine, edge.subVectors(ankle, knee), hipDir, turn));
        footDir.copy(toeDir).addScaledVector(f, along * 0.9).normalize();
        setGroup([`talus_${tag}`, `calcn_${tag}`, `toes_${tag}`], body[`talus_${tag}`].p0, ankle, carry(rest.foot[tag as "r" | "l"], rest.hipLine, footDir, hipDir, turn));
        loadedMaterials[i].emissive.setRGB(0.04, 0.5, 0.38).multiplyScalar(clamp01((load - 1) / 0.62) * 0.8);

        // Ground reaction under each foot. Both are drawn alike: the page states the total, never a split.
        const length = Math.max(0.2, load * 0.5 * 0.95);
        tmp.copy(base).addScaledVector(f, along).addScaledVector(up, 0.03);
        arrows[i].position.copy(tmp);
        arrows[i].setDirection(up);
        arrows[i].setLength(length, 0.16, 0.09);
        if (sd < 0) anchors["ski-force"].copy(tmp).addScaledVector(up, length);

        // Arms balance the rider: out along the board, the leading one toward the nose and the trailing one
        // toward the tail, held below shoulder height with soft elbows. They see-saw against the lean, the
        // outside arm lifting as the body tips in, and spread a little wider at the apex.
        carried(body[`humerus_${tag}`].p0, body.torso.p0, chest, qTorso, shoulder);
        // Balance is driven by the scroll pose. At rest only the shared tiny breathing lift remains.
        const fidget = 0;
        const seesaw = -sd * swing * 0.32;
        const reach = Math.cos(K * s) * 0.16; // fastest change of lean: arms sweep to catch it
        hand.copy(shoulder)
          .addScaledVector(shoulderDir, sd * (0.4 + 0.08 * apex + fidget * 0.5))
          .addScaledVector(Y, -0.12 + seesaw + fidget)
          .addScaledVector(facing, 0.12 + sd * reach);
        pole.copy(Y).multiplyScalar(-1).addScaledVector(facing, -0.5).addScaledVector(shoulderDir, sd * 0.2);
        bend(shoulder, hand, rest.upper, rest.fore, pole, elbow);
        setGroup([`humerus_${tag}`], body[`humerus_${tag}`].p0, shoulder, carry(tmp.subVectors(body[`ulna_${tag}`].p0, body[`humerus_${tag}`].p0), rest.shoulderLine, edge.subVectors(elbow, shoulder), shoulderDir, turn));
        setGroup([`ulna_${tag}`, `radius_${tag}`, `hand_${tag}`], body[`ulna_${tag}`].p0, elbow, carry(tmp.subVectors(body[`hand_${tag}`].p0, body[`ulna_${tag}`].p0), rest.shoulderLine, edge.subVectors(hand, elbow), shoulderDir, turn));
      });

      // Spray off the working edge, more of it the harder the turn.
      const moved = Math.abs(s - lastS);
      lastS = s;
      const emit = ctx.reduced ? 0 : Math.min(14, Math.round(moved * 16 * Math.abs(Math.sin(leanNow))));
      for (let n = 0; n < emit; n += 1) {
        const i = sprayNext;
        sprayNext = (sprayNext + 1) % SPRAY;
        tmp.copy(base).addScaledVector(r, inside * 0.12).addScaledVector(f, (Math.random() - 0.5) * 1.3).toArray(sprayPos, i * 3);
        sprayVel[i * 3] = -inside * r.x * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 0.6;
        sprayVel[i * 3 + 1] = 0.8 + Math.random() * 1.6;
        sprayVel[i * 3 + 2] = -inside * r.z * (1.2 + Math.random() * 2) + 1.5;
        sprayAge[i] = 0;
      }
      for (let i = 0; i < SPRAY; i += 1) {
        if (sprayAge[i] > 1) continue;
        sprayAge[i] += ctx.dt;
        sprayVel[i * 3 + 1] -= 3.2 * ctx.dt;
        sprayPos[i * 3] += sprayVel[i * 3] * ctx.dt;
        sprayPos[i * 3 + 1] = Math.max(0, sprayPos[i * 3 + 1] + sprayVel[i * 3 + 1] * ctx.dt);
        sprayPos[i * 3 + 2] += sprayVel[i * 3 + 2] * ctx.dt;
      }
      sprayGeo.attributes.position.needsUpdate = true;
      sprayGeo.attributes.aAge.needsUpdate = true;
      (snow.material as THREE.ShaderMaterial).uniforms.uAt.value.copy(base);
      track.geometry.setDrawRange(0, Math.floor((s / 110) * TRACK));

      const c = Math.abs(curvature);
      onValues({ kmh: SKI.speed * 3.6, radius: c > 0.004 ? 1 / c : Infinity, lean: (Math.abs(leanNow) * 180) / Math.PI, load });

      // Camera: one continuous move through seven set-ups across the act, relative to the rider.
      const ft = clamp01(ctx.t) * (SHOTS.length - 1);
      const i0 = Math.min(Math.floor(ft), SHOTS.length - 2);
      const mixShot = smooth(0.12, 0.88, ft - i0);
      want.fromArray(SHOTS[i0]).lerp(view.fromArray(SHOTS[i0 + 1]), mixShot);
      slope.updateMatrixWorld(true);
      world.copy(pelvis).applyMatrix4(slope.matrixWorld);
      if (!wide) want.multiplyScalar(1.5);
      want.add(world);
      camPos.x = damp(camPos.x, want.x, 4, ctx.dt);
      camPos.y = damp(camPos.y, want.y, 4, ctx.dt);
      camPos.z = damp(camPos.z, want.z, 4, ctx.dt);
      camAt.copy(world);
      camAt.y -= 0.1;
      camera.position.copy(camPos);
      camera.position.x += ctx.pointer.x * 0.3;
      camera.lookAt(camAt);
    },
  };
  return act;
}
