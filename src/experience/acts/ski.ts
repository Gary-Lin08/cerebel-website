import * as THREE from "three";
import { type Act, type Ctx, clamp01, damp, lerp, smooth } from "../stage";

// Act 2 — a modelled carving turn. There is no ski capture in the repo yet, so nothing here is a
// measurement: the skeleton is built in code and every figure follows from the two stated inputs
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
const Z = new THREE.Vector3(0, 0, 1);

function boneGeometry() {
  // A long bone: a shaft that swells into a head at each end.
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const e = Math.abs(t - 0.5) * 2;
    pts.push(new THREE.Vector2(0.36 + 0.64 * Math.pow(e, 3.2) * (1 - 0.55 * Math.pow(e, 14)), t));
  }
  return new THREE.LatheGeometry(pts, 10);
}

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

  // ---- Skeleton, modelled in code.
  const material = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.6, metalness: 0.05 });
  const loaded = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.6, emissive: 0x000000 });
  const long = boneGeometry();
  const ball = new THREE.SphereGeometry(1, 14, 10);
  const skier = new THREE.Group();
  slope.add(skier);
  const Y = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();
  type Seg = { mesh: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; r: number };
  const seg = (r: number, mat = material) => {
    const s: Seg = { mesh: new THREE.Mesh(long, mat), a: new THREE.Vector3(), b: new THREE.Vector3(), r };
    skier.add(s.mesh);
    return s;
  };
  const place = (s: Seg) => {
    const len = tmp.subVectors(s.b, s.a).length();
    s.mesh.position.copy(s.a);
    s.mesh.quaternion.setFromUnitVectors(Y, tmp.normalize());
    s.mesh.scale.set(s.r, len, s.r);
  };
  const legs = [-1, 1].map(() => ({ thigh: seg(0.045, loaded), shin: seg(0.038, loaded), foot: seg(0.03) }));
  const arms = [-1, 1].map(() => ({ upper: seg(0.03), fore: seg(0.026) }));
  const spine = seg(0.04);
  const neck = seg(0.03);
  const clavicle = seg(0.022);
  const hipBar = seg(0.05);
  const skull = new THREE.Mesh(ball, material);
  skier.add(skull);
  const ribs = Array.from({ length: 6 }, (_, i) => {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 22), material);
    rib.userData.t = i / 5;
    skier.add(rib);
    return rib;
  });
  const pelvisRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 8, 20), material);
  skier.add(pelvisRing);
  const joints = Array.from({ length: 4 }, () => {
    const j = new THREE.Mesh(ball, loaded);
    skier.add(j);
    return j;
  });
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
    ready: Promise.resolve(),
    offset: { x: 0.17, y: 0 },
    bg: [0x0b2230, 0x04080c, 0x0f4a52],
    anchors: () => anchors,
    update(ctx: Ctx) {
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

      const crouch = 0.74 - 0.1 * Math.abs(Math.sin(leanNow));
      pelvis.copy(base).addScaledVector(up, crouch).addScaledVector(f, -0.06);
      chest.copy(pelvis).addScaledVector(trunk, 0.5);
      hipBar.a.copy(pelvis).addScaledVector(r, -0.13);
      hipBar.b.copy(pelvis).addScaledVector(r, 0.13);
      place(hipBar);
      pelvisRing.position.copy(pelvis);
      pelvisRing.quaternion.setFromUnitVectors(Z, up);
      pelvisRing.scale.set(0.13, 0.09, 0.08);
      spine.a.copy(pelvis);
      spine.b.copy(chest);
      place(spine);
      for (const rib of ribs) {
        rib.position.copy(pelvis).addScaledVector(trunk, 0.2 + rib.userData.t * 0.3);
        rib.quaternion.setFromUnitVectors(Z, trunk);
        const w = 0.13 + 0.04 * Math.sin(rib.userData.t * Math.PI);
        rib.scale.set(w, w * 0.72, w);
      }
      neck.a.copy(chest);
      neck.b.copy(chest).addScaledVector(trunk, 0.14);
      place(neck);
      skull.position.copy(neck.b).addScaledVector(trunk, 0.1);
      skull.scale.set(0.1, 0.12, 0.11);
      clavicle.a.copy(chest).addScaledVector(r, -0.19);
      clavicle.b.copy(chest).addScaledVector(r, 0.19);
      place(clavicle);

      [-1, 1].forEach((sd, i) => {
        const outside = sd !== inside;
        // The inside ski rides further forward and its leg folds more.
        ankle.copy(base).addScaledVector(r, sd * 0.2).addScaledVector(f, outside ? -0.1 : 0.16).addScaledVector(up, 0.1);
        hip.copy(pelvis).addScaledVector(r, sd * 0.12);
        bend(hip, ankle, 0.44, 0.44, f, knee);
        const leg = legs[i];
        leg.thigh.a.copy(hip);
        leg.thigh.b.copy(knee);
        place(leg.thigh);
        leg.shin.a.copy(knee);
        leg.shin.b.copy(ankle);
        place(leg.shin);
        leg.foot.a.copy(ankle);
        leg.foot.b.copy(ankle).addScaledVector(f, 0.2).addScaledVector(up, -0.06);
        place(leg.foot);
        joints[i].position.copy(knee);
        joints[i].scale.setScalar(0.05);
        joints[i + 2].position.copy(hip);
        joints[i + 2].scale.setScalar(0.055);
        const ski = skis[i];
        ski.position.copy(ankle).addScaledVector(up, -0.1).addScaledVector(f, 0.12);
        edge.crossVectors(up, f).normalize();
        basis.makeBasis(edge, up, f);
        ski.quaternion.setFromRotationMatrix(basis);
        // Drawn share only: the page states the total, never a split.
        const length = Math.max(0.2, load * (outside ? 0.7 : 0.3) * 0.95);
        arrows[i].position.copy(ski.position);
        arrows[i].setDirection(up);
        arrows[i].setLength(length, 0.16, 0.09);
        if (outside) anchors["ski-force"].copy(ski.position).addScaledVector(up, length);

        shoulder.copy(chest).addScaledVector(r, sd * 0.2);
        hand.copy(shoulder).addScaledVector(f, 0.36).addScaledVector(trunk, -0.3).addScaledVector(r, sd * 0.2);
        pole.copy(r).multiplyScalar(sd).addScaledVector(f, -0.6);
        bend(shoulder, hand, 0.29, 0.27, pole, elbow);
        arms[i].upper.a.copy(shoulder);
        arms[i].upper.b.copy(elbow);
        place(arms[i].upper);
        arms[i].fore.a.copy(elbow);
        arms[i].fore.b.copy(hand);
        place(arms[i].fore);
        const pp = poles[i].geometry.attributes.position.array as Float32Array;
        hand.toArray(pp, 0);
        tmp.copy(hand).addScaledVector(f, -0.75).addScaledVector(Y, -0.42).addScaledVector(r, sd * 0.12).toArray(pp, 3);
        poles[i].geometry.attributes.position.needsUpdate = true;
      });
      // The loaded bones warm with the load.
      loaded.emissive.setRGB(0.05, 0.42, 0.34).multiplyScalar(clamp01((load - 1) / 0.62) * 0.85);

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
      want.set(lerp(lerp(2.4, 3.0, a), -0.9, b), lerp(lerp(0.8, 0.5, a), 2.8, b), lerp(lerp(-4.2, -4.6, a), 4.8, b));
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
