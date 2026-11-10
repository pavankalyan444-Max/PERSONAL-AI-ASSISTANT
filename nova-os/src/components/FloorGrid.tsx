import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function FloorGrid() {
  const gridRef = useRef<THREE.Group>(null);

  const { gridGeo, axisGeo, radialGeo, gridMat, axisMat, accentMat, ring1Geo, ring1Mat, ring2Geo, ring2Mat, ring3Geo, ring3Mat } = useMemo(() => {
    const size = 200;
    const divisions = 40;
    const step = size / divisions;

    // 1. Grid geometry
    const gGeo = new THREE.BufferGeometry();
    const gVertices: number[] = [];
    for (let i = -divisions / 2; i <= divisions / 2; i++) {
      const pos = i * step;
      gVertices.push(-size / 2, 0, pos, size / 2, 0, pos);
      gVertices.push(pos, 0, -size / 2, pos, 0, size / 2);
    }
    gGeo.setAttribute('position', new THREE.Float32BufferAttribute(gVertices, 3));
    gGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), size);

    // 2. Axis geometry
    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      -50, 0, 0, 50, 0, 0,
      0, 0, -50, 0, 0, 50,
    ], 3));
    aGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 60);

    // 3. Radial lines
    const rGeo = new THREE.BufferGeometry();
    const rVertices: number[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      rVertices.push(0, 0, 0);
      rVertices.push(Math.cos(angle) * 30, 0, Math.sin(angle) * 30);
    }
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rVertices, 3));
    rGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 40);

    // Materials
    const gMat = new THREE.LineBasicMaterial({
      color: 0x55E8FF,
      transparent: true,
      opacity: 0.04,
      depthWrite: false,
    });

    const aMat = new THREE.LineBasicMaterial({
      color: 0x55E8FF,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });

    const accMat = new THREE.LineBasicMaterial({
      color: 0x55FFD1,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });

    const r1Geo = new THREE.RingGeometry(0.5, 1, 48);
    const r1Mat = new THREE.MeshBasicMaterial({
      color: 0x55FFD1,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const r2Geo = new THREE.RingGeometry(1.5, 1.6, 48);
    const r2Mat = new THREE.MeshBasicMaterial({
      color: 0x55E8FF,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const r3Geo = new THREE.RingGeometry(3, 3.1, 48);
    const r3Mat = new THREE.MeshBasicMaterial({
      color: 0x9A8CFF,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    return {
      gridGeo: gGeo,
      axisGeo: aGeo,
      radialGeo: rGeo,
      gridMat: gMat,
      axisMat: aMat,
      accentMat: accMat,
      ring1Geo: r1Geo,
      ring1Mat: r1Mat,
      ring2Geo: r2Geo,
      ring2Mat: r2Mat,
      ring3Geo: r3Geo,
      ring3Mat: r3Mat,
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gridGeo.dispose();
      axisGeo.dispose();
      radialGeo.dispose();
      gridMat.dispose();
      axisMat.dispose();
      accentMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      ring3Geo.dispose();
      ring3Mat.dispose();
    };
  }, [gridGeo, axisGeo, radialGeo, gridMat, axisMat, accentMat, ring1Geo, ring1Mat, ring2Geo, ring2Mat, ring3Geo, ring3Mat]);

  // Subtle rotation
  useFrame((_, delta) => {
    if (gridRef.current) {
      gridRef.current.rotation.z += 0.0004 * delta;
    }
  });

  return (
    <group ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <lineSegments geometry={gridGeo} material={gridMat} />
      <lineSegments geometry={axisGeo} material={axisMat} />
      <lineSegments geometry={radialGeo} material={accentMat} />
      <mesh geometry={ring1Geo} material={ring1Mat} position={[0, 0, 0.1]} />
      <mesh geometry={ring2Geo} material={ring2Mat} position={[0, 0, 0.15]} />
      <mesh geometry={ring3Geo} material={ring3Mat} position={[0, 0, 0.2]} />
    </group>
  );
}
