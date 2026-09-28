import { Link } from 'react-router';
import type { JornadaHoy, ResumenHoy } from '../../core/models/api.models';
import { useRealtimeConectado } from '../../core/services/realtime.service';
import { cx, plural } from '../../shared/utils/format';
import './gate-control.scss';

interface Props {
  resumen: ResumenHoy;
  jornadas: JornadaHoy[];
  esHoy: boolean;
  fecha: string;
}

/**
 * Panel "EN CUARTEL — Control de puerta": tarjeta principal del dashboard
 * con indicadores de presencia, salidas y pendientes.
 */
export function GateControlPanel({ resumen, jornadas, esHoy, fecha }: Props) {
  const conectado = useRealtimeConectado();

  const salidas = resumen.finalizados + resumen.salidasAnticipadas;
  const enCurso = jornadas.filter((j) => j.estado === 'ABIERTA');

  return (
    <section className="r21-gate-control" aria-label="Control de puerta">
      <div className="gate-accent"></div>

      {/* Cabecera */}
      <div className="gate-header">
        <div className="gate-title-group">
          <h2 className="gate-title">En cuartel</h2>
          <span className="gate-subtitle">Control de puerta</span>
        </div>
        <div className={cx('gate-status-chip', conectado ? 'online' : 'offline')}>
          <span className="gate-status-dot"></span>
          <span>{conectado ? 'En línea' : 'Sin conexión'}</span>
        </div>
      </div>

      {/* 3 métricas */}
      <div className="gate-metrics">
        <div className="gate-metric-card primary">
          <span className="metric-value">{resumen.presentesAhora}</span>
          <span className="metric-label">{esHoy ? 'presentes ahora' : 'sin salida registrada'}</span>
        </div>

        <div className="gate-metric-card">
          <span className="metric-value">{salidas}</span>
          <span className="metric-label">
            {salidas === 1 ? 'salida' : 'salidas'}
            {resumen.salidasAnticipadas > 0 ? ` (${resumen.salidasAnticipadas} antic.)` : ''}
          </span>
        </div>

        <div className="gate-metric-card">
          <span className="metric-value">{resumen.pendientes}</span>
          <span className="metric-label">pendientes</span>
        </div>
      </div>

      {/* Pie */}
      <div className="gate-footer">
        <span className="gate-footer-info">
          {enCurso.length > 0
            ? `${plural(enCurso.length, 'jornada', 'jornadas')} en curso`
            : jornadas.length > 0
              ? plural(jornadas.length, 'jornada programada', 'jornadas programadas')
              : 'Sin jornadas hoy'}
        </span>
        {jornadas.length > 0 && (
          <Link to={esHoy ? '/asistencia' : `/asistencia?fecha=${fecha}`} className="gate-link">
            Ver pizarras <i className="pi pi-arrow-right"></i>
          </Link>
        )}
      </div>
    </section>
  );
}
