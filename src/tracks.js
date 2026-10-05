import * as THREE from 'three';
import { heightAt } from './terrain.js';

// Huellas de las ruedas: quads instanciados sobre el terreno, en buffer circular.
const MAX = 8000;
const STEP = 0.22; // metros entre huellas

function treadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  // Surco de fondo
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.15, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.85, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  // Marcas de los grousers (chevrones del dibujo de la rueda)
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 7;
  for (let y = 4; y < 64; y += 21) {
    ctx.beginPath();
    ctx.moveTo(10, y + 6); ctx.lineTo(32, y); ctx.lineTo(54, y + 6);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTracks(scene) {
  const geo = new THREE.PlaneGeometry(0.42, STEP * 1.15);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a1a0c,
    map: treadTexture(),
    transparent: true,
    depthWrite: false,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);

  let next = 0, travelled = 0;
  const dummy = new THREE.Object3D();
  const offset = new THREE.Vector3();

  return {
    mesh,
    update(rover, dist) {
      travelled += Math.abs(dist);
      if (travelled < STEP) return;
      travelled = 0;
      const { halfWidth } = rover.userData.state;
      for (const side of [-1, 1]) {
        offset.set(side * halfWidth * 0.82, 0, 0).applyQuaternion(rover.quaternion);
        const x = rover.position.x + offset.x, z = rover.position.z + offset.z;
        dummy.position.set(x, heightAt(x, z) + 0.03, z);
        dummy.quaternion.copy(rover.quaternion);
        dummy.updateMatrix();
        mesh.setMatrixAt(next, dummy.matrix);
        next = (next + 1) % MAX;
        mesh.count = Math.max(mesh.count, next === 0 ? MAX : next);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
