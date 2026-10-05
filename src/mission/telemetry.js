// Mini API de telemetría con el patrón de Open MCT:
//  - Cada objeto de telemetría declara metadatos: nombre, y valores con key, nombre, unidad y hints
//    (domain = eje de tiempo, range = el dato medido).
//  - Los proveedores registran qué objetos atienden (supportsRequest / supportsSubscribe) y
//    entregan historial con request() y datos en vivo con subscribe().
//  - Las vistas solo hablan con esta API; no saben de dónde viene cada dato.

export class TelemetryAPI {
  #providers = [];

  addProvider(provider) {
    this.#providers.push(provider);
  }

  providerFor(object, capability) {
    return this.#providers.find((p) => p[capability]?.(object));
  }

  async request(object, options = {}) {
    const p = this.providerFor(object, 'supportsRequest');
    return p ? p.request(object, options) : [];
  }

  subscribe(object, callback) {
    const p = this.providerFor(object, 'supportsSubscribe');
    return p ? p.subscribe(object, callback) : () => {};
  }

  // Equivalente a openmct.telemetry.getMetadata(object).valuesForHints(['range'])[0]
  rangeValue(object) {
    return object.telemetry.values.find((v) => v.hints?.range);
  }

  domainValue(object) {
    return object.telemetry.values.find((v) => v.hints?.domain);
  }
}
