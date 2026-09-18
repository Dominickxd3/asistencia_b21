import { Injectable } from '@angular/core';

export interface GeoPayload {
  latitud: number;
  longitud: number;
  precisionMetros?: number;
}

/**
 * Captura la geolocalización del DISPOSITIVO que registra.
 * Solo se invoca al ejecutar acciones; no hay seguimiento permanente.
 * Si el usuario niega el permiso o no hay GPS, devuelve null.
 */
@Injectable({ providedIn: 'root' })
export class GeoService {
  capturar(timeoutMs = 5000): Promise<GeoPayload | null> {
    if (!('geolocation' in navigator)) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
            precisionMetros: pos.coords.accuracy,
          }),
        () => resolve(null),
        { timeout: timeoutMs, maximumAge: 10_000 },
      );
    });
  }
}
