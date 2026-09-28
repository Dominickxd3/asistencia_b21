import { UnprocessableEntityException } from '@nestjs/common';

export const ETAPAS_CON_ASISTENCIA_OBLIGATORIA = [
  'POSTULANTE',
  'ASPIRANTE_COMPANIA',
] as const;

export function aplicaAsistenciaObligatoria(etapaCodigo: string): boolean {
  return (ETAPAS_CON_ASISTENCIA_OBLIGATORIA as readonly string[]).includes(etapaCodigo);
}

export function validarTipoJornada(
  etapaCodigo: string,
  _fecha: string,
  tipoJornada: string,
  horaInicio?: string | null,
): void {
  if (tipoJornada !== 'OBLIGATORIA') return;
  if (!aplicaAsistenciaObligatoria(etapaCodigo)) {
    throw new UnprocessableEntityException(
      'Este grupo no genera jornadas obligatorias. Toda participación debe registrarse como VOLUNTARIA.',
    );
  }
  if (!horaInicio) {
    throw new UnprocessableEntityException(
      'Una jornada obligatoria debe tener hora de entrada.',
    );
  }
}

export interface HorarioProgramado {
  /** 1 = lunes … 7 = domingo (convención de programacion_detalles.dia_semana) */
  dia: number;
  tipo: 'OBLIGATORIA' | 'VOLUNTARIA';
  inicio: string | null;
  fin: string | null;
}

/**
 * Programación semanal reglamentaria de un grupo nuevo:
 * contexto voluntario disponible todo el día y, solo para etapas con
 * asistencia obligatoria, hora fija de entrada y salida libre hasta medianoche.
 */
export function horarioReglamentario(
  etapaCodigo: string,
  obligatorios?: { diaSemana: number; horaInicio: string }[],
): HorarioProgramado[] {
  if (!aplicaAsistenciaObligatoria(etapaCodigo)) {
    // ESBAS: participación voluntaria disponible durante todo el día.
    return Array.from({ length: 7 }, (_, i) => ({
      dia: i + 1,
      tipo: 'VOLUNTARIA',
      inicio: null,
      fin: null,
    }));
  }

  // Postulantes y Aspirantes de compañía:
  // - Lunes a sábado: participación voluntaria desde el inicio del día (sin
  //   horario fijo, corte a medianoche), independiente de la obligatoria.
  // - Miércoles y Viernes: citación obligatoria a las 19:30, con salida libre.
  // - Domingo: citación obligatoria a las 07:30, con salida libre.
  const voluntarios: HorarioProgramado[] = [1, 2, 3, 4, 5, 6].map((dia) => ({
    dia,
    tipo: 'VOLUNTARIA',
    inicio: null,
    fin: null,
  }));
  const configurados = obligatorios ?? [
    { diaSemana: 3, horaInicio: '19:30' },
    { diaSemana: 5, horaInicio: '19:30' },
    { diaSemana: 7, horaInicio: '07:30' },
  ];
  return [
    ...voluntarios,
    ...configurados.map((h) => ({
      dia: h.diaSemana,
      tipo: 'OBLIGATORIA' as const,
      inicio: h.horaInicio.length === 5 ? `${h.horaInicio}:00` : h.horaInicio,
      fin: null,
    })),
  ];
}
