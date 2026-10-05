import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

const perlin = new ImprovedNoise();

export const noise2 = (x, y, z = 0.5) => perlin.noise(x, y, z);

export function fbm(x, y, octaves = 4, z = 0.5) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin.noise(x * freq, y * freq, z + i * 7.1);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// Textura de ruido en escala de grises (canvas) para detalle de superficie.
export function noiseTexture(size = 512, scale = 8, octaves = 5) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Ruido periódico: muestreo en un toro para que la textura repita sin costuras.
      const u = (x / size) * Math.PI * 2, v = (y / size) * Math.PI * 2;
      const r = scale / (Math.PI * 2);
      const n = fbm(Math.cos(u) * r + 50, Math.sin(u) * r, octaves, Math.cos(v) * r + Math.sin(v) * r * 0.7);
      const g = Math.max(0, Math.min(255, 140 + n * 220));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
