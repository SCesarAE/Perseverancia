import * as THREE from 'three';

// Polvo suspendido que deriva con el viento alrededor de la cámara.
export function createDust() {
  const COUNT = 2500, BOX = 80;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * BOX;
    positions[i * 3 + 1] = Math.random() * 18;
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    seeds[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 }, origin: { value: new THREE.Vector3() }, box: { value: BOX } },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float time, box; uniform vec3 origin;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += time * (1.2 + seed * 1.5);
        p.z += time * (0.8 + seed);
        p.y += sin(time * 0.5 + seed * 40.0) * 0.8;
        // Envolver en una caja centrada en la cámara
        p.xz = mod(p.xz - origin.xz + box * 0.5, box) - box * 0.5 + origin.xz;
        p.y += origin.y - 6.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.6 + seed * 1.4) * (40.0 / -mv.z);
        vAlpha = 0.18 * smoothstep(60.0, 8.0, -mv.z) * smoothstep(2.0, 6.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(0.95, 0.68, 0.45, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.update = (t, camera) => {
    mat.uniforms.time.value = t;
    mat.uniforms.origin.value.copy(camera.position);
  };
  return points;
}
