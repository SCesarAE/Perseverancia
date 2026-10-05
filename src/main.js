import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createTerrain, heightAt } from './terrain.js';
import { createSky, SUN_DIR, HORIZON_COLOR } from './sky.js';
import { createMoons } from './moons.js';
import { createRocks } from './rocks.js';
import { createDust } from './dust.js';
import { createRover, SPAWN } from './rover.js';
import { createTracks } from './tracks.js';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(HORIZON_COLOR.clone(), 0.0026);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(SPAWN.x + 2.5, heightAt(SPAWN.x, SPAWN.z) + 3.2, SPAWN.z + 8.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z) + 1.3, SPAWN.z);
controls.enableDamping = true;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4;
controls.maxDistance = 60;

// --- Lights: sol de tarde bajo, cálido, sombras suaves ---
const sun = new THREE.DirectionalLight(0xffb27a, 3.2);
sun.position.copy(SUN_DIR).multiplyScalar(200);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 600;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
sun.shadow.radius = 6;
scene.add(sun, sun.target);

scene.add(new THREE.HemisphereLight(0xf0bb88, 0x6a3420, 1.1));

// --- World ---
scene.add(createSky());
scene.add(createMoons());
scene.add(createTerrain());
scene.add(createRocks());
const dust = createDust();
scene.add(dust);
const rover = createRover(scene);
const tracks = createTracks(scene);

// --- Cámara de seguimiento: arrastra con la órbita del mouse y se coloca detrás al manejar ---
const lastRoverPos = rover.position.clone();
const roverDelta = new THREE.Vector3();
const behind = new THREE.Vector3();
function followRover(dt) {
  roverDelta.subVectors(rover.position, lastRoverPos);
  lastRoverPos.copy(rover.position);
  camera.position.add(roverDelta);
  controls.target.set(rover.position.x, rover.position.y + 1.3, rover.position.z);

  const { speed, yaw } = rover.userData.state;
  if (Math.abs(speed) > 0.1) {
    const dist = camera.position.distanceTo(controls.target);
    const height = camera.position.y - controls.target.y;
    const flat = Math.sqrt(Math.max(dist * dist - height * height, 1));
    behind.set(-Math.sin(yaw) * flat, height, -Math.cos(yaw) * flat).add(controls.target);
    camera.position.lerp(behind, 1 - Math.exp(-dt * 1.2));
  }
  const ground = heightAt(camera.position.x, camera.position.z) + 0.8;
  if (camera.position.y < ground) camera.position.y = ground;

  // La sombra del sol sigue al rover
  sun.target.position.copy(rover.position);
  sun.position.copy(rover.position).addScaledVector(SUN_DIR, 200);
}

// --- Post-proceso ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.9, 0.9));
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

function step(dt) {
  if (rover.userData.state.ready) tracks.update(rover, rover.userData.update(dt));
  followRover(dt);
}
// Para depurar desde la consola y para npm run check (avanza la simulación sin renderizar).
window.__sim = { camera, rover, controls, tracks, step }; // para depurar desde la consola

const clock = new THREE.Clock();
window.__frames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  step(dt);
  dust.userData.update(t, camera);
  controls.update();
  composer.render();
  window.__frames++;
});
