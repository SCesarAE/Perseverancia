// npm run check: levanta Vite, abre la página en Edge headless (Playwright, sin descargar
// navegadores), guarda una captura en screenshots/check.png y lista los errores de consola.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const PORT = 5199;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const warnings = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  else if (m.type() === 'warning') warnings.push(m.text());
  else if (m.type() === 'log') console.log('[página] ' + m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

let exitCode = 0;
try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => (window.__frames ?? 0) >= 5 && window.__roverReady, null, { timeout: 90000 });
  // Manejar con teclas reales (W, luego W+A). El render por software va a ~1 fps, así que
  // la simulación se avanza con __sim.step mientras las teclas siguen presionadas.
  const drive = (seconds) => page.evaluate((s) => { for (let i = 0; i < s * 30; i++) window.__sim.step(1 / 30); }, seconds);
  await page.keyboard.down('KeyW');
  await drive(5);
  await page.keyboard.down('KeyA');
  await drive(2.5);
  await page.keyboard.up('KeyA');
  await drive(2);
  await page.keyboard.up('KeyW');
  await drive(2);
  await page.waitForTimeout(1500);
  // --- Control de misión: los 4 datos deben cargar con números reales ---
  const EXPECTED = ['dist_total', 'elevation', 'tilt', 'light_time'];
  await page.waitForFunction(() => window.__missionControl?.ready !== undefined, null, { timeout: 60000 }).catch(() => {});
  const mc = await page.evaluate(() => window.__missionControl ?? null);
  console.log('\nControl de misión:');
  for (const key of EXPECTED) {
    const d = mc?.data?.[key];
    if (d && Number.isFinite(d.value)) {
      console.log(`  OK  ${d.name}: ${d.value.toFixed(3)} ${d.unit} (sol ${Math.round(d.sol)}, ${d.points} puntos) ← ${d.provider}`);
    } else {
      console.log(`  FALLA  ${key}: sin dato`);
      errors.push(`control de misión: el dato "${key}" no cargó`);
    }
  }

  // --- Tecla T oculta y vuelve a mostrar el panel ---
  const visible = () => page.evaluate(() => getComputedStyle(document.getElementById('mission')).visibility !== 'hidden');
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(500);
  const hiddenOk = !(await visible());
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(500);
  const shownOk = await visible();
  console.log(`  ${hiddenOk ? 'OK' : 'FALLA'}  T oculta el panel`);
  console.log(`  ${shownOk ? 'OK' : 'FALLA'}  T lo vuelve a mostrar\n`);
  if (!hiddenOk || !shownOk) errors.push('control de misión: la tecla T no alterna el panel');

  const stats = await page.evaluate(() => {
    const { rover, tracks } = window.__sim;
    return { roverPos: rover.position.toArray().map((n) => +n.toFixed(2)), huellas: tracks.mesh.count, fps: window.__frames };
  });
  console.log('Estado:', JSON.stringify(stats));
  mkdirSync('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/check.png' });
  console.log('Captura: screenshots/check.png');
} catch (e) {
  errors.push(`check: ${e.message}`);
}

console.log(`\nWarnings (${warnings.length}):`);
warnings.forEach((w) => console.log('  - ' + w));
console.log(`Errores (${errors.length}):`);
errors.forEach((e) => console.log('  - ' + e));
if (errors.length) exitCode = 1;

await browser.close();
await server.close();
process.exit(exitCode);
