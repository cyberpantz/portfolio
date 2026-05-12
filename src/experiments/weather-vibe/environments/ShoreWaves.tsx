import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshBasicMaterial } from 'three';

const WAVE_COUNT = 5;

interface ShoreWavesProps {
  groundY:    number;
  waveColor?: string;
  foamColor?: string;
  shoreZ?:    number;  // world-Z where waves wash ashore
  originZ?:   number;  // world-Z where waves are born
}

// Rolls WAVE_COUNT wave strips from originZ toward shoreZ.
// Each strip has a water-body plane + a foam-crest plane.
// A beach-swash plane lunges up the sand and retracts on a ~4 s cycle.
export function ShoreWaves({
  groundY,
  waveColor = '#88BBD8',
  foamColor = '#E2F2FF',
  shoreZ    = -14,
  originZ   = -58,
}: ShoreWavesProps) {
  const waveRefs  = useRef<(any)[]>(Array(WAVE_COUNT).fill(null));
  const foamRefs  = useRef<(any)[]>(Array(WAVE_COUNT).fill(null));
  const swashRef  = useRef<any>(null);
  const span      = shoreZ - originZ;            // negative → toward camera

  const states = useRef(
    Array.from({ length: WAVE_COUNT }, (_, i) => ({
      z:     originZ + (i / WAVE_COUNT) * span,  // evenly staggered
      speed: 0.07 + Math.random() * 0.025,
    }))
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    states.current.forEach((s, i) => {
      s.z += s.speed;
      if (s.z > shoreZ) {
        s.z    = originZ - Math.random() * 6;
        s.speed = 0.065 + Math.random() * 0.025;
      }

      const progress = Math.max(0, (s.z - originZ) / span); // 0 = far, 1 = shore
      const env      = Math.sin(Math.min(progress, 1) * Math.PI);  // bell curve opacity

      const wm = waveRefs.current[i] as any;
      const fm = foamRefs.current[i] as any;
      if (wm) {
        wm.position.z = s.z;
        wm.position.y = groundY - 0.30;
        (wm.material as MeshBasicMaterial).opacity = env * 0.38;
      }
      if (fm) {
        fm.position.z = s.z + 0.8;
        fm.position.y = groundY - 0.25;
        (fm.material as MeshBasicMaterial).opacity = env * 0.70;
      }
    });

    // Swash: thin wet sheen that lunges up the sand and retreats
    if (swashRef.current) {
      const phase = (t * 0.24) % 1;                     // ~4 s cycle
      const reach = Math.sin(phase * Math.PI);
      swashRef.current.position.z = shoreZ + 2 + reach * 5;
      swashRef.current.scale.z    = 1 + reach * 0.7;
      swashRef.current.position.y = groundY - 0.28;
      (swashRef.current.material as MeshBasicMaterial).opacity = reach * 0.25;
    }
  });

  return (
    <>
      {states.current.map((s, i) => (
        <group key={i}>
          {/* Wave body */}
          <mesh
            ref={el => { waveRefs.current[i] = el; }}
            position={[0, groundY - 0.30, s.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[180, 3.2]} />
            <meshBasicMaterial color={waveColor} transparent opacity={0.25} depthWrite={false} />
          </mesh>
          {/* Foam crest */}
          <mesh
            ref={el => { foamRefs.current[i] = el; }}
            position={[0, groundY - 0.25, s.z + 0.9]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[180, 0.9]} />
            <meshBasicMaterial color={foamColor} transparent opacity={0.55} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* Beach swash */}
      <mesh
        ref={swashRef}
        position={[0, groundY - 0.28, shoreZ + 3]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[220, 9]} />
        <meshBasicMaterial color={foamColor} transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </>
  );
}
