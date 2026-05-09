import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, BufferAttribute, ShaderMaterial, DoubleSide } from 'three';
// @ts-ignore
import grassBladeVert from '../shaders/grassBlade.vert.glsl?raw';
// @ts-ignore
import grassBladeFrag from '../shaders/grassBlade.frag.glsl?raw';

const BLADE_SEGS = 4;
const BLADE_VERTS = (BLADE_SEGS + 1) * 2; // 10 vertices per blade

interface Props {
  count?: number;
  spreadX?: number;
  spreadZ?: number;
  groundY?: number;
  maxBladeH?: number;
  windStrength?: number;
  colorBase: readonly [number, number, number];
  colorTip:  readonly [number, number, number];
}

export function GrassField({
  count = 40000,
  spreadX = 80,
  spreadZ = 80,
  groundY = 0,
  maxBladeH = 0.60,
  windStrength = 1.0,
  colorBase,
  colorTip,
}: Props) {
  const matRef = useRef<ShaderMaterial>(null);

  // Uniforms are stable — colors & strength don't change at runtime
  const uniforms = useMemo(() => ({
    uTime:         { value: 0 },
    uWindStrength: { value: windStrength },
    uGroundY:      { value: groundY },
    uColorBase:    { value: colorBase },
    uColorTip:     { value: colorTip },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const geometry = useMemo(() => {
    const trisPerBlade = BLADE_SEGS * 2;
    const totalVerts   = count * BLADE_VERTS;

    // Dummy position buffer (all zeros): the vertex shader computes real positions
    // from vindex+offset+shape. Required by Three.js BufferGeometry.
    const positions = new Float32Array(totalVerts * 3);
    const vindex    = new Float32Array(totalVerts);
    const offsetArr = new Float32Array(totalVerts * 4); // (bx, bz, 0, rot)
    const shapeArr  = new Float32Array(totalVerts * 4); // (width, height, lean, curve)
    const colorVar  = new Float32Array(totalVerts);
    const idx       = new Uint32Array(count * trisPerBlade * 3);

    let ii = 0;

    for (let b = 0; b < count; b++) {
      const bx    = (Math.random() - 0.5) * spreadX;
      const bz    = (Math.random() - 0.5) * spreadZ;
      const rot   = Math.random() * Math.PI * 2.0;
      const w     = 0.05 + Math.random() * 0.04;
      const h     = maxBladeH * (0.5 + Math.random() * 0.8);
      const lean  = 0.05 + Math.random() * 0.25;
      const curve = 0.05 + Math.random() * 0.30;
      const cv    = (Math.random() - 0.5) * 0.4;

      const baseVi = b * BLADE_VERTS;

      for (let v = 0; v < BLADE_VERTS; v++) {
        const vi = baseVi + v;
        vindex[vi]       = v;
        offsetArr[vi*4]   = bx;
        offsetArr[vi*4+1] = bz;
        offsetArr[vi*4+2] = 0;
        offsetArr[vi*4+3] = rot;
        shapeArr[vi*4]    = w;
        shapeArr[vi*4+1]  = h;
        shapeArr[vi*4+2]  = lean;
        shapeArr[vi*4+3]  = curve;
        colorVar[vi]      = cv;
      }

      // Two triangles per segment
      for (let s = 0; s < BLADE_SEGS; s++) {
        const base = baseVi + s * 2;
        idx[ii++] = base;   idx[ii++] = base+1; idx[ii++] = base+2;
        idx[ii++] = base+1; idx[ii++] = base+3; idx[ii++] = base+2;
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('vindex',   new BufferAttribute(vindex, 1));
    geo.setAttribute('offset',   new BufferAttribute(offsetArr, 4));
    geo.setAttribute('shape',    new BufferAttribute(shapeArr, 4));
    geo.setAttribute('aColorVar', new BufferAttribute(colorVar, 1));
    geo.setIndex(new BufferAttribute(idx, 1));
    return geo;
  }, [count, spreadX, spreadZ, groundY, maxBladeH]);

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    // frustumCulled=false because positions are all-zero in the buffer;
    // real geometry is computed in the vertex shader
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={grassBladeVert}
        fragmentShader={grassBladeFrag}
        uniforms={uniforms}
        side={DoubleSide}
      />
    </mesh>
  );
}
