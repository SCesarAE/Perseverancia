import * as THREE from 'three';
import { fbm, noiseTexture } from './noise.js';

// Fobos (grande, irregular) y Deimos (pequeño, lejano).
function makeMoon({ radius, stretch, seed, dir, dist, lightDir, brightness }) {
  const geo = new THREE.IcosahedronGeometry(radius, 5);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    // Forma de "papa" + cráteres suaves
    const n = fbm(v.x * 1.6 + seed, v.y * 1.6, 4, v.z * 1.6) * 0.35;
    const crater = Math.pow(Math.abs(fbm(v.x * 4 + seed, v.y * 4, 2, v.z * 4)), 0.6) * -0.08;
    v.multiplyScalar(radius * (1 + n + crater));
    v.multiply(stretch);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const tex = new THREE.CanvasTexture(noiseTexture(256, 6 + seed, 5));
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      map: { value: tex },
      lightDir: { value: lightDir.clone().normalize() },
      brightness: { value: brightness },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec2 vUv;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 lightDir; uniform float brightness;
      varying vec3 vN; varying vec2 vUv;
      void main() {
        float tex = texture2D(map, vUv * 2.0).r;
        float lambert = smoothstep(-0.05, 0.6, dot(normalize(vN), lightDir));
        vec3 albedo = vec3(0.78, 0.62, 0.50) * (0.55 + tex * 0.7);
        // El lado nocturno se funde con el cielo polvoriento
        vec3 skyHaze = vec3(0.58, 0.32, 0.18);
        vec3 col = mix(skyHaze * 1.1, albedo * brightness, lambert);
        // Atenuación atmosférica: el polvo tiñe y suaviza las lunas
        col = mix(col, skyHaze, 0.3);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(dir.clone().normalize().multiplyScalar(dist));
  mesh.lookAt(0, 0, 0);
  mesh.rotateZ(seed);
  mesh.renderOrder = 0;
  return mesh;
}

export function createMoons() {
  const group = new THREE.Group();
  const lightDir = new THREE.Vector3(-0.8, 0.25, 0.6);
  group.add(
    makeMoon({
      radius: 34, stretch: new THREE.Vector3(1.25, 0.95, 1.0), seed: 1.3,
      dir: new THREE.Vector3(0.40, 0.27, -1), dist: 2200, lightDir, brightness: 1.0,
    }),
    makeMoon({
      radius: 16, stretch: new THREE.Vector3(1.1, 0.9, 1.0), seed: 4.7,
      dir: new THREE.Vector3(0.14, 0.33, -1), dist: 2400, lightDir, brightness: 1.0,
    }),
  );
  return group;
}
