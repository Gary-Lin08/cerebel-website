import * as THREE from "three";
import { type Act, type Ctx, clamp01, damp, smooth } from "../stage";

// Act 0 — the cerebellar field resolves into a moving body.
// Both shapes are the precomputed surface-point buffers already shipped with the site.
export function createOrigin(): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
  const group = new THREE.Group();
  scene.add(group);

  const uniforms = {
    uMorph: { value: 0 },
    uStrand: { value: 0 },
    uTime: { value: 0 },
    uScatter: { value: 0 },
    uPointer: { value: new THREE.Vector2(9, 9) },
    uSize: { value: 1 },
    uAspect: { value: 1 },
  };

  const load = (url: string) => fetch(url).then((r) => r.arrayBuffer()).then((b) => new Float32Array(b));
  const ready = Promise.all([
    load("/assets/cerebel-cerebellum-points.bin"),
    load("/assets/cerebel-kinetic-human-points.bin"),
  ]).then(([cerebellum, human]) => {
    const count = Math.min(cerebellum.length, human.length) / 3;
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) seeds[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < count; i += 1) seeds[i] = Math.abs(seeds[i]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cerebellum, 3));
    geometry.setAttribute("aHuman", new THREE.BufferAttribute(human, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uMorph, uStrand, uTime, uScatter, uSize, uAspect; uniform vec2 uPointer;
        attribute vec3 aHuman; attribute float aSeed;
        varying float vSeed; varying float vMix; varying float vNear; varying float vStrand; varying float vKind;
        // A twisting double strand with rungs: the shape every transition passes through.
        vec3 strand(float s){
          float t = fract(s * 7.31);
          float y = (t - 0.5) * 9.0;
          float twist = y * 1.35 + uTime * 0.35;
          float which = step(0.5, fract(s * 3.17));
          float rung = step(0.78, fract(s * 11.3));
          float yq = (floor(y * 2.6) + 0.5) / 2.6;
          float u = fract(s * 23.7) * 2.0 - 1.0;
          float r = 0.95 + 0.12 * sin(y * 0.9);
          vec3 rail = vec3(cos(twist + which * 3.14159) * r, y, sin(twist + which * 3.14159) * r);
          float tq = yq * 1.35 + uTime * 0.35;
          vec3 bar = vec3(cos(tq) * r * u, yq, sin(tq) * r * u);
          vec3 p = mix(rail, bar, rung);
          return p + (vec3(fract(s * 91.7), fract(s * 57.3), fract(s * 33.1)) - 0.5) * 0.09;
        }
        void main(){
          float stagger = aSeed * 0.5;
          float a = clamp(uStrand * 1.5 - stagger, 0.0, 1.0); a = a * a * (3.0 - 2.0 * a);
          float m = clamp(uMorph * 1.5 - stagger, 0.0, 1.0); m = m * m * (3.0 - 2.0 * m);
          float x = clamp(uScatter * 1.5 - stagger, 0.0, 1.0); x = x * x * (3.0 - 2.0 * x);
          vec3 s = strand(aSeed);
          vec3 p = mix(mix(position, s, a), aHuman, m);
          p = mix(p, s + vec3(0.0, 1.5 * x, 0.0), x);
          p += normalize(p + 0.001) * sin(uTime * 0.7 + aSeed * 18.0) * 0.02;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vec4 clip = projectionMatrix * mv;
          vec2 ndc = clip.xy / clip.w;
          vec2 d = ndc - uPointer; d.x *= uAspect;
          float near = exp(-dot(d, d) * 9.0);
          mv.xy += normalize(d + 0.0001) * near * 0.42;
          gl_Position = projectionMatrix * mv;
          float sparkle = 1.0 + 0.7 * sin(aSeed * 74.0 + uTime * 0.5);
          gl_PointSize = max(1.5, uSize * sparkle * (17.0 / -mv.z));
          vSeed = aSeed; vMix = m; vNear = near; vStrand = max(a * (1.0 - m), x);
          float isRung = step(0.78, fract(aSeed * 11.3));
          vKind = isRung * 2.0 + step(0.5, fract(aSeed * 3.17)) * (1.0 - isRung);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vSeed; varying float vMix; varying float vNear; varying float vStrand; varying float vKind;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(q));
          vec3 cool = vec3(0.86, 0.89, 0.96);
          vec3 violet = vec3(0.61, 0.42, 1.0);
          float pick = step(0.72, fract(vSeed * 7.31));
          vec3 col = mix(cool, violet, max(pick, vNear));
          col = mix(col, violet, (1.0 - vMix) * 0.35);
          // On the strand: one rail violet, one green, rungs white.
          vec3 rail = vKind > 1.5 ? vec3(0.95, 0.97, 1.0) : (vKind > 0.5 ? vec3(0.22, 0.95, 0.62) : vec3(0.68, 0.48, 1.0));
          col = mix(col, rail, vStrand * 0.9);
          gl_FragColor = vec4(col, a * (0.5 + 0.3 * pick + vNear * 0.5));
        }`,
    });
    group.add(new THREE.Points(geometry, material));
  });

  // Out-of-focus lights drifting through the scene: violet, green and a few warm whites.
  const B = 420;
  const bokehPos = new Float32Array(B * 3);
  const bokehKind = new Float32Array(B);
  for (let i = 0; i < B; i += 1) {
    bokehPos.set([(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 18 - 2], i * 3);
    bokehKind[i] = Math.random();
  }
  const bokehGeo = new THREE.BufferGeometry();
  bokehGeo.setAttribute("position", new THREE.BufferAttribute(bokehPos, 3));
  bokehGeo.setAttribute("aKind", new THREE.BufferAttribute(bokehKind, 1));
  const bokeh = new THREE.Points(bokehGeo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime, uStrand, uSize; attribute float aKind; varying float vK; varying float vBlur;
      void main(){ vec3 p = position; p.y += sin(uTime * 0.15 + aKind * 40.0) * 0.5 + uStrand * (aKind - 0.5) * 3.0; p.x += cos(uTime * 0.11 + aKind * 17.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vBlur = clamp(abs(-mv.z - 10.0) / 8.0, 0.0, 1.0); vK = aKind;
        gl_PointSize = uSize * (26.0 + vBlur * 150.0) * (0.5 + aKind) / -mv.z; }`,
    fragmentShader: `precision highp float; varying float vK; varying float vBlur;
      void main(){ float d = length(gl_PointCoord - 0.5); float disc = smoothstep(0.5, 0.42 - 0.3 * (1.0 - vBlur), d); float ring = smoothstep(0.34, 0.47, d) * disc;
        vec3 c = vK > 0.86 ? vec3(1.0, 0.92, 0.8) : (vK > 0.5 ? vec3(0.2, 0.9, 0.58) : vec3(0.58, 0.4, 1.0));
        gl_FragColor = vec4(c, (disc * 0.5 + ring * 0.5) * mix(0.5, 0.11, vBlur)); }`,
  }));
  bokeh.frustumCulled = false;
  scene.add(bokeh);

  const act: Act = {
    scene,
    camera,
    ready,
    offset: { x: 0, y: 0 },
    bg: [0x0d0722, 0x050507, 0x1d0f52],
    update(ctx: Ctx) {
      const wide = ctx.aspect > 1.05;
      const hero = ctx.local("hero");
      const legible = ctx.local("legible");
      const morph = smooth(0.44, 0.74, legible);
      uniforms.uMorph.value = morph;
      uniforms.uStrand.value = smooth(0.0, 0.32, legible);
      uniforms.uTime.value = ctx.reduced ? 0 : ctx.time;
      uniforms.uScatter.value = smooth(0.9, 1.14, legible);
      uniforms.uPointer.value.set(ctx.pointer.x - (act.offset!.x * 2), ctx.pointer.y - (act.offset!.y * 2));
      uniforms.uAspect.value = ctx.aspect;
      uniforms.uSize.value = (wide ? 1.5 : 1.15) * Math.min(window.devicePixelRatio || 1, 1.5);
      // Centre behind the headline on the hero, then step right so the copy has room.
      const targetX = wide ? 0.06 + 0.16 * smooth(0.5, 1.0, hero) : 0;
      act.offset!.x = damp(act.offset!.x, targetX, 4, ctx.dt);
      act.offset!.y = wide ? 0 : 0.14;
      const scale = (wide ? 1.12 : 0.66) * (1 - morph * 0.2);
      group.scale.setScalar(scale);
      group.rotation.y = -0.5 + clamp01(hero) * 0.5 + morph * 1.1 + ctx.pointer.x * 0.12 + (ctx.reduced ? 0 : Math.sin(ctx.time * 0.2) * 0.06);
      group.rotation.x = -0.08 - ctx.pointer.y * 0.07;
      camera.position.z = 11 - smooth(0, 1, hero) * 1.2;
      camera.lookAt(0, 0, 0);
    },
  };
  return act;
}
