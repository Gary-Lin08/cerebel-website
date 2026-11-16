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
        uniform float uMorph, uTime, uScatter, uSize, uAspect; uniform vec2 uPointer;
        attribute vec3 aHuman; attribute float aSeed;
        varying float vSeed; varying float vMix; varying float vNear;
        void main(){
          float m = clamp(uMorph * 1.7 - aSeed * 0.7, 0.0, 1.0);
          m = m * m * (3.0 - 2.0 * m);
          vec3 p = mix(position, aHuman, m);
          float mid = sin(m * 3.14159);
          vec3 swirl = vec3(sin(aSeed * 91.0 + uTime * 0.35), cos(aSeed * 57.0 + uTime * 0.2), sin(aSeed * 33.0 + 1.0));
          p += swirl * mid * 1.9;
          p += normalize(p + 0.001) * sin(uTime * 0.7 + aSeed * 18.0) * 0.025;
          // Exit: the body lifts apart before the next scene wipes in.
          p += (swirl * 2.2 + vec3(0.0, 3.0 * aSeed, 0.0)) * uScatter * uScatter;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vec4 clip = projectionMatrix * mv;
          vec2 ndc = clip.xy / clip.w;
          vec2 d = ndc - uPointer; d.x *= uAspect;
          float near = exp(-dot(d, d) * 9.0);
          mv.xy += normalize(d + 0.0001) * near * 0.42;
          gl_Position = projectionMatrix * mv;
          float sparkle = 1.0 + 0.7 * sin(aSeed * 74.0 + uTime * 0.5);
          gl_PointSize = max(1.5, uSize * sparkle * (17.0 / -mv.z));
          vSeed = aSeed; vMix = m; vNear = near;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vSeed; varying float vMix; varying float vNear;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(q));
          vec3 cool = vec3(0.86, 0.89, 0.96);
          vec3 violet = vec3(0.61, 0.42, 1.0);
          float pick = step(0.72, fract(vSeed * 7.31));
          vec3 col = mix(cool, violet, max(pick, vNear));
          col = mix(col, violet, (1.0 - vMix) * 0.35);
          gl_FragColor = vec4(col, a * (0.62 + 0.38 * pick + vNear * 0.5));
        }`,
    });
    group.add(new THREE.Points(geometry, material));
  });

  const act: Act = {
    scene,
    camera,
    ready,
    offset: { x: 0, y: 0 },
    update(ctx: Ctx) {
      const wide = ctx.aspect > 1.05;
      const hero = ctx.local("hero");
      const legible = ctx.local("legible");
      const morph = smooth(0.05, 0.62, legible);
      uniforms.uMorph.value = morph;
      uniforms.uTime.value = ctx.reduced ? 0 : ctx.time;
      uniforms.uScatter.value = smooth(0.82, 1.12, legible);
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
