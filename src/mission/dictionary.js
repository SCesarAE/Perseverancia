// Diccionario de telemetría de Percy (equivalente a los "domain objects" de Open MCT).
// Cada dato: identificador, nombre, unidad, proveedor y una frase simple de qué significa.

const utc = { key: 'utc', name: 'Tiempo', format: 'utc', hints: { domain: 1 } };
const sol = { key: 'sol', name: 'Sol', unit: 'sol', hints: { domain: 2 } };

const fmt = (n, d = 0) => n.toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d });

export const DICTIONARY = [
  {
    identifier: { namespace: 'percy', key: 'dist_total' },
    name: 'Distancia recorrida',
    provider: 'NASA/JPL · historial de manejos (M20_waypoints.json)',
    source: 'nasa-waypoints',
    field: 'dist_total_m',
    telemetry: {
      values: [utc, sol, { key: 'value', name: 'Distancia', unit: 'km', format: 'float', scale: 0.001, digits: 2, hints: { range: 1 } }],
    },
    meaning: (last) => `Percy ha rodado ${fmt(last.value, 1)} km por Marte desde que aterrizó en el cráter Jezero: más o menos ${fmt(last.value / 0.4)} vueltas a una pista de atletismo.`,
  },
  {
    identifier: { namespace: 'percy', key: 'elevation' },
    name: 'Altura del terreno',
    provider: 'NASA/JPL · historial de manejos (M20_waypoints.json)',
    source: 'nasa-waypoints',
    field: 'elev_geoid',
    telemetry: {
      values: [utc, sol, { key: 'value', name: 'Elevación', unit: 'm', format: 'float', digits: 0, hints: { range: 1 } }],
    },
    meaning: (last, history) => {
      const climb = last.value - history[0].value;
      return `Marte no tiene mar; esto se mide contra su "nivel cero". Desde el aterrizaje Percy ha ${climb >= 0 ? 'subido' : 'bajado'} ${fmt(Math.abs(climb))} m, trepando desde el fondo del cráter hacia su borde.`;
    },
  },
  {
    identifier: { namespace: 'percy', key: 'tilt' },
    name: 'Inclinación',
    provider: 'NASA/JPL · historial de manejos (M20_waypoints.json)',
    source: 'nasa-waypoints',
    field: 'tilt',
    telemetry: {
      values: [utc, sol, { key: 'value', name: 'Inclinación', unit: '°', format: 'float', digits: 1, hints: { range: 1 } }],
    },
    meaning: (last) => `Cuánto quedó ladeado Percy al terminar su último manejo. Está diseñado para aguantar hasta 30°; ahora está a ${fmt(last.value, 1)}°.`,
  },
  {
    identifier: { namespace: 'percy', key: 'light_time' },
    name: 'Tiempo luz Tierra–Marte',
    provider: 'Cálculo en vivo · órbitas de la Tierra y Marte (elementos keplerianos JPL)',
    source: 'light-time',
    telemetry: {
      values: [utc, sol, { key: 'value', name: 'Tiempo luz', unit: 'min', format: 'duration', digits: 2, hints: { range: 1 } }],
    },
    meaning: (last) => `Lo que tarda una orden desde la Tierra en llegar a Percy: ${fmt(last.value, 1)} minutos. Por eso nadie lo maneja en directo; planea solo y le mandamos el plan.`,
  },
];
