import * as THREE from "three";

// The cloud of lights that runs behind every act: clumps, loose scatter and dotted arcs, no grid to it.
// It never cuts. Between acts only its two colours drift from one palette to the next.
export function createCloud() {
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: 1 },
    uAspect: { value: 1 },
    uGlow: { value: new THREE.Vector2(9, 9) },
    uVel: { value: new THREE.Vector2() },
    uA: { value: new THREE.Color(0x9b6cff) },
    uB: { value: new THREE.Color(0x39e6b0) },
  };
  let seed = 91;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.9;
  const pos: number[] = [];
  const kind: number[] = [];
  const size: number[] = [];
  const push = (x: number, y: number, z: number, k: number, s: number) => {
    pos.push(x, y, z);
    kind.push(k);
    size.push(s);
  };
  // Clumps, each stretched along its own axes.
  for (let c = 0; c < 18; c += 1) {
    const centre = new THREE.Vector3((rnd() - 0.5) * 22, (rnd() - 0.5) * 13, (rnd() - 0.5) * 14 - 1);
    const basis = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6));
    const stretch = new THREE.Vector3(0.3 + rnd() * 2.6, 0.2 + rnd() * 1.1, 0.3 + rnd() * 1.8);
    const tint = rnd();
    const n = 60 + Math.floor(rnd() * 150);
    for (let i = 0; i < n; i += 1) {
      const p = new THREE.Vector3(gauss(), gauss(), gauss()).multiply(stretch).applyMatrix4(basis).add(centre);
      push(p.x, p.y, p.z, rnd() < 0.75 ? tint : rnd(), rnd() < 0.9 ? 0.25 + rnd() * 0.5 : 1.2 + rnd() * 2.2);
    }
  }
  // Dotted arcs sweeping through the space.
  for (let a = 0; a < 20; a += 1) {
    const centre = new THREE.Vector3((rnd() - 0.5) * 16, (rnd() - 0.5) * 9, (rnd() - 0.5) * 10 - 1);
    const basis = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6));
    const radius = 1.2 + rnd() * 4.5;
    const from = rnd() * 6.28;
    const span = 0.8 + rnd() * 2.6;
    const tint = rnd();
    const n = 50 + Math.floor(rnd() * 70);
    for (let i = 0; i < n; i += 1) {
      const u = i / n;
      const ang = from + u * span;
      const wob = 1 + 0.12 * Math.sin(u * 9 + a);
      const p = new THREE.Vector3(Math.cos(ang) * radius * wob, Math.sin(ang) * radius * wob, Math.sin(u * 5 + a) * 0.4).applyMatrix4(basis).add(centre);
      push(p.x, p.y, p.z, tint, 0.2 + 0.5 * Math.sin(u * Math.PI));
    }
  }
  // Loose scatter and a few large soft lights.
  for (let i = 0; i < 700; i += 1) push((rnd() - 0.5) * 32, (rnd() - 0.5) * 18, (rnd() - 0.5) * 22 - 2, rnd(), rnd() < 0.86 ? 0.2 + rnd() * 0.45 : 1.5 + rnd() * 3.5);

  // A few very large lights close to the lens, far out of focus: these are the bokeh discs.
  for (let i = 0; i < 46; i += 1) push((rnd() - 0.5) * 20, (rnd() - 0.5) * 12, 3 + rnd() * 5.5, rnd(), 2.4 + rnd() * 4.2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(kind), 1));
  geo.setAttribute("aScale", new THREE.BufferAttribute(new Float32Array(size), 1));
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uSize, uAspect; uniform vec2 uGlow, uVel;
      attribute float aKind; attribute float aScale;
      varying float vK; varying float vBlur; varying float vNear; varying float vTw;
      void main(){
        vec3 p = position;
        p += vec3(sin(uTime * 0.13 + aKind * 40.0), cos(uTime * 0.1 + aKind * 23.0), sin(uTime * 0.09 + aKind * 61.0)) * 0.22;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // The field leans against the pointer's motion: nearer lights are dragged further.
        float depth = clamp((-mv.z - 4.0) / 16.0, 0.0, 1.0);
        mv.xy -= uVel * (1.0 - depth) * 1.2;
        vec4 clip = projectionMatrix * mv;
        vec2 d = clip.xy / clip.w - uGlow; d.x *= uAspect;
        vNear = exp(-dot(d, d) * 6.0);
        vBlur = clamp(abs(-mv.z - 10.5) / 9.0, 0.0, 1.0) * step(1.0, aScale);
        vK = aKind;
        vTw = 0.6 + 0.4 * sin(uTime * (0.6 + aKind * 2.0) + aKind * 90.0);
        gl_Position = clip;
        gl_PointSize = min(uSize * aScale * (20.0 + vBlur * 60.0 + vNear * 14.0) / -mv.z, 260.0 * uSize);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uA, uB;
      varying float vK; varying float vBlur; varying float vNear; varying float vTw;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float disc = smoothstep(0.5, mix(0.05, 0.43, vBlur), d);
        // Out of focus, a light is a disc with a brighter rim and an uneven face, not a soft dot.
        float rim = smoothstep(0.3, 0.47, d) * smoothstep(0.5, 0.46, d);
        float face = 0.75 + 0.25 * sin(gl_PointCoord.x * 7.0 + vK * 40.0) * sin(gl_PointCoord.y * 6.0 - vK * 23.0);
        disc *= mix(1.0, face * (0.7 + 1.1 * rim), vBlur);
        vec3 c = vK > 0.94 ? vec3(1.0, 0.38, 0.5) : (vK > 0.84 ? vec3(1.0, 0.92, 0.78) : (vK > 0.42 ? uB : uA));
        c = mix(c, vec3(1.0), vNear * 0.6);
        gl_FragColor = vec4(c, disc * mix(vTw, 0.8 + 0.2 * vTw, vBlur) * mix(0.7, 0.085, vBlur) * (0.7 + vNear * 1.6));
      }`,
  }));
  points.frustumCulled = false;
  return { points, uniforms };
}
