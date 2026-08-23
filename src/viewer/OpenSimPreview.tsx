import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface OpenSimPreviewData {
  format: "cerebel-opensim-preview-v1";
  bodyNames: string[];
  bodies: Record<string, { p: [number, number, number]; q: [number, number, number, number] }>;
}

function isPreviewData(value: unknown): value is OpenSimPreviewData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OpenSimPreviewData>;
  return candidate.format === "cerebel-opensim-preview-v1"
    && Array.isArray(candidate.bodyNames)
    && Boolean(candidate.bodies);
}

export function OpenSimPreview({ viewerUrl }: { viewerUrl: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let animationFrame = 0;
    const controller = new AbortController();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.01, 50);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#f4f0fa", "#21152d", 2.25));
    const key = new THREE.DirectionalLight("#e9e2ff", 4.8);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#9b6cff", 5.2);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const grid = new THREE.GridHelper(5, 22, "#5b3a87", "#241a2f");
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);

    const viewerDocumentUrl = new URL(viewerUrl, window.location.href);
    const previewUrl = new URL("./assets/model/opensim-preview.json", viewerDocumentUrl).href;
    const modelUrl = new URL("./assets/model/rajagopal-bones.glb", viewerDocumentUrl).href;
    const modelRoot = new THREE.Group();
    scene.add(modelRoot);

    Promise.all([
      fetch(previewUrl, { signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error("Body preview unavailable.");
        const value: unknown = await response.json();
        if (!isPreviewData(value)) throw new Error("Body preview is invalid.");
        return value;
      }),
      new GLTFLoader().loadAsync(modelUrl),
    ]).then(([preview, gltf]) => {
      if (disposed) return;
      const model = gltf.scene;
      const material = new THREE.MeshStandardMaterial({
        color: "#eee9dd",
        roughness: 0.58,
        metalness: 0.04,
      });
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) object.material = material;
      });
      preview.bodyNames.forEach((bodyName) => {
        const object = model.getObjectByName(bodyName);
        const transform = preview.bodies[bodyName];
        if (!object || !transform) return;
        object.position.set(...transform.p);
        object.quaternion.set(...transform.q);
      });
      model.updateMatrixWorld(true);
      modelRoot.add(model);

      const bounds = new THREE.Box3().setFromObject(modelRoot);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 1);
      camera.position.set(center.x + radius * 1.7, center.y + radius * 0.72, center.z + radius * 1.75);
      camera.lookAt(center.x, center.y + size.y * 0.04, center.z);
      grid.position.y = bounds.min.y - 0.015;
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn(error);
    });

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const render = (time: number) => {
      if (!reduceMotion) modelRoot.rotation.y = Math.sin(time * 0.00022) * 0.08;
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [viewerUrl]);

  return (
    <div className="opensim-preview" aria-hidden="true">
      <div ref={hostRef} className="opensim-preview__canvas" />
      <div className="opensim-preview__label">
        <span>BODY MODEL · FIRST FRAME</span>
      </div>
    </div>
  );
}
