export interface GeoPayload {
  latitud: number;
  longitud: number;
  /** Radio de confianza reportado por la Geolocation API (metros) */
  precisionMetros?: number;
  /** Hora de captura del dispositivo (ISO 8601) */
  capturadoEn?: string;
}

export interface CapturaUbicacion {
  geo: GeoPayload | null;
  /** Motivo legible cuando no se pudo obtener la ubicación */
  error: string | null;
  codigo?: 'PERMISO' | 'NO_DISPONIBLE' | 'TIEMPO_AGOTADO' | 'NO_COMPATIBLE';
}

async function estadoPermiso(): Promise<PermissionState | null> {
  if (!navigator.permissions?.query) return null;
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return null;
  }
}

function leerPosicion(opciones: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opciones);
  });
}

function convertirPosicion(pos: GeolocationPosition): CapturaUbicacion {
  return {
    geo: {
      latitud: pos.coords.latitude,
      longitud: pos.coords.longitude,
      precisionMetros: pos.coords.accuracy,
      capturadoEn: new Date(pos.timestamp).toISOString(),
    },
    error: null,
  };
}

type Plataforma = 'ANDROID' | 'IOS' | 'WINDOWS' | 'MACOS' | 'OTRA';

function plataformaActual(): Plataforma {
  const agente = navigator.userAgent.toLowerCase();
  if (agente.includes('android')) return 'ANDROID';
  if (/iphone|ipad|ipod/.test(agente)) return 'IOS';
  if (agente.includes('windows')) return 'WINDOWS';
  if (agente.includes('macintosh') || agente.includes('mac os')) return 'MACOS';
  return 'OTRA';
}

function mensajeSinCoordenadas(tiempoAgotado: boolean): string {
  const inicio = tiempoAgotado
    ? 'El dispositivo no obtuvo coordenadas a tiempo.'
    : 'El dispositivo no pudo calcular su ubicación.';

  switch (plataformaActual()) {
    case 'ANDROID':
      return `${inicio} Active Ubicación y la precisión de ubicación del teléfono, y vuelva a probar.`;
    case 'IOS':
      return `${inicio} Active Localización y Ubicación precisa para este navegador, y vuelva a probar.`;
    case 'WINDOWS':
      return `${inicio} Active la ubicación de Windows y el Wi-Fi, aunque use conexión por cable, y vuelva a probar.`;
    case 'MACOS':
      return `${inicio} Active Localización para este navegador y mantenga el Wi-Fi encendido, y vuelva a probar.`;
    default:
      return `${inicio} Active la ubicación precisa del sistema y vuelva a probar.`;
  }
}

/**
 * Captura la geolocalización del DISPOSITIVO que registra, solo en el momento
 * de ejecutar una acción de asistencia: no hay seguimiento permanente.
 * Primero solicita alta precisión. En equipos sin GPS reintenta con la
 * ubicación de red disponible para el sistema. La precisión obtenida siempre
 * se envía al backend, que decide si cumple la regla de la sede.
 */
export const geoService = {
  async capturar(timeoutMs = 10_000): Promise<CapturaUbicacion> {
    if (!('geolocation' in navigator)) {
      return {
        geo: null,
        error: 'El navegador no soporta geolocalización',
        codigo: 'NO_COMPATIBLE',
      };
    }

    const permisoAntes = await estadoPermiso();
    if (permisoAntes === 'denied') {
      return {
        geo: null,
        error:
          'Esta pestaña todavía tiene bloqueada la ubicación. Si acaba de habilitarla en el navegador, pulse “Recargar y aplicar permiso” y vuelva a probar.',
        codigo: 'PERMISO',
      };
    }

    let ultimoError: GeolocationPositionError;
    try {
      const posicion = await leerPosicion({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: Math.min(timeoutMs, 7_000),
      });
      return convertirPosicion(posicion);
    } catch (err) {
      ultimoError = err as GeolocationPositionError;
      if (ultimoError.code === ultimoError.PERMISSION_DENIED) {
        const permisoDespues = await estadoPermiso();
        return {
          geo: null,
          error:
            permisoDespues === 'granted'
              ? 'El navegador ya muestra el permiso habilitado, pero esta pestaña conserva el estado anterior. Pulse “Recargar y aplicar permiso” y vuelva a probar.'
              : 'El navegador bloqueó la ubicación para esta pestaña. Habilítela en la configuración del sitio, pulse “Recargar y aplicar permiso” y vuelva a probar.',
          codigo: 'PERMISO',
        };
      }
    }

    // Una PC de escritorio puede no tener GPS. La segunda lectura permite que
    // Chrome use Wi-Fi o el proveedor de ubicación de Windows.
    try {
      const posicion = await leerPosicion({
        enableHighAccuracy: false,
        maximumAge: 30_000,
        timeout: timeoutMs,
      });
      return convertirPosicion(posicion);
    } catch (err) {
      ultimoError = err as GeolocationPositionError;
    }

    if (ultimoError.code === ultimoError.PERMISSION_DENIED) {
      return {
        geo: null,
        error:
          'El navegador bloqueó la ubicación para esta pestaña. Habilítela en la configuración del sitio, recargue y vuelva a probar.',
        codigo: 'PERMISO',
      };
    }
    if (ultimoError.code === ultimoError.TIMEOUT) {
      return {
        geo: null,
        error: mensajeSinCoordenadas(true),
        codigo: 'TIEMPO_AGOTADO',
      };
    }
    return {
      geo: null,
      error: mensajeSinCoordenadas(false),
      codigo: 'NO_DISPONIBLE',
    };
  },
};
