import type { JornadaHoy } from '../../core/models/api.models';
import { cx } from '../../shared/utils/format';
import './group-selector.scss';

const COLOR_ESTADO: Record<string, string> = {
  ABIERTA: '#14804A',
  PROGRAMADA: '#B76E00',
  CERRADA: '#667085',
  CANCELADA: '#C8102E',
};

const TEXTO_ESTADO: Record<string, string> = {
  ABIERTA: 'En curso',
  PROGRAMADA: 'Programada',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada',
};

interface Props {
  jornadas: JornadaHoy[];
  seleccionada: number;
  onSeleccionar: (jornadaId: number) => void;
}

/** Pestañas con las jornadas reales del día (una por grupo/jornada). */
export function GroupSelector({ jornadas, seleccionada, onSeleccionar }: Props) {
  return (
    <div className="r21-group-selector-bar" role="tablist" aria-label="Jornadas del día">
      {jornadas.map((j) => (
        <button
          key={j.jornadaId}
          type="button"
          role="tab"
          aria-selected={seleccionada === j.jornadaId}
          className={cx('group-tab-btn', seleccionada === j.jornadaId && 'active')}
          onClick={() => onSeleccionar(j.jornadaId)}
        >
          <div className="tab-top-row">
            <span className="tab-name">{j.grupo}</span>
            <span
              className="status-dot"
              style={{ backgroundColor: COLOR_ESTADO[j.estado] ?? '#667085' }}
              title={TEXTO_ESTADO[j.estado] ?? j.estado}
            ></span>
          </div>
          <span className="tab-sub">
            {j.horaInicio ?? 'Sin horario'} · {TEXTO_ESTADO[j.estado] ?? j.estado}
          </span>
        </button>
      ))}
    </div>
  );
}
