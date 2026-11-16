import * as THREE from "three";
import { benchmark } from "../data";
import { type Act, type Ctx, damp, lerp, smooth } from "../stage";

const MM = 0.1; // world units per millimetre
const ROW = 0.95;

// Act 2 — head-trajectory error as four tapes on one real millimetre scale, from zero.
export function createBenchmark(getSeq: () => "32" | "128", onValues: (shown: number[], grow: number) => void): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  const anchors: Record<string, THREE.Vector3> = {};

  // Ruler: a tick every millimetre, taller every ten.
  const ticks: number[] = [];
  for (let mm = 0; mm <= 90; mm += 1) {
    const len = mm % 10 === 0 ? 4.4 : mm % 5 === 0 ? 0.28 : 0.14;
    const z0 = mm % 10 === 0 ? -0.9 : -0.9;
    ticks.push(mm * MM, 0, z0, mm * MM, 0, z0 + len);
  }
  const ruler = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(ticks), 3)),
    new THREE.LineBasicMaterial({ color: 0x9aa0b8, transparent: true, opacity: 0.28 }),
  );
  scene.add(ruler);
  for (const mm of [0, 20, 40, 60, 80]) anchors[`tick-${mm}`] = new THREE.Vector3(mm * MM, 0, 3.7);

  const bars: { mesh: THREE.Mesh; edges: THREE.LineSegments; value: number }[] = [];
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0);
  const edgeGeo = new THREE.EdgesGeometry(box);
  benchmark["32"].forEach((row, i) => {
    const leader = i === 0;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uColor: { value: new THREE.Color(leader ? 0x8552ff : 0xcfd4e4) }, uLen: { value: 1 }, uGlow: { value: leader ? 1.7 : 0.3 }, uScan: { value: -1 } },
      vertexShader: `varying vec3 vP; varying vec3 vW; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `precision highp float; uniform vec3 uColor; uniform float uLen, uGlow, uScan; varying vec3 vP; varying vec3 vW;
        void main(){
          float tip = smoothstep(0.75, 1.0, vP.x);
          float top = smoothstep(0.2, 1.0, vP.y);
          float mmLine = 1.0 - smoothstep(0.0, 0.012, abs(fract(vW.x * 1.0 + 0.5) - 0.5));
          float scan = exp(-abs(vW.x - uScan) * 9.0);
          vec3 c = uColor * (0.16 + 0.5 * top + 0.7 * tip) * uGlow + uColor * mmLine * 0.25 + vec3(1.0) * scan * 0.6;
          gl_FragColor = vec4(c, 0.92);
        }`,
    });
    const mesh = new THREE.Mesh(box, material);
    mesh.position.set(0, 0, i * ROW);
    const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: leader ? 0xcbb6ff : 0xe9ecf2, transparent: true, opacity: leader ? 0.95 : 0.4 }));
    mesh.add(edges);
    scene.add(mesh);
    bars.push({ mesh, edges, value: row[4] as number });
    anchors[`bar-${i}`] = new THREE.Vector3();
  });

  // The gap between the leader and the next method, drawn on the floor.
  const gap = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0),
    new THREE.MeshBasicMaterial({ color: 0x4338ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  gap.position.set(0, 0.002, ROW * 0.5);
  scene.add(gap);
  anchors.gap = new THREE.Vector3();

  const dust = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i += 1) dust.set([Math.random() * 14 - 3, Math.random() * 5, Math.random() * 12 - 5], i * 3);
  scene.add(new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(dust, 3)),
    new THREE.PointsMaterial({ color: 0x8f7bd8, size: 0.03, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  ));

  const shown = [0, 0, 0, 0];
  const act: Act = {
    scene,
    camera,
    ready: Promise.resolve(),
    offset: { x: 0, y: 0 },
    anchors: () => anchors,
    update(ctx: Ctx) {
      const wide = ctx.aspect > 1.05;
      const t = ctx.local("benchmark");
      const rows = benchmark[getSeq()];
      const grow = smooth(0.08, 0.5, t);
      bars.forEach((bar, i) => {
        const target = (rows[i][4] as number) * MM;
        bar.value = damp(bar.value, target, 6, ctx.dt);
        // The leader finishes first; the others keep running.
        const g = smooth(0, 1, Math.min(1, grow * (1.25 - i * 0.07)));
        const len = Math.max(0.001, bar.value * g);
        bar.mesh.scale.set(len, i === 0 ? 0.5 : 0.34, 0.44);
        (bar.mesh.material as THREE.ShaderMaterial).uniforms.uScan.value = lerp(-1, 9.5, smooth(0.5, 0.75, t));
        anchors[`bar-${i}`].set(len, 0.2, i * ROW);
        shown[i] = len / MM;
      });
      const lead = bars[0].value;
      const next = bars[1].value;
      gap.position.x = lead;
      gap.scale.set(Math.max(0.001, (next - lead) * smooth(0.5, 0.7, t)), 1, ROW * 1.9);
      (gap.material as THREE.MeshBasicMaterial).opacity = 0.34 * smooth(0.5, 0.7, t);
      anchors.gap.set((lead + next) / 2, 0.02, ROW * 1.55);
      onValues(shown, smooth(0.5, 0.7, t));

      // Push in on zero while the tapes start, then pull back until the whole scale is in frame.
      const out = smooth(0.0, 0.6, t);
      const focusX = lerp(1.2, 3.9, out);
      const dist = lerp(wide ? 8.5 : 16, wide ? 17.5 : 36, out);
      const elev = lerp(0.3, 0.56, out);
      const az = lerp(-0.5, -0.12, out) + ctx.pointer.x * 0.05;
      act.offset!.x = wide ? 0.17 : 0;
      act.offset!.y = wide ? 0.02 : 0.16;
      camera.position.set(focusX + Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist + 0.3, 1.4 + Math.cos(az) * Math.cos(elev) * dist);
      camera.lookAt(focusX, 0.1, 1.4);
    },
  };
  return act;
}
