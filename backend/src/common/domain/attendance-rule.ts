export type TipoJornada = 'OBLIGATORIA' | 'VOLUNTARIA';

export interface ReglaAsistencia {
  diaSemana: number;
  tipoJornada: TipoJornada;
  horaIngreso: string | null;
}

/** Convencion de programacion: 1=lunes ... 7=domingo. */
export function fechaIso(fecha: string | Date): string {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10);
  return String(fecha).slice(0, 10);
}

export function diaSemanaIso(fecha: string | Date): number {
  const iso = fechaIso(fecha);
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha invalida: ${fecha}`);
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/**
 * Regla reglamentaria central. La programacion indica su vigencia y horarios
 * complementarios; esta funcion impide que una configuracion invalida vuelva
 * obligatoria a ESBAS o a un dia que no corresponde.
 */
export function resolverReglaAsistencia(etapaCodigo: string, fecha: string | Date): ReglaAsistencia {
  const diaSemana = diaSemanaIso(fecha);
  const etapa = etapaCodigo.trim().toUpperCase();
  const admiteObligatoria = etapa === 'POSTULANTE' || etapa === 'ASPIRANTE_COMPANIA';
  const esDiaObligatorio = diaSemana === 3 || diaSemana === 5 || diaSemana === 7;

  if (admiteObligatoria && esDiaObligatorio) {
    return {
      diaSemana,
      tipoJornada: 'OBLIGATORIA',
      horaIngreso: diaSemana === 7 ? '07:00' : '19:30',
    };
  }

  return { diaSemana, tipoJornada: 'VOLUNTARIA', horaIngreso: null };
}
