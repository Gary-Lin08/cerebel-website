import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { LegacyCerebelScrollSequence } from './CerebelScrollSequence';

const chapters = [
  ['Wearable', 'Built around\nhuman motion.', 'A development configuration for natural, first-person capture.', 'One wearable perspective'],
  ['Capture', 'The world.\nFrom your view.', 'Frame, optics, and capture components share one wearable assembly.', 'Capture assembly'],
  ['Architecture', 'Look beyond\nthe surface.', 'A transparent view of the structure behind the capture surface.', 'Structure / optical path'],
  ['Inside out', 'Every layer.\nOne system.', 'Explore the major assemblies. Separation is illustrative—not a production or assembly specification.', 'Exploded development view'],
];
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function CerebelScrollSequence() {
  const section = useRef<HTMLElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [phase, setPhase] = useState(0);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());
  const saveData = typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  const reduced = reduceMotion || saveData;

  useEffect(() => {
    if (fallback) return;
    const element = section.current!;
    const update = () => {
      progress.current = reduced ? 0 : clamp(-element.getBoundingClientRect().top / Math.max(1, element.offsetHeight - innerHeight));
      setPhase(Math.min(3, Math.floor(progress.current * 4)));
      element.style.setProperty('--studio-progress', String(progress.current));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [reduced, fallback]);

  useEffect(() => {
    if (fallback || reduced) return;
    const host = mount.current!;
    const element = section.current!;
    let disposed = false;
    let started = false;
    let cleanup = () => {};
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      try {
        const [T, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
          import('three'), import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/environments/RoomEnvironment.js'),
        ]);
        if (disposed) return;
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.25 : 1.75));
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        const scene = new T.Scene();
        const pmrem = new T.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        const env = pmrem.fromScene(room, .04);
        scene.environment = env.texture;
        room.dispose(); pmrem.dispose();
        const camera = new T.OrthographicCamera(-4, 4, 4, -4, .1, 100);
        camera.position.set(5, 5, 8); camera.lookAt(0, 0, 0);
        scene.add(new T.HemisphereLight(0xffffff, 0x717185, 2));
        const light = new T.DirectionalLight(0xffffff, 3); light.position.set(-3, 6, 5); scene.add(light);
        const asset = await new GLTFLoader().loadAsync('/assets/wearable-studio/cerebel-wearable-v1.glb');
        if (disposed) { renderer.dispose(); env.dispose(); return; }
        const rig = new T.Group(); scene.add(rig); rig.add(asset.scene);
        const meshes: { mesh: InstanceType<typeof T.Mesh>; base: InstanceType<typeof T.Vector3>; delta: InstanceType<typeof T.Vector3>; materials: InstanceType<typeof T.MeshStandardMaterial>[]; edge: InstanceType<typeof T.LineSegments> }[] = [];
        asset.scene.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          const materials = (Array.isArray(object.material) ? object.material : [object.material]) as InstanceType<typeof T.MeshStandardMaterial>[];
          materials.forEach(m => { m.transparent = true; m.depthWrite = true; m.envMapIntensity = 1.6; });
          const edge = new T.LineSegments(new T.EdgesGeometry(object.geometry, 32), new T.LineBasicMaterial({ color: 0x37323f, transparent: true, opacity: 0 }));
          object.add(edge);
          const vector = object.userData.explosion_vector ?? object.parent?.userData.explosion_vector ?? [0, 0, 0];
          meshes.push({ mesh: object, base: object.position.clone(), delta: new T.Vector3(vector[0], vector[2], -vector[1]), materials, edge });
        });
        host.appendChild(renderer.domElement);
        let raf = 0, current = progress.current, visible = true;
        const render = () => {
          raf = 0;
          if (disposed || !visible || document.hidden) return;
          current += (progress.current - current) * .13;
          const xray = Math.sin(clamp((current - .42) / .32) * Math.PI);
          const exploded = T.MathUtils.smoothstep(current, .74, .94);
          rig.rotation.y = .2 + current * 1.2;
          rig.rotation.z = Math.sin(current * Math.PI * 2) * .07;
          meshes.forEach(({ mesh, base, delta, materials, edge }) => {
            mesh.position.copy(base).addScaledVector(delta, exploded);
            materials.forEach(m => { m.opacity = 1 - xray * .89; m.depthWrite = xray < .4; });
            (edge.material as InstanceType<typeof T.LineBasicMaterial>).opacity = xray * .7;
          });
          renderer.render(scene, camera);
          if (Math.abs(current - progress.current) > .0001) raf = requestAnimationFrame(render);
        };
        const schedule = () => { if (!raf) raf = requestAnimationFrame(render); };
        const resize = () => {
          const { width, height } = host.getBoundingClientRect();
          renderer.setSize(width, height);
          const aspect = width / Math.max(1, height);
          const half = aspect < 1 ? 2.7 / aspect : 2.55;
          camera.left = -half * aspect; camera.right = half * aspect;
          camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix(); schedule();
        };
        const ro = new ResizeObserver(resize); ro.observe(host); resize();
        const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) schedule(); }); io.observe(element);
        window.addEventListener('scroll', schedule, { passive: true });
        document.addEventListener('visibilitychange', schedule);
        renderer.domElement.addEventListener('webglcontextlost', () => setFallback(true), { once: true });
        setReady(true);
        cleanup = () => {
          cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
          window.removeEventListener('scroll', schedule); document.removeEventListener('visibilitychange', schedule);
          meshes.forEach(({ mesh, materials, edge }) => { mesh.geometry.dispose(); materials.forEach(m => m.dispose()); edge.geometry.dispose(); (edge.material as InstanceType<typeof T.LineBasicMaterial>).dispose(); });
          env.dispose(); renderer.dispose(); renderer.domElement.remove();
        };
      } catch (error) { console.warn('Wearable studio using sequence fallback', error); if (!disposed) setFallback(true); }
    }, { rootMargin: '900px' });
    observer.observe(element);
    return () => { disposed = true; observer.disconnect(); cleanup(); };
  }, [fallback, reduced]);

  if (fallback) return <LegacyCerebelScrollSequence />;
  return <section id="wearable" ref={section} className={`wearable-studio${reduced ? ' is-reduced' : ''}`} aria-label="Cerebel wearable development visualization">
    <div className="wearable-studio__sticky">
      <header><span>Cerebel / Wearable system</span><span>Development configuration</span></header>
      <div className="wearable-studio__copy" aria-live="polite">
        <p>0{phase + 1} — {chapters[phase][0]}</p>
        <h2>{chapters[phase][1]}</h2><span>{chapters[phase][2]}</span>
      </div>
      <div ref={mount} className={`wearable-studio__model${ready ? ' is-ready' : ''}`} aria-hidden="true">
        <img src="/assets/wearable-studio/studio-poster.webp" alt="" loading="lazy" />
      </div>
      <div className="wearable-studio__annotation"><i />{chapters[phase][3]}</div>
      <footer><nav aria-label="Wearable presentation chapters">{chapters.map(([label], index) => <button key={label} aria-pressed={phase === index} onClick={() => {
        if (reduced) return;
        const el = section.current!;
        window.scrollTo({ top: scrollY + el.getBoundingClientRect().top + (el.offsetHeight - innerHeight) * [0.08, 0.32, 0.62, 0.94][index], behavior: 'smooth' });
      }} disabled={reduced}><small>0{index + 1}</small>{label}</button>)}</nav><span>{reduced ? 'Static development view' : 'Scroll to explore ↓'}</span></footer>
    </div>
  </section>;
}
