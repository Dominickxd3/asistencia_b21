/** Une clases condicionales: cx('a', cond && 'b') → 'a b'. */
export function cx(...clases: (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(' ');
}

const dos = (n: number) => String(n).padStart(2, '0');

/**
 * Formatea una fecha en hora local con los tokens dd, MM, yyyy, HH, mm, ss.
 */
export function formatoFecha(valor: string | Date | null | undefined, formato: string): string {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const tokens: Record<string, string> = {
    dd: dos(d.getDate()),
    MM: dos(d.getMonth() + 1),
    yyyy: String(d.getFullYear()),
    HH: dos(d.getHours()),
    mm: dos(d.getMinutes()),
    ss: dos(d.getSeconds()),
  };
  return formato.replace(/yyyy|dd|MM|HH|mm|ss/g, (t) => tokens[t]);
}

/**
 * Fecha local YYYY-MM-DD. Nunca usar toISOString().slice(0, 10): es la fecha UTC,
 * que en Lima ya es "mañana" desde las 19:00.
 */
export function fechaLocalIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Date local (medianoche) a partir de YYYY-MM-DD */
export function desdeIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function sumarDias(iso: string, dias: number): string {
  const d = desdeIso(iso);
  d.setDate(d.getDate() + dias);
  return fechaLocalIso(d);
}

/** Primer y último día del mes de la fecha dada */
export function rangoMes(d: Date = new Date()): { desde: string; hasta: string } {
  return {
    desde: fechaLocalIso(new Date(d.getFullYear(), d.getMonth(), 1)),
    hasta: fechaLocalIso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** "sábado 27 de septiembre" */
export function fechaLarga(iso: string, conAnio = false): string {
  return desdeIso(iso).toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(conAnio ? { year: 'numeric' } : {}),
  });
}

/** "sáb 27/09" */
export function fechaCorta(iso: string): string {
  const d = desdeIso(iso);
  const dia = d.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '');
  return `${dia} ${dos(d.getDate())}/${dos(d.getMonth() + 1)}`;
}

/** Hora local actual HH:mm */
export function horaActual(): string {
  const d = new Date();
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Iniciales para avatares: "Torres Vega Ana" → "TV" */
export function iniciales(nombre: string): string {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** Plural simple: plural(3, 'falta') → '3 faltas' */
export function plural(n: number, singular: string, pluralForma = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/** Formato institucional: "Sábado, 19 De Setiembre De 2026" */
export function formatoFechaTitulo(iso: string): string {
  const d = desdeIso(iso);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${dias[d.getDay()]}, ${d.getDate()} De ${meses[d.getMonth()]} De ${d.getFullYear()}`;
}

/** Calcula la duración entre entrada y salida en formato "0 min", "45 min", "2h 15m" */
export function calcularDuracion(entradaIso?: string | null, salidaIso?: string | null): string {
  if (!entradaIso || !salidaIso) return '—';
  const entrada = new Date(entradaIso).getTime();
  const salida = new Date(salidaIso).getTime();
  if (Number.isNaN(entrada) || Number.isNaN(salida) || salida < entrada) return '0 min';
  const diffMin = Math.round((salida - entrada) / (1000 * 60));
  if (diffMin < 60) return `${diffMin} min`;
  const horas = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
}

