import * as THREE from "three";
import { type Act, type Ctx, smooth } from "../stage";

// Act 4 — a descending constellation behind the partners, the company and the contact line.
export function createField(): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const N = 170;
  const nodes: THREE.Vector3[] = [];
  for (let i = 0; i < N; i += 1) nodes.push(new THREE.Vector3((rnd() - 0.5) * 16, 3 - rnd() * 34, (rnd() - 0.5) * 9 - 2));
  const links: number[] = [];
  const phase: number[] = [];
  for (let i = 0; i < N; i += 1) {
    const near = nodes.map((p, j) => [p.distanceTo(nodes[i]), j] as const).filter(([d, j]) => j > i && d < 3.1).sort((a, b) => a[0] - b[0]).slice(0, 2);
    for (const [, j] of near) {
      links.push(...nodes[i].toArray(), ...nodes[j].toArray());
      const p = rnd() * 6.28;
      phase.push(p, p + 1.5);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(links), 3));
  lineGeo.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(phase), 1));
  const time = { value: 0 };
  scene.add(new THREE.LineSegments(lineGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aPhase; uniform float uTime; varying float vA; void main(){ vA = 0.25 + 0.3 * sin(aPhase + uTime * 0.9); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.62, 0.5, 1.0), max(vA, 0.06)); }`,
  })));

  const nodePos = new Float32Array(N * 3);
  const nodeKind = new Float32Array(N);
  nodes.forEach((p, i) => {
    p.toArray(nodePos, i * 3);
    nodeKind[i] = rnd();
  });
  const dustN = 5000;
  const dust = new Float32Array(dustN * 3);
  const dustKind = new Float32Array(dustN);
  for (let i = 0; i < dustN; i += 1) {
    dust.set([(rnd() - 0.5) * 26, 6 - rnd() * 42, (rnd() - 0.5) * 20 - 3], i * 3);
    dustKind[i] = rnd();
  }
  const pointMat = (size: number, alpha: number) => new THREE.ShaderMaterial({
    uniforms: { uTime: time, uSize: { value: size }, uAlpha: { value: alpha } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aKind; uniform float uTime, uSize; varying float vK; void main(){ vK = aKind; vec3 p = position; p.x += sin(uTime * 0.2 + aKind * 40.0) * 0.08; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * (0.6 + aKind) / -mv.z; }`,
    fragmentShader: `precision highp float; uniform float uAlpha; varying float vK; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); vec3 c = vK > 0.8 ? vec3(0.91, 0.93, 0.97) : (vK > 0.45 ? vec3(0.61, 0.42, 1.0) : vec3(0.26, 0.22, 1.0)); gl_FragColor = vec4(c, a * uAlpha); }`,
  });
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute("aKind", new THREE.BufferAttribute(nodeKind, 1));
  scene.add(new THREE.Points(nodeGeo, pointMat(150, 0.95)));
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
  dustGeo.setAttribute("aKind", new THREE.BufferAttribute(dustKind, 1));
  scene.add(new THREE.Points(dustGeo, pointMat(34, 0.5)));

  return {
    scene,
    camera,
    ready: Promise.resolve(),
    offset: { x: 0, y: 0 },
    update(ctx: Ctx) {
      time.value = ctx.reduced ? 0 : ctx.time;
      const y = 2 - smooth(-0.1, 1.05, ctx.t) * 27;
      camera.position.set(ctx.pointer.x * 0.6, y + ctx.pointer.y * 0.3, 9);
      camera.lookAt(ctx.pointer.x * 0.2, y - 1.6, -2);
    },
  };
}
