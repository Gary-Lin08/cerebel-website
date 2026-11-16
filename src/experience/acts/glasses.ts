import * as THREE from "three";
import { type Act, type Ctx, clamp01, damp, smooth } from "../stage";

type Part = {
  root: THREE.Object3D;
  home: THREE.Vector3;
  explode: THREE.Vector3;
  tags: string[];
  fill: THREE.MeshBasicMaterial;
  line: THREE.LineBasicMaterial;
  mesh: THREE.LineBasicMaterial;
};

const COOL = new THREE.Color(0xe9ecf2);
const VIOLET = new THREE.Color(0xa77bff);

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Act 3 — the glasses, modelled in code as a development concept and taken apart by scroll.
// The geometry is a schematic of the architecture, not a production drawing.
export function createGlasses(): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const rig = new THREE.Group();
  scene.add(rig);
  const parts: Part[] = [];

  function add(geometry: THREE.BufferGeometry, position: [number, number, number], explode: [number, number, number], tags: string[], angle = 28) {
    const fill = new THREE.MeshBasicMaterial({ color: 0x10101c, transparent: true, opacity: 0.72, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const line = new THREE.LineBasicMaterial({ color: COOL.clone(), transparent: true, opacity: 0.9 });
    const root = new THREE.Mesh(geometry, fill);
    root.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, angle), line));
    // The whole triangle mesh, drawn faintly under the outline, so the part reads as a wireframe model.
    const mesh = new THREE.LineBasicMaterial({ color: COOL.clone(), transparent: true, opacity: 0.16 });
    root.add(new THREE.LineSegments(new THREE.WireframeGeometry(geometry), mesh));
    root.position.set(...position);
    rig.add(root);
    const part = { root, home: root.position.clone(), explode: new THREE.Vector3(...explode), tags, fill, line, mesh };
    parts.push(part);
    return part;
  }

  const extrude = (shape: THREE.Shape, depth: number) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -depth / 2);

  const LX = 0.96;
  for (const side of [-1, 1]) {
    const rim = roundedRect(1.66, 1.24, 0.44);
    rim.holes.push(roundedRect(1.38, 0.96, 0.32));
    add(extrude(rim, 0.16), [side * LX, 0, 0], [0, 0, 0], ["frame"]);
    add(extrude(roundedRect(1.38, 0.96, 0.32), 0.035), [side * LX, 0, 0.02], [0, 0, 1.25], ["optical"]);
    add(extrude(roundedRect(1.08, 0.7, 0.2), 0.012), [side * LX, 0, -0.02], [0, 0, 0.62], ["optical", "display"]);
    // Forward camera module at the outer brow.
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 20).rotateX(Math.PI / 2), [side * 1.9, 0.44, 0.06], [side * 0.25, 0.18, 1.7], ["optical", "camera"], 40);
    // Temple arm with a dropped ear tip.
    const arm = new THREE.Shape();
    arm.moveTo(0, 0.17);
    arm.lineTo(-2.5, 0.12);
    arm.quadraticCurveTo(-3.05, 0.08, -3.3, -0.42);
    arm.lineTo(-3.12, -0.5);
    arm.quadraticCurveTo(-2.9, -0.12, -2.5, -0.1);
    arm.lineTo(0, -0.17);
    arm.closePath();
    const armGeo = new THREE.ExtrudeGeometry(arm, { depth: 0.11, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -0.055).rotateY(Math.PI / 2);
    add(armGeo, [side * 2.0, 0.36, -0.12], [side * 0.55, 0, -0.25], ["modular", "temple"]);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 14), [side * 2.0, 0.36, -0.06], [side * 0.28, 0, 0], ["modular"], 40);
  }
  add(new THREE.BoxGeometry(0.42, 0.14, 0.14), [0, 0.2, 0], [0, 0, 0], ["frame"]);
  add(new THREE.BoxGeometry(4.2, 0.1, 0.12), [0, 0.6, 0], [0, 0.0, 0], ["frame"]);

  // Right temple: board with the shared clock, then the compute module.
  add(new THREE.BoxGeometry(0.02, 0.2, 1.25), [2.0, 0.36, -0.95], [1.35, 0, 0], ["clock", "board"]);
  const chip = add(new THREE.BoxGeometry(0.05, 0.11, 0.16), [2.03, 0.36, -0.62], [1.42, 0, 0], ["clock"]);
  add(new THREE.BoxGeometry(0.04, 0.08, 0.1), [2.03, 0.38, -1.05], [1.42, 0, 0], ["clock"]);
  add(new THREE.BoxGeometry(0.04, 0.08, 0.1), [2.03, 0.34, -1.3], [1.42, 0, 0], ["clock"]);
  const compute = add(new THREE.BoxGeometry(0.07, 0.24, 0.62), [2.0, 0.36, -2.05], [1.35, 0.0, -0.1], ["prep"]);
  // Left temple: the power module.
  const battery = add(new THREE.BoxGeometry(0.075, 0.24, 1.2), [-2.0, 0.36, -1.35], [-1.35, 0, 0], ["modular", "power"]);
  const lens = parts.find((p) => p.tags.includes("optical") && p.home.x > 0)!;

  // Sync traces from both cameras to the clock, shown on the shared-clock step.
  const cams = parts.filter((p) => p.tags.includes("camera"));
  const traceMat = new THREE.LineDashedMaterial({ color: 0xa77bff, transparent: true, opacity: 0, dashSize: 0.09, gapSize: 0.06 });
  const traces = cams.map(() => {
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3)), traceMat);
    line.frustumCulled = false;
    rig.add(line);
    return line;
  });

  // A slow field of points around the object for depth.
  const dust = new Float32Array(1400 * 3);
  for (let i = 0; i < 1400; i += 1) dust.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 12], i * 3);
  const dustPoints = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(dust, 3)),
    new THREE.PointsMaterial({ color: 0x7f86a8, size: 0.022, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  scene.add(dustPoints);

  const anchors = {
    "h-optical": new THREE.Vector3(),
    "h-clock": new THREE.Vector3(),
    "h-prep": new THREE.Vector3(),
    "h-modular": new THREE.Vector3(),
  };
  const steps = ["g-optical", "g-clock", "g-prep", "g-modular"] as const;
  const tagFor: Record<string, string> = { "g-optical": "optical", "g-clock": "clock", "g-prep": "prep", "g-modular": "modular" };
  const yawFor: Record<string, number> = { "glasses-intro": 0.62, "g-optical": 0.42, "g-clock": -0.95, "g-prep": -1.2, "g-modular": 1.05 };
  let yaw = 0.62;
  let pitch = 0.16;
  const tmp = new THREE.Vector3();

  const act: Act = {
    scene,
    camera,
    ready: Promise.resolve(),
    offset: { x: 0.17, y: 0 },
    bg: [0x0e1118, 0x07080c, 0x1c2232],
    anchors: () => anchors,
    update(ctx: Ctx) {
      const wide = ctx.aspect > 1.05;
      act.offset!.x = wide ? 0.13 : 0;
      act.offset!.y = wide ? 0 : 0.17;
      const intro = ctx.local("glasses-intro");
      const e = smooth(0.6, 1.0, intro) * 0.3 + smooth(0.0, 0.7, ctx.local("g-optical")) * 0.7;
      let active = "";
      let wanted = yawFor["glasses-intro"];
      for (const id of steps) {
        if (ctx.local(id) > 0) {
          active = tagFor[id];
          wanted = yawFor[id];
        }
      }
      yaw = damp(yaw, wanted, 2.4, ctx.dt);
      pitch = damp(pitch, active === "optical" ? 0.1 : 0.22, 2, ctx.dt);
      rig.rotation.y = yaw + ctx.pointer.x * 0.14 + (ctx.reduced ? 0 : Math.sin(ctx.time * 0.3) * 0.04) - (1 - smooth(-0.4, 0.5, intro)) * 0.9;
      rig.rotation.x = pitch - ctx.pointer.y * 0.08;
      rig.scale.setScalar(wide ? 1 : 0.6);
      rig.position.y = -0.1;
      dustPoints.rotation.y = ctx.reduced ? 0 : ctx.time * 0.01;

      for (const part of parts) {
        part.root.position.copy(part.home).addScaledVector(part.explode, e);
        const on = active !== "" && part.tags.includes(active);
        const k = 1 - Math.exp(-6 * ctx.dt);
        part.line.color.lerp(on ? VIOLET : COOL, k);
        part.line.opacity += ((on ? 1 : active ? 0.38 : 0.9) - part.line.opacity) * k;
        part.mesh.color.copy(part.line.color);
        part.mesh.opacity += ((on ? 0.42 : active ? 0.07 : 0.16) - part.mesh.opacity) * k;
        part.fill.opacity += ((on ? 0.86 : 0.7) - part.fill.opacity) * k;
        part.fill.color.lerp(on ? new THREE.Color(0x1d1238) : new THREE.Color(0x10101c), k);
      }

      traceMat.opacity = damp(traceMat.opacity, active === "clock" ? 0.95 : 0, 5, ctx.dt);
      traces.forEach((line, i) => {
        const a = cams[i].root.position;
        const c = chip.root.position;
        const p = line.geometry.attributes.position.array as Float32Array;
        p.set([a.x, a.y, a.z, c.x, a.y, a.z * 0.2 + c.z * 0.8 + 0.5, c.x, c.y, c.z]);
        line.geometry.attributes.position.needsUpdate = true;
        line.computeLineDistances();
      });

      rig.updateMatrixWorld(true);
      anchors["h-optical"].copy(lens.root.getWorldPosition(tmp));
      anchors["h-clock"].copy(chip.root.getWorldPosition(tmp));
      anchors["h-prep"].copy(compute.root.getWorldPosition(tmp));
      anchors["h-modular"].copy(battery.root.getWorldPosition(tmp));

      const dist = (wide ? 11.5 : 15) + clamp01(e) * 4.2;
      camera.position.set(0, 0.5, dist);
      camera.lookAt(0, 0, 0);
    },
  };
  return act;
}
