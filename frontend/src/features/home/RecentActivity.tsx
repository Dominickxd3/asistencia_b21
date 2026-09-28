import { Link } from 'react-router';
import { Avatar } from 'primereact/avatar';
import type { ActividadItem } from '../../core/models/api.models';
import { formatoFecha, iniciales, plural } from '../../shared/utils/format';
import './recent-activity.scss';

/** Enlace a la pizarra de una jornada concreta (fecha incluida si no es hoy) */
function rutaPizarra(jornadaId: number, fecha: string, esHoy: boolean): string {
  return esHoy ? `/asistencia?jornada=${jornadaId}` : `/asistencia?fecha=${fecha}&jornada=${jornadaId}`;
}

const ACCIONES: Record<string, { texto: string; color: string }> = {
  PRESENTE: { texto: 'Entrada registrada', color: 'var(--r21-green)' },
  FINALIZADO: { texto: 'Salida registrada', color: 'var(--r21-text-muted)' },
  FALTA_JUSTIFICADA: { texto: 'Falta justificada', color: 'var(--r21-amber)' },
  FALTA_INJUSTIFICADA: { texto: 'Falta injustificada', color: 'var(--r21-red)' },
  SALIDA_ANTICIPADA: { texto: 'Salida anticipada', color: 'var(--r21-amber)' },
};

interface Props {
  actividad: ActividadItem[];
  fecha: string;
  esHoy: boolean;
}

export function RecentActivity({ actividad, fecha, esHoy }: Props) {
  const visibles = actividad.slice(0, 5);

  return (
    <div className="r21-recent-activity">
      <div className="activity-header-row">
        <h2 className="activity-title">Actividad reciente</h2>
        {actividad.length > 0 && <span className="activity-count-badge">{plural(actividad.length, 'registro')}</span>}
      </div>

      <div className="activity-card-content">
        {actividad.length === 0 ? (
          <div className="empty-activity-box">
            <div className="standby-icon-badge">
              <i className="pi pi-history"></i>
            </div>
            <div className="standby-text-wrap">
              <span className="standby-title">{esHoy ? 'Bitácora en espera' : 'Sin registros'}</span>
              <span className="standby-desc">
                {esHoy
                  ? 'Las marcas de asistencia de hoy aparecerán aquí en tiempo real.'
                  : 'No hubo registros de asistencia en esta fecha.'}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="activity-items-list">
              {visibles.map((item) => {
                const accion = ACCIONES[item.accion] ?? { texto: item.accion, color: 'var(--r21-text-muted)' };
                return (
                  <Link
                    key={item.asistencia_id}
                    to={rutaPizarra(item.jornadaId, fecha, esHoy)}
                    className="activity-row"
                  >
                    <div className="activity-left-wrap">
                      <span className="time-col">{formatoFecha(item.fechaHora, 'HH:mm')}</span>
                      <span>
                        <Avatar label={iniciales(item.persona)} shape="circle" className="r21-item-avatar" />
                      </span>
                      <div className="details-col">
                        <span className="person-name">{item.persona}</span>
                        <span className="action-and-group">
                          {accion.texto}
                          {item.tipoRegistro === 'MANUAL' ? ' (manual)' : ''} · {item.grupo}
                        </span>
                      </div>
                    </div>
                    <span className="live-status-dot" style={{ backgroundColor: accion.color }}></span>
                  </Link>
                );
              })}
            </div>

            <div className="activity-footer-row">
              <Link to={esHoy ? '/asistencia' : `/asistencia?fecha=${fecha}`} className="btn-full-activity">
                <span>Ver pizarras del día</span>
                <i className="pi pi-arrow-right"></i>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
