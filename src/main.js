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
camera.position.set(6, heightAt(6, 34) + 2.6, 34);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-4, heightAt(-4, -10) + 3.5, -10);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 4;
controls.maxDistance = 200;

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

const clock = new THREE.Clock();
window.__frames = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  dust.userData.update(t, camera);
  controls.update();
  composer.render();
  window.__frames++;
});
