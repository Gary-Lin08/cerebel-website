import * as THREE from "three";

const RINGS = 14;
const SIDES = 8;
const BELLY_RADIUS = 0.017;

/**
 * One muscle group drawn as fusiform volumes instead of hairlines.
 *
 * The motion data gives each muscle as a short path of points per frame. Every path becomes a
 * tube that is thin at its tendons and full at its belly, so the group reads as muscle on the
 * skeleton. A second, additive copy ignores depth, so the group still glows when a bone is in
 * front of it.
 */
export function createMuscleVolume(color: string, pointCounts: number[]) {
  const tubes = pointCounts.length;
  const positions = new Float32Array(tubes * RINGS * SIDES * 3);
  const normals = new Float32Array(positions.length);
  const indices: number[] = [];
  for (let tube = 0; tube < tubes; tube += 1) {
    const base = tube * RINGS * SIDES;
    for (let ring = 0; ring < RINGS - 1; ring += 1) {
      for (let side = 0; side < SIDES; side += 1) {
        const a = base + ring * SIDES + side;
        const b = base + ring * SIDES + ((side + 1) % SIDES);
        const c = a + SIDES;
        const d = b + SIDES;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const normalAttribute = new THREE.BufferAttribute(normals, 3);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("normal", normalAttribute);
  geometry.setIndex(indices);

  const solidMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.12,
    roughness: 0.5,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.05,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const solid = new THREE.Mesh(geometry, solidMaterial);
  const glow = new THREE.Mesh(geometry, glowMaterial);
  solid.frustumCulled = false;
  glow.frustumCulled = false;
  glow.renderOrder = 3;
  const group = new THREE.Group();
  group.add(solid, glow);

  const point = new THREE.Vector3();
  const before = new THREE.Vector3();
  const after = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const centres = new Float32Array(RINGS * 3);
  let level = 0;

  /** Catmull-Rom through one muscle's path, so via-points bend the belly instead of kinking it. */
  const sample = (path: Float32Array, count: number, u: number, out: THREE.Vector3) => {
    const s = u * (count - 1);
    const i = Math.min(Math.floor(s), count - 2);
    const t = s - i;
    const at = (index: number, axis: number) => path[Math.max(0, Math.min(count - 1, index)) * 3 + axis];
    const t2 = t * t;
    const t3 = t2 * t;
    const w0 = -0.5 * t3 + t2 - 0.5 * t;
    const w1 = 1.5 * t3 - 2.5 * t2 + 1;
    const w2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
    const w3 = 0.5 * t3 - 0.5 * t2;
    return out.set(
      at(i - 1, 0) * w0 + at(i, 0) * w1 + at(i + 1, 0) * w2 + at(i + 2, 0) * w3,
      at(i - 1, 1) * w0 + at(i, 1) * w1 + at(i + 1, 1) * w2 + at(i + 2, 1) * w3,
      at(i - 1, 2) * w0 + at(i, 2) * w1 + at(i + 1, 2) * w2 + at(i + 2, 2) * w3,
    );
  };

  return {
    group,
    /** How strongly the group is called out, 0 (resting) to 1 (the finding is on screen). */
    get level() {
      return level;
    },
    /**
     * @param paths one Float32Array of xyz points per muscle, already interpolated for this frame
     * @param goal the call-out level to ease toward
     * @param ease easing factor for this frame
     * @param pulse a slow 0..1 breath, applied only while called out
     */
    update(paths: Float32Array[], goal: number, ease: number, pulse: number) {
      level += (goal - level) * ease;
      solidMaterial.opacity = 0.42 + 0.56 * level;
      solidMaterial.emissiveIntensity = 0.08 + 0.2 * level;
      glowMaterial.opacity = 0.03 + (0.07 + 0.04 * pulse) * level;
      const fullness = BELLY_RADIUS * (0.8 + 0.2 * level + 0.07 * pulse * level);

      for (let tube = 0; tube < tubes; tube += 1) {
        const path = paths[tube];
        const count = pointCounts[tube];
        for (let ring = 0; ring < RINGS; ring += 1) {
          sample(path, count, ring / (RINGS - 1), point).toArray(centres, ring * 3);
        }
        // Parallel transport keeps the cross-section from spinning along the tube.
        normal.set(0, 0, 0);
        for (let ring = 0; ring < RINGS; ring += 1) {
          before.fromArray(centres, Math.max(0, ring - 1) * 3);
          after.fromArray(centres, Math.min(RINGS - 1, ring + 1) * 3);
          tangent.subVectors(after, before).normalize();
          if (ring === 0) {
            normal.set(0, 1, 0);
            if (Math.abs(tangent.y) > 0.9) normal.set(1, 0, 0);
          }
          normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
          binormal.crossVectors(tangent, normal);
          const along = ring / (RINGS - 1);
          const radius = fullness * (0.2 + 0.8 * Math.sin(Math.PI * along) ** 0.75);
          const cx = centres[ring * 3];
          const cy = centres[ring * 3 + 1];
          const cz = centres[ring * 3 + 2];
          for (let side = 0; side < SIDES; side += 1) {
            const angle = (side / SIDES) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const nx = normal.x * cos + binormal.x * sin;
            const ny = normal.y * cos + binormal.y * sin;
            const nz = normal.z * cos + binormal.z * sin;
            const o = ((tube * RINGS + ring) * SIDES + side) * 3;
            positions[o] = cx + nx * radius;
            positions[o + 1] = cy + ny * radius;
            positions[o + 2] = cz + nz * radius;
            normals[o] = nx;
            normals[o + 1] = ny;
            normals[o + 2] = nz;
          }
        }
      }
      positionAttribute.needsUpdate = true;
      normalAttribute.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      solidMaterial.dispose();
      glowMaterial.dispose();
    },
  };
}

/** A soft additive disc for marking a joint inside the scene. */
export function createJointGlow() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.28, "rgba(255,255,255,0.34)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(0.36);
  sprite.renderOrder = 4;
  return {
    sprite,
    material,
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}
