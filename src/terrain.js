import * as THREE from 'three';
import { fbm, noiseTexture } from './noise.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const WIND = 0.55;
const cw = Math.cos(WIND), sw = Math.sin(WIND);

// Perfil de duna asimétrico: ladera de barlovento suave, cara de avalancha empinada.
function duneProfile(f) {
  const crest = 0.78;
  if (f < crest) {
    const t = f / crest;
    return t * t * (3 - 2 * t);
  }
  const t = (f - crest) / (1 - crest);
  return (1 - t) * (1 - t);
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z);

  // Ondulaciones amplias del terreno
  let h = fbm(x * 0.004, z * 0.004, 4) * 14;

  // Campo de dunas
  const d = x * cw + z * sw;
  const warp = fbm(x * 0.008, z * 0.008, 3, 3.3) * 40;
  const p = (d + warp) / 55;
  const dune = duneProfile(p - Math.floor(p));
  const duneMask = (0.45 + 0.55 * smooth(-0.3, 0.25, fbm(x * 0.005 + 20, z * 0.005, 2, 1.7))) * smooth(22, 80, r);
  h += dune * 10 * duneMask;

  // Ripples de viento
  h += Math.sin((d + warp * 0.2) * 1.6) * 0.06 * duneMask;

  // Pequeño relieve rocoso
  h += fbm(x * 0.06, z * 0.06, 3, 9.1) * 0.8;

  // Mesetas / montañas lejanas
  const m = smooth(380, 1100, r);
  if (m > 0) {
    const ridged = 1 - Math.abs(fbm(x * 0.002, z * 0.002, 5, 4.2));
    h += m * Math.pow(ridged, 3) * 110;
  }
  return h;
}

export function createTerrain() {
  const SIZE = 3200, SEG = 560;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  // Colores por vértice: crestas claras, valles y pendientes más oscuros.
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xc77846);
  const dark = new THREE.Color(0x6e3520);
  const pale = new THREE.Color(0xd9a06a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const n = fbm(x * 0.02, z * 0.02, 3, 5.5);
    c.copy(sand).lerp(pale, smooth(-0.1, 0.4, n + y * 0.015));
    c.lerp(dark, Math.min(1, slope * 2.2 + smooth(0.1, 0.5, -n) * 0.35));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const tex = new THREE.CanvasTexture(noiseTexture(512, 10, 5));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(SIZE / 14, SIZE / 14);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;

  const bump = new THREE.CanvasTexture(noiseTexture(512, 24, 4));
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(SIZE / 2, SIZE / 2);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: tex,
    bumpMap: bump,
    bumpScale: 0.35,
    roughness: 0.97,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
