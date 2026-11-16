import * as THREE from "three";
import { type Act, smooth, damp } from "../stage";

/** An editorial diagram of the planned data loop, not a measured simulation. */
export function createFlywheel(onStep: (step: number) => void): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 60);
  const rig = new THREE.Group();
  scene.add(rig);
  rig.scale.setScalar(.82);
  const colors = [0xbceda1, 0x9b6cff, 0x81d7dc, 0xf3e9ff];
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 2), new THREE.MeshStandardMaterial({color:0x9b6cff,wireframe:true,transparent:true,opacity:.65}));
  rig.add(core);
  scene.add(new THREE.HemisphereLight(0xffffff,0x142037,3));
  const positions = Array.from({length:4},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/2)*2.4, Math.sin(i*Math.PI/2)*2.4, 0));
  const nodes = positions.map((p,i)=>{
    const group=new THREE.Group(); group.position.copy(p);
    const object=new THREE.Mesh(new THREE.IcosahedronGeometry(.23,i===2?0:1),new THREE.MeshStandardMaterial({color:colors[i],emissive:colors[i],emissiveIntensity:.5,wireframe:i===1}));
    group.add(object);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.4,.008,6,80),new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.5}));
    group.add(halo);rig.add(group);return group;
  });
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.4+i*.08,.004,5,200),new THREE.MeshBasicMaterial({color:0x8d81ac,transparent:true,opacity:.3}));
    ring.position.z=(i-1)*.12;rig.add(ring);
  }
  const count=480;
  const geometry=new THREE.BufferGeometry();
  const pos=new Float32Array(count*3);
  const color=new Float32Array(count*3);
  for(let i=0;i<count;i++)new THREE.Color(colors[Math.floor(i/count*4)]).toArray(color,i*3);
  geometry.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geometry.setAttribute("color",new THREE.BufferAttribute(color,3));
  rig.add(new THREE.Points(geometry,new THREE.PointsMaterial({size:.028,vertexColors:true,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending})));
  let previous=-1, rotation=0;
  const offset={x:.21,y:.03};
  return {scene,camera,ready:Promise.resolve(),offset,bg:[0x071b1c,0x060812,0x142a30],tint:[0xaad995,0x9b6cff],
    update(ctx){
      // Phones: the loop sits in the upper half, above the copy.
      offset.x=ctx.aspect>1.05?.21:0;offset.y=ctx.aspect>1.05?.03:.17;
      rig.scale.setScalar(ctx.aspect>1.05?1:.56);
      const step=Math.min(3,Math.max(0,Math.floor(ctx.t*4)));
      if(step!==previous){previous=step;onStep(step);}
      rotation=damp(rotation,-step*Math.PI/2,ctx.reduced?1000:3,ctx.dt);
      rig.rotation.set(.25+ctx.pointer.y*.08,ctx.pointer.x*.12,rotation);
      core.rotation.set(ctx.reduced?0:ctx.time*.12,ctx.reduced?0:ctx.time*.17,0);
      core.scale.setScalar(.8+smooth(0,1,ctx.t)*.35);
      nodes.forEach((node,i)=>node.scale.setScalar(damp(node.scale.x,i===step?1.4:.8,5,ctx.dt)));
      for(let i=0;i<count;i++){
        const t=i/count*Math.PI*2+(ctx.reduced?0:ctx.time*.17);
        const radius=2.4+Math.sin(i*17.2)*.045;
        pos[i*3]=Math.cos(t)*radius;pos[i*3+1]=Math.sin(t)*radius;pos[i*3+2]=Math.sin(i*5.7)*.15;
      }
      geometry.attributes.position.needsUpdate=true;
      camera.position.set(0,0,10.5-smooth(0,.2,ctx.t)*.7);camera.lookAt(0,0,0);
    }};
}
