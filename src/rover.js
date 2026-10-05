import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { heightAt } from './terrain.js';

// Perseverance real: ~3 m de largo, 2.7 m de ancho, 2.2 m de alto (hasta el mástil).
const REAL_HEIGHT = 2.2;
export const SPAWN = new THREE.Vector3(0, 0, 14);

const MAX_SPEED = 3.5;      // m/s (el real va a ~0.04 m/s; acelerado para que sea jugable)
const TURN_RATE = 0.9;      // rad/s
const ACCEL = 2.5;
const CAMERA_PATTERN = /cam|lens|watson/i;
const NOT_CAMERA = /cover|wiring|bracket/i;

export function createRover(scene, onReady) {
  const rover = new THREE.Group();
  rover.position.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z);
  scene.add(rover);

  const state = { yaw: Math.PI, speed: 0, halfWidth: 1.1, halfLength: 1.4, ready: false };
  const keys = new Set();
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const draco = new DRACOLoader().setDecoderPath('/draco/');
  new GLTFLoader().setDRACOLoader(draco).load('/models/perseverance.glb', (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = REAL_HEIGHT / size.y;
    model.scale.setScalar(s);
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    box.getSize(size);
    state.halfWidth = size.x / 2;
    state.halfLength = size.z / 2;

    const cameras = [];
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
      if (CAMERA_PATTERN.test(o.name) && !NOT_CAMERA.test(o.name)) cameras.push(o.name);
    });
    rover.add(model);
    rover.userData.cameraParts = cameras;
    console.log(`Perseverance cargado: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m (escala ${s.toFixed(3)})`);
    console.log('Piezas que son cámaras:', cameras.join(', '));
    state.ready = true;
    window.__roverReady = true;
    onReady?.();
  });

  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const m = new THREE.Matrix4();

  rover.userData.state = state;
  rover.userData.update = (dt) => {
    const throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);

    const target = throttle * MAX_SPEED * (throttle < 0 ? 0.5 : 1);
    const k = 1 - Math.exp(-dt * (throttle ? ACCEL : ACCEL * 1.5));
    state.speed += (target - state.speed) * k;
    if (Math.abs(state.speed) < 0.01 && !throttle) state.speed = 0;

    // Puede girar sobre su eje (como el real), invierte el giro en reversa.
    state.yaw += steer * TURN_RATE * dt * (state.speed < -0.05 ? -1 : 1);

    const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
    const dist = state.speed * dt;
    rover.position.x += sin * dist;
    rover.position.z += cos * dist;

    // Inclinación siguiendo el terreno: muestreo bajo las ruedas.
    const { x, z } = rover.position;
    const L = state.halfLength * 0.8, W = state.halfWidth * 0.8;
    const hF = heightAt(x + sin * L, z + cos * L);
    const hB = heightAt(x - sin * L, z - cos * L);
    const hR = heightAt(x - cos * W, z + sin * W);
    const hL = heightAt(x + cos * W, z - sin * W);
    fwd.set(sin * 2 * L, hF - hB, cos * 2 * L).normalize();
    right.set(-cos * 2 * W, hR - hL, sin * 2 * W).normalize();
    up.crossVectors(fwd, right).normalize();
    if (up.y < 0) up.negate();
    right.crossVectors(up, fwd).normalize(); // eje X local = Y × Z
    m.makeBasis(right, up, fwd);
    rover.quaternion.setFromRotationMatrix(m);
    rover.position.y = (hF + hB + hL + hR) / 4;

    return dist;
  };
  return rover;
}
