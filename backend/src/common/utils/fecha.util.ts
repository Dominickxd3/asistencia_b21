/**
 * Fechas de negocio. Nunca usar `toISOString().slice(0, 10)`: devuelve la fecha UTC,
 * que en Lima (UTC-5) ya es "mañana" desde las 19:00, justo cuando hay jornadas.
 */

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local del servidor en formato YYYY-MM-DD */
export function fechaLocalIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Fecha y hora local YYYY-MM-DDTHH:mm:ss (para columnas datetime2 sin desfase) */
export function fechaHoraLocalIso(d: Date): string {
  return `${fechaLocalIso(d)}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

/** Normaliza una columna `date`, que según el driver llega como string o Date (medianoche local) */
export function fechaColumna(valor: unknown): string {
  return valor instanceof Date ? fechaLocalIso(valor) : String(valor).slice(0, 10);
}

/** Fecha oficial de negocio: la de SQL Server (GETDATE) */
export async function fechaServidor(db: { query: (sql: string) => Promise<any[]> }): Promise<string> {
  const [row] = await db.query(`SELECT CONVERT(char(10), GETDATE(), 126) AS hoy`);
  return row.hoy;
}

/** Hora HH:mm válida (00:00–23:59) */
export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Fecha YYYY-MM-DD */
export const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
