// Vista del control de misión: solo conoce la TelemetryAPI y los metadatos de cada objeto.
import { TelemetryAPI } from './telemetry.js';
import { DICTIONARY } from './dictionary.js';
import { nasaWaypointsProvider, lightTimeProvider, solAt } from './providers.js';

const CSS = /* css */ `
#mission {
  --mc-bg: rgba(24, 12, 8, 0.62);
  --mc-line: rgba(255, 190, 130, 0.22);
  --mc-text: #f6e2cc;
  --mc-dim: rgba(246, 226, 204, 0.62);
  --mc-accent: #ffb366;
  --mc-ok: #8fe3a0;
  position: fixed; top: 16px; right: 16px; bottom: 16px;
  width: 370px; max-width: calc(100vw - 32px);
  display: flex; flex-direction: column; gap: 8px;
  font: 12px/1.35 "Segoe UI", system-ui, sans-serif; color: var(--mc-text);
  pointer-events: none; user-select: none;
  transition: opacity .35s ease, transform .35s ease;
}
#mission[data-hidden="true"] { opacity: 0; transform: translateX(24px); visibility: hidden; }
#mission .mc-head, #mission .mc-card {
  background: var(--mc-bg); border: 1px solid var(--mc-line); border-radius: 10px;
  backdrop-filter: blur(8px) saturate(1.2); -webkit-backdrop-filter: blur(8px) saturate(1.2);
}
#mission .mc-head { padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; }
#mission .mc-title { font-weight: 700; letter-spacing: .14em; font-size: 11px; color: var(--mc-accent); }
#mission .mc-sub { color: var(--mc-dim); font-size: 11px; margin-top: 2px; font-variant-numeric: tabular-nums; }
#mission .mc-link { display: flex; align-items: center; gap: 6px; font-size: 10px; letter-spacing: .1em; color: var(--mc-ok); }
#mission .mc-link::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; animation: mc-blink 1.6s infinite; }
#mission .mc-link[data-state="loading"] { color: var(--mc-accent); }
#mission .mc-link[data-state="error"] { color: #ff7a6b; }
@keyframes mc-blink { 50% { opacity: .3; } }
#mission .mc-cards { flex: 1 1 auto; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
#mission .mc-card { padding: 8px 12px 9px; flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; }
#mission .mc-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
#mission .mc-name { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--mc-dim); }
#mission .mc-value { font: 600 22px/1.1 "Cascadia Mono", Consolas, monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }
#mission .mc-unit { font-size: 12px; color: var(--mc-dim); margin-left: 3px; }
#mission canvas { width: 100%; height: 42px; flex: 0 0 auto; margin: 4px 0 3px; display: block; }
#mission .mc-meaning { font-size: 11px; line-height: 1.3; }
#mission .mc-provider { font-size: 9.5px; color: var(--mc-dim); margin-top: 3px; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#mission .mc-provider b { font-weight: 600; color: var(--mc-accent); opacity: .9; }
#mission-hint {
  position: fixed; left: 16px; bottom: 16px; padding: 6px 10px; border-radius: 8px;
  background: rgba(24, 12, 8, 0.5); color: rgba(246, 226, 204, .8);
  font: 11px "Segoe UI", system-ui, sans-serif; pointer-events: none;
}
#mission-hint kbd { font: 600 10px Consolas, monospace; padding: 1px 5px; border: 1px solid rgba(255,190,130,.4); border-radius: 4px; }
`;

function formatValue(v, meta) {
  if (meta.format === 'duration') {
    const m = Math.floor(v), s = (v - m) * 60;
    return `${m}<span class="mc-unit">min</span> ${s.toFixed(1).padStart(4, '0')}<span class="mc-unit">s</span>`;
  }
  const n = v.toLocaleString('es', { minimumFractionDigits: meta.digits, maximumFractionDigits: meta.digits });
  return `${n}<span class="mc-unit">${meta.unit}</span>`;
}

