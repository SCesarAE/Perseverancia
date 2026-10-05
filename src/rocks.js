import * as THREE from 'three';
import { fbm, noiseTexture } from './noise.js';
import { heightAt } from './terrain.js';

function rockGeometry(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.2 + seed, v.y * 1.2, 4, v.z * 1.2 + seed);
    // Facetas: cuantizar un poco el ruido para aristas de roca fracturada
    const facet = Math.round(n * 5) / 5;
    v.multiplyScalar(1 + n * 0.45 + facet * 0.25);
    p.setXYZ(i, v.x, v.y * 0.7, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// PRNG determinista para que la escena sea siempre igual.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRocks() {
  const group = new THREE.Group();
  const rand = mulberry32(42);
  const tex = new THREE.CanvasTexture(noiseTexture(256, 5, 5));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7a4a34, map: tex, bumpMap: tex, bumpScale: 2, roughness: 0.92,
  });

  const KINDS = 8, COUNT = 520;
  const geos = Array.from({ length: KINDS }, (_, i) => rockGeometry(i * 3.7));
  const meshes = geos.map((g) => {
    const m = new THREE.InstancedMesh(g, mat, COUNT);
    m.castShadow = m.receiveShadow = true;
    m.count = 0;
    group.add(m);
    return m;
  });

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    // Distribución más densa cerca de la cámara, con algunas rocas grandes.
    const r = Math.pow(rand(), 1.6) * 160;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 5;
    const big = rand() < 0.06;
    const s = big ? 1.4 + rand() * 1.8 : 0.12 + Math.pow(rand(), 2.5) * 1.0;
    dummy.position.set(x, heightAt(x, z) + s * 0.15, z);
    dummy.rotation.set(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6);
    dummy.scale.set(s * (0.8 + rand() * 0.5), s * (0.6 + rand() * 0.6), s * (0.8 + rand() * 0.5));
    dummy.updateMatrix();
    const m = meshes[i % KINDS];
    m.setMatrixAt(m.count, dummy.matrix);
    m.setColorAt(m.count, color.setHSL(0.045 + rand() * 0.03, 0.3 + rand() * 0.2, 0.5 + rand() * 0.2));
    m.count++;
  }
  return group;
}
