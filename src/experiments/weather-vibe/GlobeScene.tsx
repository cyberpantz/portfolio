import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRef, RefObject } from 'react';
import { mesh } from 'topojson-client';
import * as THREE from 'three';
import countries from 'world-atlas/countries-110m.json';

type AnimateCameraTo = (lat: number, lng: number) => Promise<void>;

interface GlobeSceneProps {
  currentLat: number;
  currentLng: number;
  pendingPin: { lat: number; lng: number } | null;
  onPinDrop: (lat: number, lng: number) => void;
  animateCameraToRef: RefObject<AnimateCameraTo | null>;
}

export function latLngToVec3(lat: number, lng: number, r = 2): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

export function vec3ToLatLng(p: THREE.Vector3): { lat: number; lng: number } {
  const r = p.length();
  const lat = 90 - Math.acos(p.y / r) * (180 / Math.PI);
  const lng = Math.atan2(p.z, -p.x) * (180 / Math.PI) - 180;
  return { lat, lng: lng < -180 ? lng + 360 : lng };
}

type BorderGeometry = {
  type: 'MultiLineString';
  coordinates: number[][][];
};

const countryBorders = mesh(
  countries as unknown as Parameters<typeof mesh>[0],
  (countries as { objects: { countries: Parameters<typeof mesh>[1] } }).objects.countries,
) as unknown as BorderGeometry;

export function buildBorderPositions(borderGeometry: BorderGeometry, r = 2.015): Float32Array {
  const positions: number[] = [];

  for (const line of borderGeometry.coordinates) {
    for (let i = 1; i < line.length; i++) {
      const [prevLng, prevLat] = line[i - 1];
      const [lng, lat] = line[i];
      if (
        prevLng === undefined ||
        prevLat === undefined ||
        lng === undefined ||
        lat === undefined ||
        Math.abs(lng - prevLng) > 180
      ) {
        continue;
      }

      positions.push(...latLngToVec3(prevLat, prevLng, r), ...latLngToVec3(lat, lng, r));
    }
  }

  return new Float32Array(positions);
}

function CountryBorders() {
  const positions = useMemo(() => buildBorderPositions(countryBorders), []);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.42} depthTest />
    </lineSegments>
  );
}

function Pin({ lat, lng, pulse }: { lat: number; lng: number; pulse?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLngToVec3(lat, lng, 2.03), [lat, lng]);

  useFrame(({ clock }) => {
    if (!pulse || !ref.current) return;
    const scale = 1 + Math.sin(clock.elapsedTime * Math.PI) * 0.22;
    ref.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[pulse ? 0.045 : 0.052, 12, 12]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={pulse ? 0.82 : 1} />
    </mesh>
  );
}

export default function GlobeScene({
  currentLat,
  currentLng,
  pendingPin,
  onPinDrop,
  animateCameraToRef,
}: GlobeSceneProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const targetCamera = useRef<{ position: THREE.Vector3; resolve?: () => void } | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    animateCameraToRef.current = (lat, lng) => {
      targetCamera.current?.resolve?.();
      return new Promise<void>((resolve) => {
        targetCamera.current = {
          position: new THREE.Vector3(...latLngToVec3(lat, lng, 5)),
          resolve,
        };
      });
    };
    targetCamera.current = {
      position: new THREE.Vector3(...latLngToVec3(currentLat, currentLng, 5)),
    };
    return () => {
      targetCamera.current?.resolve?.();
      animateCameraToRef.current = null;
    };
  }, [animateCameraToRef, currentLat, currentLng]);

  useFrame(() => {
    if (!targetCamera.current) return;
    camera.position.lerp(targetCamera.current.position, 0.08);
    camera.lookAt(0, 0, 0);
    controlsRef.current?.update();
    if (camera.position.distanceTo(targetCamera.current.position) < 0.01) {
      targetCamera.current.resolve?.();
      targetCamera.current = null;
    }
  });

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (event.delta > 6) return;
    const point = event.point.clone().normalize().multiplyScalar(2);
    const { lat, lng } = vec3ToLatLng(point);
    onPinDrop(lat, lng);
  }

  return (
    <>
      <ambientLight intensity={1} />
      <mesh>
        <sphereGeometry args={[1.998, 36, 24]} />
        <meshBasicMaterial color="#050810" transparent opacity={0.18} depthWrite />
      </mesh>
      <CountryBorders />
      <mesh>
        <sphereGeometry args={[2, 36, 24]} />
        <meshBasicMaterial wireframe color="#ffffff" transparent opacity={0.08} />
      </mesh>
      <mesh onClick={handleClick}>
        <sphereGeometry args={[2, 36, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Pin lat={currentLat} lng={currentLng} pulse />
      {pendingPin ? <Pin lat={pendingPin.lat} lng={pendingPin.lng} /> : null}
      <OrbitControls
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        rotateSpeed={0.6}
      />
    </>
  );
}