// Gráfica de toda la misión (eje x = sol, eje y = valor), con el último punto resaltado.
function drawChart(canvas, data) {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h || data.length < 2) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  let min = Infinity, max = -Infinity;
  for (const d of data) { if (d.value < min) min = d.value; if (d.value > max) max = d.value; }
  const pad = (max - min) * 0.1 || 1;
  min -= pad; max += pad;
  const s0 = data[0].sol, s1 = data[data.length - 1].sol;
  const X = (s) => ((s - s0) / (s1 - s0 || 1)) * (w - 4) + 2;
  const Y = (v) => h - 12 - ((v - min) / (max - min)) * (h - 16);

  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(246,226,204,.45)';
  ctx.fillText(`sol ${Math.round(s0)}`, 2, h - 1);
  const end = `sol ${Math.round(s1)}`;
  ctx.fillText(end, w - ctx.measureText(end).width - 2, h - 1);

  ctx.beginPath();
  data.forEach((d, i) => (i ? ctx.lineTo(X(d.sol), Y(d.value)) : ctx.moveTo(X(d.sol), Y(d.value))));
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,179,102,.35)');
  grad.addColorStop(1, 'rgba(255,179,102,0)');
  ctx.save();
  ctx.lineTo(X(s1), h - 12); ctx.lineTo(X(s0), h - 12); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.restore();
  ctx.beginPath();
  data.forEach((d, i) => (i ? ctx.lineTo(X(d.sol), Y(d.value)) : ctx.moveTo(X(d.sol), Y(d.value))));
  ctx.strokeStyle = '#ffb366'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke();
  const last = data[data.length - 1];
  ctx.beginPath(); ctx.arc(X(last.sol), Y(last.value), 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff1df'; ctx.shadowColor = '#ffb366'; ctx.shadowBlur = 8; ctx.fill();
}

export function createMissionControl() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('aside');
  root.id = 'mission';
  root.setAttribute('aria-label', 'Control de misión');
  root.innerHTML = `
    <div class="mc-head">
      <div><div class="mc-title">CONTROL DE MISIÓN · PERCY</div><div class="mc-sub" data-sol>Sol —</div></div>
      <div class="mc-link" data-link data-state="loading">ENLAZANDO</div>
    </div>
    <div class="mc-cards"></div>`;
  document.body.appendChild(root);
  const hint = document.createElement('div');
  hint.id = 'mission-hint';
  hint.innerHTML = '<kbd>W A S D</kbd> manejar · <kbd>T</kbd> control de misión';
  document.body.appendChild(hint);

  const api = new TelemetryAPI();
  api.addProvider(nasaWaypointsProvider());
  api.addProvider(lightTimeProvider());

  // Estado expuesto para npm run check
  const status = (window.__missionControl = { hidden: false, data: {} });

  const cards = DICTIONARY.map((obj) => {
    const meta = api.rangeValue(obj);
    const el = document.createElement('section');
    el.className = 'mc-card';
    el.dataset.key = obj.identifier.key;
    el.innerHTML = `
      <div class="mc-row"><span class="mc-name">${obj.name}</span><span class="mc-value" data-value>…</span></div>
      <canvas></canvas>
      <div class="mc-meaning" data-meaning>Recibiendo telemetría…</div>
      <div class="mc-provider"><b>Proveedor</b> ${obj.provider}</div>`;
    root.querySelector('.mc-cards').appendChild(el);
    const card = { obj, meta, el, history: [] };
    card.render = () => {
      const last = card.history[card.history.length - 1];
      if (!last) return;
      el.querySelector('[data-value]').innerHTML = formatValue(last.value, meta);
      el.querySelector('[data-meaning]').textContent = obj.meaning(last, card.history);
      drawChart(el.querySelector('canvas'), card.history);
      status.data[obj.identifier.key] = { name: obj.name, value: last.value, unit: meta.unit, sol: last.sol, points: card.history.length, provider: obj.provider };
    };
    return card;
  });

  const link = root.querySelector('[data-link]');
  Promise.allSettled(
    cards.map(async (card) => {
      card.history = await api.request(card.obj);
      card.render();
      // Datos en vivo: se agregan a la serie (sin crecer sin límite: reemplaza el último punto en vivo)
      api.subscribe(card.obj, (datum) => {
        const h = card.history;
        if (h.length > 1 && h[h.length - 1].live) h.pop();
        h.push({ ...datum, live: true });
        card.render();
      });
    }),
  ).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected');
    failed.forEach((r) => console.error('Control de misión:', r.reason));
    link.dataset.state = failed.length ? 'error' : 'ok';
    link.textContent = failed.length ? `SIN ENLACE (${failed.length})` : 'ENLACE OK';
    status.ready = !failed.length;
  });

  const solEl = root.querySelector('[data-sol]');
  const tickSol = () => {
    const s = solAt(Date.now());
    solEl.textContent = `Sol ${Math.floor(s)} de misión · ${new Date().toISOString().slice(11, 19)} UTC`;
  };
  tickSol();
  setInterval(tickSol, 1000);

  const setHidden = (hidden) => {
    root.dataset.hidden = hidden;
    status.hidden = hidden;
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat) setHidden(!status.hidden);
  });
  addEventListener('resize', () => cards.forEach((c) => c.render()));
  setHidden(false);
}
