import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadBinary } from "./paths";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createMuscleVolume } from "../viewer/muscle-volumes";
import type { SwingData } from "./acts/swing";

export function mountMuscleOrbit(root: HTMLElement, data: SwingData) {
  const entry = document.createElement("button");
  entry.className = "muscle-entry";
  entry.innerHTML = '<span aria-hidden="true">+</span> Explore muscle groups';
  entry.setAttribute("aria-haspopup", "dialog");
  root.append(entry);
  const dialog = document.createElement("dialog");
  dialog.className = "muscle-orbit";
  dialog.setAttribute("aria-label", "Explore reconstructed muscle groups");
  dialog.innerHTML = '<canvas aria-label="Interactive reconstructed muscle group"></canvas><button class="orbit-close" aria-label="Close muscle exploration">×</button><div class="orbit-copy"><p>Inside the movement</p><h2></h2><p class="orbit-detail"></p><p class="orbit-cue"></p></div><nav aria-label="Muscle groups"></nav><footer>Drag to orbit · Scroll to zoom<br>Captured pose + model-derived muscle paths. Muscle volume is schematic; coaching is inferred, not measured with EMG.</footer>';
  document.body.append(dialog);
  const canvas = dialog.querySelector("canvas")!;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 40);
  camera.position.set(0, .2, 8);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 7;
  scene.add(new THREE.HemisphereLight(0xf0eaff, 0x251336, 1.6));
  const light = new THREE.DirectionalLight(0xffffff, 2.2);
  light.position.set(3, 4, 5); scene.add(light);
  const anatomy = new THREE.Group(); scene.add(anatomy);
  const sculpture = new THREE.Group(); anatomy.add(sculpture);
  let bones: THREE.Group | undefined;
  let boneNodes: (THREE.Object3D | undefined)[] = [];
  entry.disabled = true;
  entry.setAttribute("aria-label", "Loading muscle anatomy");
  loadBinary(data.skeleton.boneModelUrl).then(bytes => new GLTFLoader().parseAsync(bytes, "")).then(gltf => {
    bones = gltf.scene; anatomy.add(bones);
    boneNodes = data.skeleton.bodyNames.map((name,i) => {
      const node = bones!.getObjectByName(name);
      if(node) {
        node.visible = i < 13;
        node.traverse(child => {if(child instanceof THREE.Mesh) child.material = new THREE.MeshStandardMaterial({color:0x8f9ba8,roughness:.72,metalness:.08});});
      }
      return node;
    });
    entry.disabled = false;
    entry.setAttribute("aria-label", "Explore muscle groups");
  }).catch(() => {entry.disabled = false; entry.setAttribute("aria-label", "Explore muscle paths; bone context unavailable");});
  const rings = new THREE.Group(); scene.add(rings);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65 + i * .18, .003, 6, 120), new THREE.MeshBasicMaterial({color:i === 1 ? 0xa0dc8b : 0x9b6cff, transparent:true, opacity:.12}));
    ring.rotation.set(.7 + i * .4, i * .5, 0); rings.add(ring);
  }
  const satellites = data.muscleGroups.map((group, i) => {
    const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(.055, 1), new THREE.MeshStandardMaterial({color:group.color, emissive:group.color, emissiveIntensity:.8}));
    const angle = i / data.muscleGroups.length * Math.PI * 2;
    dot.position.set(Math.cos(angle)*1.65, Math.sin(angle)*1.15, Math.sin(angle)*.5);
    dot.userData.index = i; scene.add(dot); return dot;
  });
  const buttons: HTMLButtonElement[] = [];
  let selected = -1;
  let entering = false;
  let animation = 0;
  let last = 0;
  let previousOverflow = "";
  let previousFocus: HTMLElement | null = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function select(index: number) {
    if (selected === index) return;
    selected = index;
    sculpture.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    sculpture.clear();
    const group = data.muscleGroups[index];
    const finding = data.annotations.find(note => note.group === group.id);
    const frame = finding?.hold ?? 0;
    const paths = data.skeleton.muscleNames.flatMap((name, i) => group.muscles.includes(name) ? [data.skeleton.muscles[frame][i]] : []);
    const pose = data.skeleton.frames[frame];
    boneNodes.forEach((node,i) => {
      if(!node)return;
      node.position.fromArray(pose,i*7);node.quaternion.fromArray(pose,i*7+3);
    });
    const volume = createMuscleVolume(group.color, paths.map(points => points.length));
    volume.update(paths.map(points => new Float32Array(points.flat())), 1, 1, 0);
    sculpture.add(volume.group);
    // Keep every path registered to the same skeleton coordinates, never normalize them separately.
    const context: number[] = [];
    data.skeleton.muscles[frame].forEach(points => {
      for(let i=1;i<points.length;i++)context.push(...points[i-1],...points[i]);
    });
    sculpture.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position",new THREE.Float32BufferAttribute(context,3)),new THREE.LineBasicMaterial({color:0x9ba8b8,transparent:true,opacity:.13})));
    const pelvis = new THREE.Vector3().fromArray(pose,0);
    anatomy.scale.setScalar(2.5);
    anatomy.position.copy(pelvis).multiplyScalar(-2.5).add(new THREE.Vector3(0,1.0,0));
    anatomy.rotation.y = 0;
    dialog.querySelector("h2")!.textContent = group.label;
    dialog.querySelector(".orbit-detail")!.textContent = finding?.detail ?? "Explore the reconstructed muscle paths.";
    dialog.querySelector(".orbit-cue")!.textContent = finding?.cue ?? "";
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(index === i)));
    satellites.forEach((dot, i) => dot.scale.setScalar(index === i ? 1.8 : 1));
  }
  data.muscleGroups.forEach((group, i) => {
    const button = document.createElement("button");
    button.textContent = group.label;
    button.onclick = () => select(i);
    dialog.querySelector("nav")!.append(button); buttons.push(button);
  });
  function resize() {
    const width = innerWidth > 700 ? innerWidth * .62 : innerWidth;
    renderer.setSize(width, innerHeight);
    camera.aspect = width / innerHeight; camera.updateProjectionMatrix();
  }
  function draw(now: number) {
    if (!dialog.open) return;
    const dt = Math.max(.001, Math.min((now-last)/1000, .05)); last=now;
    if (entering) {
      camera.position.multiplyScalar(1 + (5.8/camera.position.length()-1)*(1-Math.exp(-dt*3)));
      if (Math.abs(camera.position.length()-5.8)<.02) entering=false;
    }
    if (!reduced) rings.rotation.y += dt*.045;
    controls.update(); renderer.render(scene,camera);
    animation=requestAnimationFrame(draw);
  }
  entry.onclick = () => {
    previousFocus = document.activeElement as HTMLElement;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow="hidden";
    select(Math.max(0,selected)); dialog.showModal(); resize();
    camera.position.set(3.6,.7,reduced?4.5:7); entering=!reduced;
    last=performance.now(); animation=requestAnimationFrame(draw);
  };
  dialog.querySelector<HTMLButtonElement>(".orbit-close")!.onclick=()=>dialog.close();
  dialog.addEventListener("close",()=>{
    cancelAnimationFrame(animation); document.documentElement.style.overflow=previousOverflow;
    previousFocus?.focus({preventScroll:true});
  });
  controls.addEventListener("start",()=>{entering=false;});
  const raycaster=new THREE.Raycaster();
  canvas.addEventListener("click",event=>{
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-canvas.getBoundingClientRect().left)/canvas.clientWidth*2-1,1-event.clientY/canvas.clientHeight*2),camera);
    const hit=raycaster.intersectObjects(satellites)[0];
    if(hit)select(hit.object.userData.index as number);
  });
  window.addEventListener("resize",()=>{if(dialog.open)resize();});
}
