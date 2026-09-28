import { cx } from '../utils/format';

export type EstadoGeografico =
  | 'DENTRO_ZONA'
  | 'FUERA_ZONA'
  | 'PRECISION_INSUFICIENTE'
  | 'NO_DISPONIBLE'
  | 'SIN_GEOCERCA';

export const ESTADO_GEO: Record<EstadoGeografico, { texto: string; corto: string; icono: string; clase: string }> = {
  DENTRO_ZONA: { texto: 'Dentro de la sede', corto: 'En sede', icono: 'pi pi-map-marker', clase: 'ok' },
  FUERA_ZONA: { texto: 'Fuera de la sede', corto: 'Fuera', icono: 'pi pi-exclamation-triangle', clase: 'peligro' },
  PRECISION_INSUFICIENTE: {
    texto: 'Precisión insuficiente',
    corto: 'Precisión baja',
    icono: 'pi pi-question-circle',
    clase: 'warn',
  },
  NO_DISPONIBLE: { texto: 'Ubicación no disponible', corto: 'Sin ubicación', icono: 'pi pi-ban', clase: 'neutro' },
  SIN_GEOCERCA: { texto: 'Sin geocerca configurada', corto: 'Sin geocerca', icono: 'pi pi-map', clase: 'neutro' },
};

interface Props {
  estado: string;
  precisionMetros?: number | null;
  distanciaMetros?: number | null;
  /** Etiqueta corta para filas densas */
  compacto?: boolean;
  prefijo?: string;
}

/** Resultado de la validación geográfica de un movimiento de asistencia */
export function GeoBadge({ estado, precisionMetros, distanciaMetros, compacto = false, prefijo }: Props) {
  const cfg = ESTADO_GEO[estado as EstadoGeografico] ?? ESTADO_GEO.NO_DISPONIBLE;
  const detalle = [
    precisionMetros != null ? `precisión ±${Math.round(precisionMetros)} m` : null,
    distanciaMetros != null && distanciaMetros > 0 ? `a ${Math.round(distanciaMetros)} m del perímetro` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const titulo = `${prefijo ? `${prefijo}: ` : ''}${cfg.texto}${detalle ? ` (${detalle})` : ''}`;

  return (
    <span className={cx('r21-badge', cfg.clase)} title={titulo}>
      <i className={cfg.icono} style={{ fontSize: 10 }}></i>
      {prefijo && <span>{prefijo}</span>}
      {compacto ? cfg.corto : cfg.texto}
    </span>
  );
}
