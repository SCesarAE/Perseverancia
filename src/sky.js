import * as THREE from 'three';

// Sol bajo hacia el oeste, delante de la cámara (contraluz cinematográfico).
export const SUN_DIR = new THREE.Vector3(-0.55, 0.13, -1).normalize();
export const HORIZON_COLOR = new THREE.Color(0xd7a06c);

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      horizon: { value: HORIZON_COLOR },
      zenith: { value: new THREE.Color(0x8a5536) },
      ground: { value: new THREE.Color(0x9a6040) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, horizon, zenith, ground;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        // Gradiente caramelo: horizonte claro y polvoriento, cénit más oscuro.
        vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, ground, smoothstep(0.0, -0.08, h));
        // Banda de polvo cerca del horizonte
        col += vec3(0.10, 0.06, 0.03) * exp(-abs(h) * 14.0);

        float cosA = dot(d, sunDir);
        // Resplandor amplio cálido por dispersión en el polvo
        col += vec3(1.0, 0.62, 0.32) * pow(max(cosA, 0.0), 6.0) * 0.55;
        // Halo frío alrededor del sol (dispersión característica de los atardeceres marcianos)
        col += vec3(0.55, 0.72, 1.0) * pow(max(cosA, 0.0), 120.0) * 0.6;
        // Disco solar (más pequeño visto desde Marte)
        float disc = smoothstep(0.99985, 0.99993, cosA);
        col += vec3(6.0, 5.2, 4.2) * disc;
        col += vec3(1.4, 1.1, 0.8) * pow(max(cosA, 0.0), 900.0);

        // Leve grano para evitar banding
        col += (hash(d * 500.0) - 0.5) * 0.012;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // HORIZON_COLOR etc. están en sRGB; convertimos a lineal para el shader.
  for (const k of ['horizon', 'zenith', 'ground']) {
    mat.uniforms[k].value = mat.uniforms[k].value.clone().convertSRGBToLinear();
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 64, 32), mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}
