import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function AmbientParticles() {
  const { scene } = useThree();
  const particlesRef = useRef<THREE.Points>(null);
  
  const particleCount = 800;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const alphas = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      // Distribute in a large sphere around the scene
      const radius = 80 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      
      sizes[i] = 0.3 + Math.random() * 1.5;
      alphas[i] = 0.1 + Math.random() * 0.4;
      speeds[i] = 0.0005 + Math.random() * 0.002;
      
      // Color variation: mostly cyan, some teal, rare violet
      const colorChoice = Math.random();
      if (colorChoice < 0.6) {
        colors[i * 3] = 0; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1; // cyan
      } else if (colorChoice < 0.9) {
        colors[i * 3] = 0; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 0.8; // teal
      } else {
        colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.55; colors[i * 3 + 2] = 1; // violet
      }
    }
    
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    g.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return g;
  }, []);
  
  const material = useMemo(() => new THREE.PointsMaterial({
    size: 1,
    transparent: true,
    opacity: 1,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  }), []);
  
  useEffect(() => {
    const particles = new THREE.Points(geometry, material);
    particlesRef.current = particles;
    scene.add(particles);
    
    return () => {
      scene.remove(particles);
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material, scene]);
  
  useFrame((state) => {
    if (!particlesRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const alphas = particlesRef.current.geometry.attributes.alpha.array as Float32Array;
    const speeds = particlesRef.current.geometry.attributes.speed.array as Float32Array;
    
    for (let i = 0; i < positions.length / 3; i++) {
      // Very slow orbital drift
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      
      // Very slow orbital rotation
      const radius = Math.sqrt(x * x + z * z);
      const angle = Math.atan2(z, x) + speeds[i] * 0.1;
      positions[i * 3] = radius * Math.cos(angle);
      positions[i * 3 + 2] = radius * Math.sin(angle);
      
      // Very slow vertical drift
      positions[i * 3 + 1] += speeds[i] * 0.05;
      
      // Reset if too far
      if (positions[i * 3 + 1] > 150) {
        positions[i * 3 + 1] = -150;
      }
      
      // Alpha pulse
      alphas[i] = 0.1 + 0.3 * Math.sin(time * 0.5 + i * 0.01);
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
  });
  
  return <points ref={particlesRef} />;
}
