import { existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Modelo de documento de reporte. Cada tipo de reporte construye un DocReporte y los
 * renderizadores (PDF y Excel) lo dibujan: ambos formatos muestran exactamente lo mismo.
 */

export type Tono = 'ok' | 'warn' | 'danger' | 'neutral';
/** porcentaje: fracción 0..1 · horas: minutos · fecha: YYYY-MM-DD */
export type Formato = 'texto' | 'entero' | 'porcentaje' | 'horas' | 'fecha';
export type Valor = string | number | null;

export interface Kpi {
  etiqueta: string;
  valor: string;
  detalle?: string;
  tono?: Tono;
}

export interface Columna {
  titulo: string;
  /** Peso relativo del ancho */
  ancho: number;
  alinear?: 'left' | 'center' | 'right';
  formato?: Formato;
  /** Colorea la celda según el umbral de cumplimiento */
  semaforo?: boolean;
}

export interface Tabla {
  columnas: Columna[];
  filas: Valor[][];
  total?: Valor[];
  /** Texto cuando no hay filas */
  vacio?: string;
}

export interface Seccion {
  titulo: string;
  descripcion?: string;
  /** Hoja del Excel (secciones con la misma hoja se apilan) */
  hoja: string;
  tabla?: Tabla;
  pares?: [string, string][];
  /** Empieza en una página nueva del PDF */
  nuevaPagina?: boolean;
}

export interface DocReporte {
  codigo: string;
  /** «INFORME GERENCIAL», «DETALLE INDIVIDUAL»… */
  tipo: string;
  titulo: string;
  periodo: string;
  rango: string;
  alcance: string;
  generadoPor: string;
  generadoEn: Date;
  orientacion: 'portrait' | 'landscape';
  kpis: Kpi[];
  hallazgos: string[];
  secciones: Seccion[];
  criterios: string[];
  firmas: { cargo: string; nombre?: string }[];
}

// ---------------- Umbrales de cumplimiento ----------------

export const UMBRAL_OPTIMO = 0.9;
export const UMBRAL_ACEPTABLE = 0.75;

export function tonoCumplimiento(valor: number | null): Tono {
  if (valor === null || Number.isNaN(valor)) return 'neutral';
  if (valor >= UMBRAL_OPTIMO) return 'ok';
  if (valor >= UMBRAL_ACEPTABLE) return 'warn';
  return 'danger';
}

export const COLORES: Record<Tono, { fondo: string; texto: string; borde: string }> = {
  ok: { fondo: '#E7F6ED', texto: '#14804A', borde: '#14804A' },
  warn: { fondo: '#FEF6E7', texto: '#B76E00', borde: '#B76E00' },
  danger: { fondo: '#FBECEE', texto: '#9F0B24', borde: '#C8102E' },
  neutral: { fondo: '#ECEFF3', texto: '#475467', borde: '#98A2B3' },
};

// ---------------- Formato de valores ----------------

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const dos = (n: number) => String(n).padStart(2, '0');
const partes = (iso: string) => iso.slice(0, 10).split('-').map(Number) as [number, number, number];

export function fechaCorta(iso: string): string {
  const [a, m, d] = partes(iso);
  return `${dos(d)}/${dos(m)}/${a}`;
}

export function diaSemana(iso: string): string {
  const [a, m, d] = partes(iso);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

export function horas(minutos: number | null): string {
  const m = Math.max(0, Math.round(Number(minutos ?? 0)));
  return `${Math.floor(m / 60)} h ${dos(m % 60)} min`;
}

export function porcentaje(v: number | null): string {
  return v === null || Number.isNaN(v) ? 'N/A' : `${Math.round(v * 100)} %`;
}

/** Texto de celda para el PDF */
export function textoCelda(valor: Valor, formato: Formato = 'texto'): string {
  if (valor === null || valor === undefined || valor === '') return formato === 'porcentaje' ? 'N/A' : '—';
  if (typeof valor === 'string') return formato === 'fecha' ? fechaCorta(valor) : valor;
  switch (formato) {
    case 'porcentaje':
      return porcentaje(valor);
    case 'horas':
      return horas(valor);
    case 'entero':
      return String(Math.round(valor));
    default:
      return String(valor);
  }
}

/**
 * Descripción formal del periodo: «Primera quincena de septiembre de 2026»,
 * «Segunda quincena…», «Mes de septiembre de 2026» o «Del 03/09/2026 al 20/09/2026».
 */
export function describirPeriodo(desde: string, hasta: string): string {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  if (a1 === a2 && m1 === m2) {
    const ultimo = new Date(Date.UTC(a1, m1, 0)).getUTCDate();
    const mes = `${MESES[m1 - 1]} de ${a1}`;
    if (d1 === 1 && d2 === 15) return `Primera quincena de ${mes}`;
    if (d1 === 16 && d2 === ultimo) return `Segunda quincena de ${mes}`;
    if (d1 === 1 && d2 === ultimo) return `Mes de ${mes}`;
  }
  return `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

export function rangoTexto(desde: string, hasta: string): string {
  return `${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

/** Fecha y hora de emisión en Lima, sin depender de la zona del servidor */
export function fechaEmision(d: Date): string {
  const f = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return f.format(d);
}

/** Nombre de archivo ASCII, sin espacios */
export function nombreArchivo(...partesNombre: string[]): string {
  return partesNombre
    .join('_')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Escudo institucional (assets/brand/logo-rimac21.png del backend) */
export function rutaLogo(): string | null {
  const candidatos = [
    resolve(process.cwd(), 'assets/brand/logo-rimac21.png'),
    join(__dirname, '../../../assets/brand/logo-rimac21.png'),
    join(__dirname, '../../../../assets/brand/logo-rimac21.png'),
  ];
  return candidatos.find((c) => existsSync(c)) ?? null;
}
