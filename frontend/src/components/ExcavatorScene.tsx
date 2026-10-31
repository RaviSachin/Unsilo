import { Canvas } from "@react-three/fiber";
import { Float, ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";

function Excavator(){
 return <group position={[0,-.55,0]} rotation={[0,-.38,0]}>
  {/* tracks */}
  <mesh position={[0,.28,0]} castShadow><boxGeometry args={[2.25,.38,.72]}/><meshStandardMaterial color="#26332d" metalness={.65} roughness={.38}/></mesh>
  {[-.82,-.42,0,.42,.82].map((x,i)=><mesh key={i} position={[x,.28,.38]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.14,.14,.08,24]}/><meshStandardMaterial color="#89918a" metalness={.8}/></mesh>)}
  <mesh position={[0,.68,0]} castShadow><boxGeometry args={[1.18,.55,.72]}/><meshStandardMaterial color="#d6a72e" metalness={.35} roughness={.45}/></mesh>
  <mesh position={[.28,1.13,-.04]} castShadow><boxGeometry args={[.68,.68,.62]}/><meshStandardMaterial color="#e4b83e" metalness={.25}/></mesh>
  <mesh position={[.3,1.16,.29]}><boxGeometry args={[.42,.43,.018]}/><meshStandardMaterial color="#172c2d" metalness={.3} roughness={.18}/></mesh>
  <mesh position={[-.12,1.16,-.02]} rotation={[0,0,-.48]} castShadow><boxGeometry args={[1.15,.13,.16]}/><meshStandardMaterial color="#e8bd4e" metalness={.4}/></mesh>
  <mesh position={[-.72,1.54,-.02]} rotation={[0,0,.48]} castShadow><boxGeometry args={[.88,.12,.14]}/><meshStandardMaterial color="#e8bd4e" metalness={.4}/></mesh>
  <mesh position={[-1.18,1.33,-.02]} rotation={[0,0,-.3]} castShadow><boxGeometry args={[.35,.3,.22]}/><meshStandardMaterial color="#b98224" metalness={.35}/></mesh>
  <mesh position={[.7,.9,-.02]}><cylinderGeometry args={[.07,.07,.5,16]}/><meshStandardMaterial color="#9b762c" metalness={.8}/></mesh>
 </group>
}
export default function ExcavatorScene(){
 return <div className="absolute inset-0">
  <Canvas camera={{position:[3.7,2.5,4.8],fov:37}} dpr={[1,1.6]} shadows>
   <ambientLight intensity={1.15}/><directionalLight position={[4,6,4]} intensity={2.1} castShadow/>
   <Suspense fallback={null}><Float speed={1.3} rotationIntensity={.08} floatIntensity={.15}><Excavator/></Float><ContactShadows position={[0,-.3,0]} opacity={.45} scale={6} blur={2.5}/><Environment preset="city"/></Suspense>
   <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={.9} maxPolarAngle={1.8} autoRotate autoRotateSpeed={.55}/>
  </Canvas>
 </div>
}