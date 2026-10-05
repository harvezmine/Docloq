import { forwardRef } from 'react';
import { RoundedBox } from '@react-three/drei';

const metal = (color, emissive, ei = 0.18) => (
  <meshStandardMaterial color={color} roughness={0.28} metalness={0.85} emissive={emissive} emissiveIntensity={ei} />
);

export const Folder3D = forwardRef(function Folder3D({ hintRef, docTexes = [] }, ref) {
  return (
    <group ref={ref} scale={0.001}>

      <RoundedBox args={[2.5, 1.85, 0.07]} radius={0.06} smoothness={3} position={[0, 0.1, -0.14]}>
        {metal('#312e81', '#6366f1', 0.16)}
      </RoundedBox>

      <RoundedBox args={[0.92, 0.3, 0.07]} radius={0.06} smoothness={3} position={[-0.72, 1.1, -0.14]}>
        {metal('#3730a3', '#6366f1', 0.2)}
      </RoundedBox>

      <group ref={hintRef} position={[0, 0, 0]}>
        {docTexes.map((tex, i) => (
          <mesh key={i} position={[(i - (docTexes.length - 1) / 2) * 0.32, 0.42 + (i % 2) * 0.1, -0.05 + i * 0.03]}>
            <boxGeometry args={[1.5, 2.05, 0.015]} />
            <meshStandardMaterial map={tex} roughness={0.45} metalness={0.1} />
          </mesh>
        ))}
      </group>

      <RoundedBox args={[2.5, 1.5, 0.07]} radius={0.06} smoothness={3} position={[0, -0.28, 0.12]}>
        {metal('#4338ca', '#818cf8', 0.22)}
      </RoundedBox>

      <mesh position={[0, -0.28, 0.17]}>
        <planeGeometry args={[0.95, 0.13]} />
        <meshStandardMaterial color="#a5b4fc" roughness={0.5} metalness={0.2} transparent opacity={0.4} />
      </mesh>

      <mesh position={[0, 0.44, 0.17]}>
        <boxGeometry args={[2.42, 0.025, 0.01]} />
        <meshBasicMaterial color="#818cf8" toneMapped={false} transparent opacity={0.45} />
      </mesh>
    </group>
  );
});

export const Vault3D = forwardRef(function Vault3D({ doorRef, wheelRef, bodyMatRef, glow }, ref) {
  return (
    <group ref={ref} scale={0.001}>

      <RoundedBox args={[2.5, 2.5, 1.3]} radius={0.18} smoothness={4}>
        <meshStandardMaterial ref={bodyMatRef} color="#1b2138" roughness={0.34} metalness={0.9} emissive="#6366f1" emissiveIntensity={0.06} />
      </RoundedBox>

      <RoundedBox args={[2.26, 2.26, 0.07]} radius={0.14} smoothness={3} position={[0, 0, 0.64]}>
        <meshStandardMaterial color="#242c4d" roughness={0.4} metalness={0.85} emissive="#818cf8" emissiveIntensity={0.05} />
      </RoundedBox>

      <mesh position={[0, 0, 0.69]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.04, 1.04, 0.06, 44]} />
        <meshStandardMaterial color="#151a2e" roughness={0.45} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.73]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.028, 10, 48]} />
        <meshStandardMaterial color="#39406b" roughness={0.3} metalness={0.9} emissive="#818cf8" emissiveIntensity={0.12} />
      </mesh>

      <mesh position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.88, 0.88, 0.06, 36]} />
        <meshBasicMaterial color="#070b16" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.68]}>
        <planeGeometry args={[1.8, 1.8]} />
        <meshBasicMaterial map={glow} transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy], i) => (
        <mesh key={i} position={[sx * 1.0, sy * 1.0, 0.69]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#7c86c4" roughness={0.3} metalness={0.9} emissive="#818cf8" emissiveIntensity={0.15} />
        </mesh>
      ))}

      <group ref={doorRef} position={[0.92, 0, 0.74]}>

        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 14]} />
          <meshStandardMaterial color="#2a3150" roughness={0.35} metalness={0.9} />
        </mesh>
        <group position={[-0.92, 0, 0]}>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.9, 0.9, 0.15, 44]} />
            <meshStandardMaterial color="#222a49" roughness={0.32} metalness={0.9} emissive="#6366f1" emissiveIntensity={0.06} />
          </mesh>

          <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.82, 0.03, 10, 48]} />
            <meshStandardMaterial color="#39406b" roughness={0.3} metalness={0.9} emissive="#818cf8" emissiveIntensity={0.1} />
          </mesh>
          <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.56, 0.022, 10, 44]} />
            <meshStandardMaterial color="#39406b" roughness={0.3} metalness={0.9} emissive="#818cf8" emissiveIntensity={0.08} />
          </mesh>

          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.09]}>
                <cylinderGeometry args={[0.035, 0.035, 0.05, 10]} />
                <meshStandardMaterial color="#7c86c4" roughness={0.3} metalness={0.9} />
              </mesh>
            );
          })}

          <group ref={wheelRef} position={[0, 0, 0.16]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.38, 0.042, 12, 36]} />
              <meshStandardMaterial color="#8e99d6" roughness={0.25} metalness={0.95} emissive="#a5b4fc" emissiveIntensity={0.15} />
            </mesh>
            {[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((a, i) => (
              <mesh key={i} rotation={[0, 0, a]}>
                <boxGeometry args={[0.76, 0.04, 0.04]} />
                <meshStandardMaterial color="#8e99d6" roughness={0.25} metalness={0.95} emissive="#a5b4fc" emissiveIntensity={0.12} />
              </mesh>
            ))}
            <mesh>
              <sphereGeometry args={[0.08, 14, 14]} />
              <meshStandardMaterial color="#aeb8e8" roughness={0.2} metalness={0.95} emissive="#c7d2fe" emissiveIntensity={0.2} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
});

