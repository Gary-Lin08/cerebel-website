import * as THREE from "three";

// Three deliberately composed depth planes: distant flecks, sparse winding paths,
// and a few defocused foreground discs. Never a uniformly filled starfield.
export function createCloud() {
  const uniforms = {
    uTime: { value: 0 }, uOpacity: { value: 1 }, uSize: { value: 1 },
    uAspect: { value: 1 }, uGlow: { value: new THREE.Vector2(9, 9) },
    uVel: { value: new THREE.Vector2() },
    uA: { value: new THREE.Color(0x269879) }, uB: { value: new THREE.Color(0x78a897) },
  };
  let seed = 91;
  const rnd = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * .7;
  const pos:number[]=[], size:number[]=[], kind:number[]=[], layer:number[]=[];
  // x/y are composition coordinates. Depth determines world scale, perspective,
  // parallax and focus independently rather than assigning arbitrary sprite sizes.
  const add=(x:number,y:number,depth:number,s:number,k:number,l:number)=>{
    pos.push(x * depth * .305, y * depth * .305, 11-depth);
    size.push(s);kind.push(k);layer.push(l);
  };
  const patches = [[-.82,.58,24],[.68,.64,21],[.94,-.36,17],[-.38,-.73,25],[.30,-.67,18],[.43,.12,22]];
  for(const [x,y,depth] of patches){
    for(let i=0;i<130;i++)add(x+gauss()*.62,y+gauss()*.72,depth+rnd()*5,1.2+rnd()*2.1,rnd(),0);
  }
  // Mid-distance irregular clusters: concentrated at edges, with clear breathing space.
  for(const [x,y,depth] of [[.83,.35,12],[-.68,-.62,15],[.38,-.78,13]]){
    for(let i=0;i<78;i++)add(x+gauss()*.48,y+gauss()*.65,depth+rnd()*3,2+rnd()*3.3,rnd(),1);
  }
  // Only five broken curves. Each changes depth, so its beads change focus and scale.
  const paths = [
    {d:24,p:[[-1,.8],[-.65,.98],[-.28,.7],[-.08,.2],[.25,-.15]]},
    {d:19,p:[[.45,1.12],[.71,.7],[.67,.3],[.92,-.05],[1.06,-.6]]},
    {d:13,p:[[-.66,-1.1],[-.55,-.65],[-.28,-.41],[-.22,-.07]]},
    {d:11,p:[[.19,-1.1],[.48,-.71],[.57,-.42],[.48,-.21],[.76,-.14]]},
    {d:7,p:[[.76,-1.12],[.98,-.79],[1.08,-.25],[.98,.12]]},
  ];
  paths.forEach(({d,p},index)=>{
    const curve=new THREE.CatmullRomCurve3(p.map(([x,y],i)=>new THREE.Vector3(x,y,Math.sin(i*1.7+index)*2)));
    for(let i=0;i<100;i++){
      const t=i/99;if((i+index*7)%29>24)continue;
      const v=curve.getPoint(t);
      add(v.x,v.y,d+v.z,index<2?1.9:2.8, .15+rnd()*.3,index<2?0:1);
    }
  });
  // A small, finite foreground layer. Large discs are uncommon and stay peripheral.
  for(let i=0;i<30;i++){
    let x=(rnd()-.5)*2.25;
    const y=(rnd()-.5)*2.3;
    if(Math.abs(x)<.55 && Math.abs(y)<.6)x=(x<0?-1:1)*(.65+rnd()*.4);
    add(x,y,5+rnd()*3,4+rnd()*10,rnd(),2);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute("aScale",new THREE.Float32BufferAttribute(size,1));
  geo.setAttribute("aKind",new THREE.Float32BufferAttribute(kind,1));
  geo.setAttribute("aLayer",new THREE.Float32BufferAttribute(layer,1));
  const points=new THREE.Points(geo,new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime,uSize,uAspect; uniform vec2 uVel;
      attribute float aScale,aKind,aLayer;
      varying float vKind,vLayer,vAlpha;
      void main(){
        vec3 p=position;p.x*=uAspect;
        p.xy+=vec2(sin(uTime*.07+aKind*30.0),cos(uTime*.05+aKind*27.0))*.045;
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        mv.xy-=uVel*(.035+aLayer*.045);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(uSize*aScale*12.0/max(2.0,-mv.z),.7,48.0*uSize);
        vKind=aKind;vLayer=aLayer;vAlpha=.88+.12*sin(uTime*.18+aKind*20.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uA,uB;uniform float uOpacity;
      varying float vKind,vLayer,vAlpha;
      void main(){
        vec2 p=gl_PointCoord-.5;
        float d=length(p);
        // Soft-edged aperture discs close to camera, sharper tiny flecks far away.
        float shape=1.0-smoothstep(.28,.5,d);
        if(vLayer>1.5){
          float angle=atan(p.y,p.x);float hex=cos(floor(.5+angle/1.0472)*1.0472-angle)*d;
          shape=1.0-smoothstep(.25,.47,mix(d,hex,.42));
        }
        vec3 c=mix(uA,uB,vKind*.7);
        float alpha=vLayer>1.5?.13:(vLayer>.5?.32:.28);
        gl_FragColor=vec4(c,shape*alpha*vAlpha*uOpacity);
      }`,
  }));
  points.frustumCulled=false;
  return {points,uniforms};
}
