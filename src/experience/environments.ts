import * as THREE from "three";
import type { Act } from "./stage";

/** Decorative geometry, separate from the measured capture and its annotations. */
export function addEnvironments(acts: Act[]) {
  acts.forEach((act, index) => {
    if(index === 5) return;
    const environment = new THREE.Group();
    const material = new THREE.LineBasicMaterial({color:act.tint?.[1] ?? 0x9b6cff,transparent:true,opacity:.13,depthWrite:false});
    // Fine spatial structures give each act a different silhouette.
    for(let i=0;i<7;i++){
      const points: THREE.Vector3[]=[];
      for(let j=0;j<=96;j++){
        const t=j/96*Math.PI*2;
        if(index===2){
          points.push(new THREE.Vector3((j/96-.5)*32,-1.8+i*.03, -5-i*2+Math.sin(t*2+i)*.8));
        }else if(index===3){
          points.push(new THREE.Vector3((j/96-.5)*20, -1.5+i*.7,-5-Math.sin(t)*.4));
        }else if(index===4){
          points.push(new THREE.Vector3(Math.cos(t)*(3+i*.25),Math.sin(t)*(2+i*.2),-4-i*.45));
        }else{
          const r=3+i*.5;
          points.push(new THREE.Vector3(Math.cos(t)*r,Math.sin(t)*r*.65,-4+Math.sin(t*3+i)*.6));
        }
      }
      environment.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material));
    }
    if(index===2){
      const geometry=new THREE.ConeGeometry(.7,2.8,5);
      for(let i=0;i<16;i++){
        const tree=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),material);
        tree.position.set((i%2?1:-1)*(4+i*.25),-.2,-4-Math.floor(i/2)*3);
        environment.add(tree);
      }
      geometry.dispose();
    }
    act.scene.add(environment);
    const update=act.update.bind(act);
    act.update=ctx=>{
      update(ctx);
      // Slow depth movement; no spring-back or high-speed background motion.
      environment.rotation.y=ctx.reduced?0:Math.sin(ctx.time*.035+index)*.06;
      environment.position.y=index===6?-ctx.t*25:0;
    };
  });
}