export const DokiBotFull = forwardRef(function DokiBotFull({ visorMatRef, ringRef, armLRef, armRRef }, ref) {
  return (
    <group ref={ref}>

      <group position={[0, 0.62, 0]}>
        <RoundedBox args={[1.28, 0.95, 0.85]} radius={0.24} smoothness={4}>
          <meshStandardMaterial color="#2e1065" roughness={0.3} metalness={0.7} emissive="#6d28d9" emissiveIntensity={0.25} />
        </RoundedBox>

        <RoundedBox args={[0.95, 0.4, 0.08]} radius={0.08} smoothness={3} position={[0, 0.05, 0.44]}>
          <meshStandardMaterial ref={visorMatRef} color="#0b1226" roughness={0.2} metalness={0.4} emissive="#22d3ee" emissiveIntensity={0.5} />
        </RoundedBox>

        {[-0.22, 0.22].map((ex) => (
          <mesh key={ex} position={[ex, 0.05, 0.5]}>
            <capsuleGeometry args={[0.055, 0.08, 4, 10]} />
            <meshBasicMaterial color="#a5f3fc" toneMapped={false} />
          </mesh>
        ))}

        <mesh position={[0, 0.66, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.38, 8]} />
          {metal('#4c1d95', '#8b5cf6', 0.3)}
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#c4b5fd" toneMapped={false} />
        </mesh>
      </group>

      <group position={[0, -0.42, 0]}>
        <RoundedBox args={[0.95, 1.05, 0.62]} radius={0.24} smoothness={4}>
          <meshStandardMaterial color="#ede9fe" roughness={0.35} metalness={0.35} emissive="#a78bfa" emissiveIntensity={0.08} />
        </RoundedBox>

        <mesh position={[0, 0.08, 0.33]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#8b5cf6" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.08, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.17, 0.02, 8, 24]} />
          {metal('#c4b5fd', '#8b5cf6', 0.4)}
        </mesh>
      </group>

      <group ref={armLRef} position={[-0.72, -0.32, 0]} rotation={[0, 0, 0.25]}>
        <mesh>
          <capsuleGeometry args={[0.13, 0.5, 6, 12]} />
          <meshStandardMaterial color="#ddd6fe" roughness={0.35} metalness={0.4} emissive="#a78bfa" emissiveIntensity={0.1} />
        </mesh>
      </group>
      <group ref={armRRef} position={[0.72, -0.32, 0]} rotation={[0, 0, -0.25]}>
        <mesh>
          <capsuleGeometry args={[0.13, 0.5, 6, 12]} />
          <meshStandardMaterial color="#ddd6fe" roughness={0.35} metalness={0.4} emissive="#a78bfa" emissiveIntensity={0.1} />
        </mesh>
      </group>

      <mesh position={[0, -1.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.03, 10, 36]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.55} toneMapped={false} />
      </mesh>

      <group rotation={[1.15, 0, 0.2]} position={[0, 0.62, 0]} ref={ringRef}>
        <mesh>
          <torusGeometry args={[1.1, 0.012, 8, 56]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.65} toneMapped={false} />
        </mesh>
        <mesh position={[1.1, 0, 0]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshBasicMaterial color="#e9d5ff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
});

export const Gavel3D = forwardRef(function Gavel3D({ armRef, headMatRef }, ref) {
  return (
    <group ref={ref}>

      <mesh position={[0.55, -1.05, 0]}>
        <cylinderGeometry args={[0.62, 0.74, 0.12, 28]} />
        {metal('#0e3742', '#22d3ee')}
      </mesh>

      <mesh position={[0.55, -0.86, 0]}>
        <cylinderGeometry args={[0.46, 0.52, 0.22, 26]} />
        {metal('#12414f', '#22d3ee', 0.22)}
      </mesh>
      <mesh position={[0.55, -0.73, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.02, 8, 26]} />
        {metal('#2ac8e8', '#22d3ee', 0.35)}
      </mesh>

      <group ref={armRef} position={[-0.85, 0.15, 0]}>

        <mesh position={[0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.07, 1.5, 14]} />
          {metal('#155e6e', '#22d3ee', 0.2)}
        </mesh>

        <mesh position={[-0.02, 0, 0]}>
          <sphereGeometry args={[0.1, 14, 14]} />
        {metal('#2ac8e8', '#22d3ee', 0.35)}
        </mesh>

        <group position={[1.42, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.26, 0.26, 0.72, 22]} />
            <meshStandardMaterial ref={headMatRef} color="#0e3742" roughness={0.25} metalness={0.85} emissive="#22d3ee" emissiveIntensity={0.2} />
          </mesh>

          {[-0.37, 0.37].map((hx) => (
            <mesh key={hx} position={[hx, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.29, 0.29, 0.07, 22]} />
              {metal('#2ac8e8', '#22d3ee', 0.35)}
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
});
