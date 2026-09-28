/**
 * Geometría de geocercas poligonales (funciones puras, sin dependencias).
 *
 * A escala de un cuartel (decenas de metros) se proyectan las coordenadas a un
 * plano local equirectangular centrado en el polígono: el error frente a la
 * distancia geodésica es de milímetros, suficiente para comparar con el GPS.
 */

export interface Coordenada {
  latitud: number;
  longitud: number;
}

interface Punto2D {
  x: number;
  y: number;
}

export type EstadoGeografico =
  | 'DENTRO_ZONA'
  | 'FUERA_ZONA'
  | 'PRECISION_INSUFICIENTE'
  | 'NO_DISPONIBLE'
  | 'SIN_GEOCERCA';

const RADIO_TIERRA_M = 6_371_008.8;
const rad = (g: number) => (g * Math.PI) / 180;

/** Centroide simple de los vértices (referencia para proyectar y centrar el mapa) */
export function centroide(vertices: Coordenada[]): Coordenada {
  const n = vertices.length;
  return {
    latitud: vertices.reduce((s, v) => s + v.latitud, 0) / n,
    longitud: vertices.reduce((s, v) => s + v.longitud, 0) / n,
  };
}

function proyector(origen: Coordenada) {
  const cosLat = Math.cos(rad(origen.latitud));
  return (c: Coordenada): Punto2D => ({
    x: rad(c.longitud - origen.longitud) * cosLat * RADIO_TIERRA_M,
    y: rad(c.latitud - origen.latitud) * RADIO_TIERRA_M,
  });
}

/** Ray casting: ¿el punto está dentro del polígono? */
function dentroPlano(p: Punto2D, poligono: Punto2D[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    const cruza = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function distanciaASegmento(p: Punto2D, a: Punto2D, b: Punto2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export interface PosicionRespectoPoligono {
  dentro: boolean;
  /** Distancia al perímetro en metros (0 si está dentro) */
  distanciaMetros: number;
}

export function posicionRespectoPoligono(punto: Coordenada, vertices: Coordenada[]): PosicionRespectoPoligono {
  const proyectar = proyector(centroide(vertices));
  const p = proyectar(punto);
  const poligono = vertices.map(proyectar);
  if (dentroPlano(p, poligono)) return { dentro: true, distanciaMetros: 0 };
  let minima = Infinity;
  for (let i = 0; i < poligono.length; i++) {
    minima = Math.min(minima, distanciaASegmento(p, poligono[i], poligono[(i + 1) % poligono.length]));
  }
  return { dentro: false, distanciaMetros: minima };
}

/** Área en m² (fórmula del polígono de Gauss) */
export function areaMetros2(vertices: Coordenada[]): number {
  const proyectar = proyector(centroide(vertices));
  const p = vertices.map(proyectar);
  let doble = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    doble += a.x * b.y - b.x * a.y;
  }
  return Math.abs(doble) / 2;
}

function orientacion(a: Punto2D, b: Punto2D, c: Punto2D): number {
  const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  return Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : 2;
}

function enSegmento(a: Punto2D, b: Punto2D, c: Punto2D): boolean {
  return b.x <= Math.max(a.x, c.x) && b.x >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) && b.y >= Math.min(a.y, c.y);
}

function segmentosSeCruzan(p1: Punto2D, q1: Punto2D, p2: Punto2D, q2: Punto2D): boolean {
  const o1 = orientacion(p1, q1, p2);
  const o2 = orientacion(p1, q1, q2);
  const o3 = orientacion(p2, q2, p1);
  const o4 = orientacion(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && enSegmento(p1, p2, q1)) ||
    (o2 === 0 && enSegmento(p1, q2, q1)) ||
    (o3 === 0 && enSegmento(p2, p1, q2)) ||
    (o4 === 0 && enSegmento(p2, q1, q2))
  );
}

/** Un perímetro válido no puede cruzarse consigo mismo */
export function seAutointersecta(vertices: Coordenada[]): boolean {
  const proyectar = proyector(centroide(vertices));
  const p = vertices.map(proyectar);
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Lados consecutivos comparten vértice: no cuentan como cruce
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentosSeCruzan(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true;
    }
  }
  return false;
}

export interface ParametrosClasificacion {
  dentro: boolean;
  distanciaMetros: number;
  /** Precisión reportada por la Geolocation API (radio de confianza, m) */
  precisionMetros: number | null;
  toleranciaMetros: number;
  precisionMaximaMetros: number;
}

/**
 * Clasificación tolerante al error normal del GPS:
 * - precisión peor que el máximo configurado → PRECISION_INSUFICIENTE (no se puede afirmar nada);
 * - dentro del polígono o a menos de la tolerancia del borde → DENTRO_ZONA;
 * - fuera, pero el círculo de error alcanza el borde → PRECISION_INSUFICIENTE;
 * - fuera con margen claro → FUERA_ZONA.
 */
export function clasificar(p: ParametrosClasificacion): EstadoGeografico {
  const precision = p.precisionMetros ?? p.precisionMaximaMetros;
  if (precision > p.precisionMaximaMetros) return 'PRECISION_INSUFICIENTE';
  if (p.dentro || p.distanciaMetros <= p.toleranciaMetros) return 'DENTRO_ZONA';
  if (p.distanciaMetros <= precision + p.toleranciaMetros) return 'PRECISION_INSUFICIENTE';
  return 'FUERA_ZONA';
}
