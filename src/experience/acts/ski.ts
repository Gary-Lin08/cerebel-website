import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { type Act, type Ctx, clamp01, damp, lerp, smooth } from "../stage";

// Act 2 — a modelled carving turn. There is no ski capture in the repo yet, so nothing here is a
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
  for (let n = 0; n < 6; n += 1) {
    const s = (n + 0.5) * (SKI.wavelength / 2);
    const sideOf = n % 2 === 0 ? 1 : -1;
    const gate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8),
      new THREE.MeshBasicMaterial({ color: sideOf > 0 ? 0x9b6cff : 0x39e6b0 }),
    );
    gate.position.set(sideOf * (SKI.amplitude + 0.9), 0.75, -s);
    slope.add(gate);
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
    fetch("/viewer-data/golf-1872/swing-analysis.json").then((res) => res.json()),
    new GLTFLoader().loadAsync("/viewer-data/golf-1872/opensim/rajagopal-bones.glb"),
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

  const skiMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.4, emissive: 0x0c2a30 });
  const skis = [-1, 1].map(() => {
    const ski = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.012, 1.7), skiMaterial);
    skier.add(ski);
    return ski;
  });
  const poles = [-1, 1].map(() => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)),
      new THREE.LineBasicMaterial({ color: 0x9aa4b8 }),
    );
    line.frustumCulled = false;
    skier.add(line);
    return line;
  });
  // Ground reaction, drawn from each ski along the line the load travels.
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

      // Pelvis and trunk.
      const crouch = 0.8 - 0.1 * Math.abs(Math.sin(leanNow));
      pelvis.copy(base).addScaledVector(up, crouch).addScaledVector(f, -0.08);
      const qPelvis = carry(rest.hipLine, rest.trunk, r, tmp.copy(up).addScaledVector(f, 0.2), new THREE.Quaternion());
      setGroup(["pelvis"], body.pelvis.p0, pelvis, qPelvis);
      carried(body.torso.p0, body.pelvis.p0, pelvis, qPelvis, chest); // the lumbar joint
      const qTorso = carry(rest.trunk, rest.shoulderLine, trunk, r, new THREE.Quaternion());
      setGroup(["torso"], body.torso.p0, chest, qTorso);

      [-1, 1].forEach((sd, i) => {
        const tag = sd > 0 ? "r" : "l";
        const outside = sd !== inside;
        // Legs: the hip comes from the pelvis, the ankle from the ski; the knee is solved between them.
        carried(body[`femur_${tag}`].p0, body.pelvis.p0, pelvis, qPelvis, hip);
        ankle.copy(base).addScaledVector(r, sd * 0.19).addScaledVector(f, outside ? -0.12 : 0.2).addScaledVector(up, 0.11);
        bend(hip, ankle, rest.thigh, rest.shin, f, knee);
        setGroup([`femur_${tag}`], body[`femur_${tag}`].p0, hip, carry(tmp.subVectors(body[`tibia_${tag}`].p0, body[`femur_${tag}`].p0), rest.hipLine, edge.subVectors(knee, hip), r, turn));
        setGroup([`tibia_${tag}`, `patella_${tag}`], body[`tibia_${tag}`].p0, knee, carry(tmp.subVectors(body[`talus_${tag}`].p0, body[`tibia_${tag}`].p0), rest.hipLine, edge.subVectors(ankle, knee), r, turn));
        setGroup([`talus_${tag}`, `calcn_${tag}`, `toes_${tag}`], body[`talus_${tag}`].p0, ankle, carry(rest.foot[tag as "r" | "l"], rest.hipLine, f, r, turn));
        loadedMaterials[i].emissive.setRGB(0.04, 0.5, 0.38).multiplyScalar(clamp01((load - 1) / 0.62) * (outside ? 0.9 : 0.3));

        const ski = skis[i];
        ski.position.copy(ankle).addScaledVector(up, -0.12).addScaledVector(f, 0.14);
        edge.crossVectors(up, f).normalize();
        basis.makeBasis(edge, up, f);
        ski.quaternion.setFromRotationMatrix(basis);
        // Drawn share only: the page states the total, never a split.
        const length = Math.max(0.2, load * (outside ? 0.7 : 0.3) * 0.95);
        arrows[i].position.copy(ski.position);
        arrows[i].setDirection(up);
        arrows[i].setLength(length, 0.16, 0.09);
        if (outside) anchors["ski-force"].copy(ski.position).addScaledVector(up, length);

        // Arms: shoulder from the trunk, hands held forward and wide, elbow solved.
        carried(body[`humerus_${tag}`].p0, body.torso.p0, chest, qTorso, shoulder);
        hand.copy(shoulder).addScaledVector(f, 0.34).addScaledVector(Y, -0.26).addScaledVector(r, sd * 0.2);
        pole.copy(r).multiplyScalar(sd).addScaledVector(f, -0.7).addScaledVector(Y, -0.3);
        bend(shoulder, hand, rest.upper, rest.fore, pole, elbow);
        setGroup([`humerus_${tag}`], body[`humerus_${tag}`].p0, shoulder, carry(tmp.subVectors(body[`ulna_${tag}`].p0, body[`humerus_${tag}`].p0), rest.shoulderLine, edge.subVectors(elbow, shoulder), r, turn));
        setGroup([`ulna_${tag}`, `radius_${tag}`, `hand_${tag}`], body[`ulna_${tag}`].p0, elbow, carry(tmp.subVectors(body[`hand_${tag}`].p0, body[`ulna_${tag}`].p0), rest.shoulderLine, edge.subVectors(hand, elbow), r, turn));
        const pp = poles[i].geometry.attributes.position.array as Float32Array;
        hand.toArray(pp, 0);
        tmp.copy(hand).addScaledVector(f, -0.8).addScaledVector(Y, -0.5).addScaledVector(r, sd * 0.1).toArray(pp, 3);
        poles[i].geometry.attributes.position.needsUpdate = true;
      });

      // Spray from the outside edge, more of it the harder the turn.
      const moved = Math.abs(s - lastS);
      lastS = s;
      const emit = ctx.reduced ? 0 : Math.min(14, Math.round(moved * 16 * Math.abs(Math.sin(leanNow))));
      for (let n = 0; n < emit; n += 1) {
        const i = sprayNext;
        sprayNext = (sprayNext + 1) % SPRAY;
        tmp.copy(base).addScaledVector(r, -inside * 0.24).addScaledVector(f, (Math.random() - 0.7) * 0.9).toArray(sprayPos, i * 3);
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

      // Camera: a wide three-quarter, then low beside the loaded leg, then high behind to read the line.
      const a = smooth(0.1, 0.6, ctx.local("ski-load")) * (1 - smooth(0.0, 0.5, ctx.local("ski-edge")));
      const b = smooth(0.0, 0.6, ctx.local("ski-edge"));
      slope.updateMatrixWorld(true);
      world.copy(pelvis).applyMatrix4(slope.matrixWorld);
      want.set(lerp(lerp(1.9, 2.8, a), -0.7, b), lerp(lerp(0.7, 0.5, a), 2.2, b), lerp(lerp(-3.4, -4.2, a), 3.7, b));
      if (!wide) want.multiplyScalar(1.5);
      want.add(world);
      camPos.x = damp(camPos.x, want.x, 4, ctx.dt);
      camPos.y = damp(camPos.y, want.y, 4, ctx.dt);
      camPos.z = damp(camPos.z, want.z, 4, ctx.dt);
      camAt.copy(world);
      camAt.y -= lerp(0.05, 0.2, a);
      camera.position.copy(camPos);
      camera.position.x += ctx.pointer.x * 0.3;
      camera.lookAt(camAt);
    },
  };
  return act;
}
