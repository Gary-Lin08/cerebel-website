import * as THREE from "three";

/** Area-weighted points on the body surface, fixed to their triangles so they ride every frame. */
export function createSurfaceSampler(reference: Float32Array, faces: Uint32Array, count: number) {
  const triangles = faces.length / 3;
  const cumulative = new Float32Array(triangles);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < triangles; t += 1) {
    a.fromArray(reference, faces[t * 3] * 3);
    b.fromArray(reference, faces[t * 3 + 1] * 3).sub(a);
    c.fromArray(reference, faces[t * 3 + 2] * 3).sub(a);
    total += b.cross(c).length();
    cumulative[t] = total;
  }

  // Deterministic, so the exposure looks the same on every visit.
  let state = 0x9e3779b9;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let z = Math.imul(state ^ (state >>> 15), 1 | state);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };

  const corners = new Uint32Array(count * 3);
  const weights = new Float32Array(count * 2);
  const seeds = new Float32Array(count);
  for (let s = 0; s < count; s += 1) {
    const pick = random() * total;
    let lo = 0;
    let hi = triangles - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < pick) lo = mid + 1;
      else hi = mid;
    }
    let u = random();
    let v = random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    corners[s * 3] = faces[lo * 3] * 3;
    corners[s * 3 + 1] = faces[lo * 3 + 1] * 3;
    corners[s * 3 + 2] = faces[lo * 3 + 2] * 3;
    weights[s * 2] = u;
    weights[s * 2 + 1] = v;
    seeds[s] = random();
  }

  return {
    seeds,
    /** Write sample positions and face normals for one pose of the mesh. */
    write(pose: Float32Array, positions: Float32Array, normals: Float32Array, limit = count) {
      for (let s = 0; s < limit; s += 1) {
        const ia = corners[s * 3];
        const ib = corners[s * 3 + 1];
        const ic = corners[s * 3 + 2];
        const ax = pose[ia];
        const ay = pose[ia + 1];
        const az = pose[ia + 2];
        const e1x = pose[ib] - ax;
        const e1y = pose[ib + 1] - ay;
        const e1z = pose[ib + 2] - az;
        const e2x = pose[ic] - ax;
        const e2y = pose[ic + 1] - ay;
        const e2z = pose[ic + 2] - az;
        const u = weights[s * 2];
        const v = weights[s * 2 + 1];
        const o = s * 3;
        positions[o] = ax + e1x * u + e2x * v;
        positions[o + 1] = ay + e1y * u + e2y * v;
        positions[o + 2] = az + e1z * u + e2z * v;
        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;
        const length = Math.hypot(nx, ny, nz) || 1;
        normals[o] = nx / length;
        normals[o + 1] = ny / length;
        normals[o + 2] = nz / length;
      }
    },
  };
}

const particleVertexShader = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3 uLight;
  attribute float aSeed;
  varying float vShade;
  void main() {
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position + normal * 0.004, 1.0);
    float facing = dot(n, normalize(-mv.xyz));
    float lambert = clamp(dot(n, uLight), 0.0, 1.0);
    float rim = pow(1.0 - clamp(facing, 0.0, 1.0), 2.4);
    vShade = (0.2 + 0.8 * lambert + 0.6 * rim) * smoothstep(-0.08, 0.16, facing);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.7 + 0.6 * aSeed) / -mv.z;
  }
`;

const particleFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vShade;
  void main() {
    float alpha = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(uColor, alpha * vShade * uOpacity);
  }
`;

/** The Hero's particle look, lit per point so the body keeps its volume. */
export function createParticleMaterial(color: string, size: number, blending: THREE.Blending) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
      uSize: { value: size },
      uPixelRatio: { value: 1 },
      uLight: { value: new THREE.Vector3(-0.45, 0.55, 0.7).normalize() },
    },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
  });
}

/** Near-black body that hides the far side of the particle shell and catches a violet rim. */
export function createShellMaterial() {
  return new THREE.ShaderMaterial({
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.2);
        gl_FragColor = vec4(vec3(0.026, 0.024, 0.034) + vec3(0.56, 0.44, 1.0) * rim * 0.5, 1.0);
      }
    `,
  });
}
