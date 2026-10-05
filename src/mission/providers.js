// Proveedores de telemetría (patrón Open MCT: supportsRequest/request, supportsSubscribe/subscribe).

const WAYPOINTS_URL = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json';

// Aterrizaje de Perseverance: 18 feb 2021 20:55 UTC. Un sol dura 88 775.244 s.
export const LANDING_UTC = Date.UTC(2021, 1, 18, 20, 55, 0);
export const SOL_MS = 88775244;
export const solAt = (utc) => (utc - LANDING_UTC) / SOL_MS;

// --- Historial de manejos de la NASA: un solo fetch alimenta distancia, altura e inclinación ---
export function nasaWaypointsProvider() {
  let features;
  const load = () =>
    (features ??= fetch(WAYPOINTS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`M20_waypoints.json respondió ${r.status}`);
        return r.json();
      })
      .then((json) => json.features.map((f) => f.properties).sort((a, b) => a.sol - b.sol || a.site - b.site || a.drive - b.drive)));

  return {
    supportsRequest: (o) => o.source === 'nasa-waypoints',
    async request(o) {
      const range = o.telemetry.values.find((v) => v.hints?.range);
      const scale = range.scale ?? 1;
      return (await load())
        // Solo posiciones de fin de manejo (final = "y"); las intermedias traen la distancia en 0.
        .filter((p) => p.final === 'y' && Number.isFinite(p[o.field]) && p[o.field] > -9000)
        .map((p) => ({ utc: LANDING_UTC + p.sol * SOL_MS, sol: p.sol, value: p[o.field] * scale }));
    },
  };
}

// --- Tiempo luz Tierra–Marte calculado en vivo ---
// Elementos orbitales aproximados de JPL (Standish, válidos 1800–2050), referidos a J2000.
const ELEMENTS = {
  earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0] },
  mars: { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343] },
};
const AU_KM = 149597870.7;
const C_KMS = 299792.458;
const RAD = Math.PI / 180;

function helio(planet, T) {
  const el = ELEMENTS[planet];
  const v = (k) => el[k][0] + el[k][1] * T;
  const a = v('a'), e = v('e'), I = v('I') * RAD, L = v('L'), w = v('w'), O = v('O');
  const M = ((((L - w) % 360) + 540) % 360 - 180) * RAD;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const om = (w - O) * RAD, Or = O * RAD;
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(Or), sO = Math.sin(Or), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    so * sI * xp + co * sI * yp,
  ];
}

export function lightTimeMinutes(utc) {
  const T = (utc / 86400000 + 2440587.5 - 2451545) / 36525;
  const e = helio('earth', T), m = helio('mars', T);
  const d = Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]);
  return (d * AU_KM) / C_KMS / 60;
}

export function lightTimeProvider() {
  const datum = (utc) => ({ utc, sol: solAt(utc), value: lightTimeMinutes(utc) });
  return {
    supportsRequest: (o) => o.source === 'light-time',
    supportsSubscribe: (o) => o.source === 'light-time',
    // Historial: un punto por sol desde el aterrizaje hasta ahora.
    async request() {
      const now = Date.now();
      const out = [];
      for (let t = LANDING_UTC; t < now; t += SOL_MS) out.push(datum(t));
      out.push(datum(now));
      return out;
    },
    subscribe(o, callback) {
      const id = setInterval(() => callback(datum(Date.now())), 1000);
      return () => clearInterval(id);
    },
  };
}
