import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadBinary } from "../paths";
import { type Act, damp, smooth } from "../stage";

/** The repository's Blender studio export, with its authored presentation groups. */
export function createGlasses(): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32,1,.1,60);
  const rig = new THREE.Group();scene.add(rig);
  scene.add(new THREE.HemisphereLight(0xe7edff,0x242236,3));
  const lights: [number,number,number,number,number][] = [[0xffffff,7,3,5,5],[0x9b6cff,5,-5,2,-3],[0xaff4df,4,4,-1,2]];
  lights.forEach(([color,intensity,x,y,z])=>{const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);scene.add(light);});
  const parts: {node:THREE.Object3D;home:THREE.Vector3;explode:THREE.Vector3;materials:THREE.MeshStandardMaterial[]}[]=[];
  const anchors: Record<string,THREE.Vector3>={"h-optical":new THREE.Vector3(),"h-clock":new THREE.Vector3(),"h-prep":new THREE.Vector3(),"h-modular":new THREE.Vector3()};
  const groupFor:Record<string,string[]>={"g-optical":["Lenses","Optical_components"],"g-clock":["Capture_module","Electronics"],"g-prep":["Electronics"],"g-modular":["Temple_L","Temple_R"]};
  const ready=loadBinary("/assets/wearable-studio/cerebel-wearable-v1.glb").then(bytes=>new GLTFLoader().parseAsync(bytes,"")).then(gltf=>{
    const model=gltf.scene;rig.add(model);
    model.traverse(node=>{
      if(!node.userData.presentation_group)return;
      const materials:THREE.MeshStandardMaterial[]=[];
      node.traverse(child=>{
        if(!(child instanceof THREE.Mesh))return;
        const originals=Array.isArray(child.material)?child.material:[child.material];
        const replacements=originals.map(original=>{
          const material=(original as THREE.MeshStandardMaterial).clone();
          if(material.name.includes("smoke")) {material.transparent=true;material.opacity=.38;material.roughness=.16;material.metalness=.15;material.depthWrite=false;}
          else {material.roughness=.32;material.metalness=.38; if(material.name.includes("graphite"))material.color.setRGB(.055,.065,.08);}
          materials.push(material);return material;
        });
        child.material=Array.isArray(child.material)?replacements:replacements[0];
      });
      parts.push({node,home:node.position.clone(),explode:new THREE.Vector3(...node.userData.explosion_vector as [number,number,number]),materials});
    });
  }).catch(error=>{console.error("Wearable studio model could not load",error);});
  let yaw=.42;
  const steps=["g-optical","g-clock","g-prep","g-modular"];
  const act:Act={scene,camera,ready,offset:{x:.19,y:0},bg:[0x0e1521,0x05070c,0x192537],tint:[0x8fa5ca,0x9b6cff],anchors:()=>anchors,
    update(ctx){
      // Phones: the glasses sit centred in the upper half, above the copy.
      act.offset!.x=ctx.aspect>1.05?.19:0;act.offset!.y=ctx.aspect>1.05?0:.2;
      let active="";
      for(const step of steps)if(ctx.local(step)>0)active=step;
      const intro=ctx.local("glasses-intro");
      const exploded=smooth(.6,1,intro)*.25+smooth(0,.8,ctx.local("g-optical"))*.75;
      const desired=active==="g-clock"?-.7:active==="g-modular"?.9:.42;
      yaw=damp(yaw,desired,2.4,ctx.dt);
      rig.rotation.set(.18-ctx.pointer.y*.07,yaw+ctx.pointer.x*.12,0);
      rig.scale.setScalar(ctx.aspect>1.05?1:.6);
      for(const part of parts){
        part.node.position.copy(part.home).addScaledVector(part.explode,exploded);
        const selected=groupFor[active]?.includes(part.node.name)??false;
        for(const material of part.materials){material.emissive.lerp(new THREE.Color(selected?0x57318f:0x000000),1-Math.exp(-5*ctx.dt));material.emissiveIntensity=.24;}
      }
      rig.updateMatrixWorld(true);
      const named=["Optical_components","Capture_module","Electronics","Temple_R"];
      Object.values(anchors).forEach((point,i)=>{
        const part=parts.find(p=>p.node.name===named[i]);
        if(part)new THREE.Box3().setFromObject(part.node).getCenter(point);
      });
      camera.position.set(0,.45,11.5+exploded*1.3);camera.lookAt(0,0,0);
    }};
  return act;
}
