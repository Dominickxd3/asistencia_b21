import type { JornadaHoy, ProximaJornada, ResumenHoy } from '../../core/models/api.models';
import { useRealtimeConectado } from '../../core/services/realtime.service';
import { cx, fechaCorta, fechaLarga, plural } from '../../shared/utils/format';
import './daily-summary.scss';

interface Props {
  fecha: string;
  esHoy: boolean;
  resumen: ResumenHoy;
  jornadas: JornadaHoy[];
  proximaJornada: ProximaJornada | null;
}

/**
 * Bloque "Estado del día": tarjeta ejecutiva con acento rojo institucional,
 * 4 métricas reales y la cinta de estado del sistema.
 */
export function DailySummary({ fecha, esHoy, resumen, jornadas, proximaJornada }: Props) {
  const conectado = useRealtimeConectado();

  const asistieron = resumen.ingresaronHoy;
  const esperados = resumen.esperados;
  const porcentaje = esperados > 0 ? Math.min(100, Math.round((asistieron / esperados) * 100)) : 0;
  const faltas = resumen.justificados + resumen.faltasInjustificadas;
  const salidas = resumen.finalizados + resumen.salidasAnticipadas;

  const enCurso = jornadas.filter((j) => j.estado === 'ABIERTA');
  const estadoTexto = !esHoy
    ? `Resumen del ${fechaLarga(fecha)}`
    : enCurso.length > 0
      ? `${plural(enCurso.length, 'jornada', 'jornadas')} en curso`
      : jornadas.length > 0
        ? 'Sin jornada en curso en este momento'
        : 'Sin jornadas programadas hoy';

  return (
    <section className="r21-daily-summary" aria-label="Estado operativo del día">
      <div className="accent-red-bar"></div>

      {/* Barra superior contextual */}
      <div className="summary-top-header">
        <div className="status-indicator-wrap">
          <span className={cx('pulse-dot', esHoy && enCurso.length > 0 ? 'dot-green' : 'dot-gray')}></span>
          <span className="status-text">{estadoTexto}</span>
          <span className="header-sep">·</span>
          <span className="header-org-tag">B-21 Rímac</span>
        </div>

        {proximaJornada && (
          <div className="next-session-pill" title="Próxima jornada programada">
            <i className="pi pi-calendar-clock"></i>
            <span>
              Próxima instrucción: {proximaJornada.grupo} · {fechaCorta(proximaJornada.fecha)}
              {proximaJornada.horaInicio ? ` · ${proximaJornada.horaInicio} hrs` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Cuadrícula de 4 métricas */}
      <div className="metrics-grid">
        {/* 1. ASISTIERON (con gauge circular) */}
        <div className="metric-block">
          <div className="metric-head">
            <span className="metric-title text-green">ASISTIERON</span>
            <span className="metric-badge badge-green">{esperados > 0 ? `${porcentaje}%` : '—'}</span>
          </div>
          <div className="metric-body-row">
            <div className="metric-data">
              <span className="metric-number text-dark">{asistieron}</span>
              <span className="metric-label">
                {esperados > 0 ? `de ${esperados} integrantes esperados` : 'sin integrantes esperados'}
              </span>
            </div>
            <div className="metric-svg-ring" title={`${porcentaje}% de asistencia`}>
              <svg viewBox="0 0 36 36" className="mini-donut-svg" aria-hidden="true">
                <path
                  className="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle-fill-green"
                  strokeDasharray={`${porcentaje}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <i className="pi pi-users ring-icon text-green"></i>
            </div>
          </div>
        </div>

        {/* 2. FALTAS */}
        <div className="metric-block">
          <div className="metric-head">
            <span className="metric-title text-neutral">FALTAS</span>
            <span className="metric-badge badge-neutral">
              {plural(resumen.justificados, 'justificada', 'justificadas')}
            </span>
          </div>
          <div className="metric-body-row">
            <div className="metric-data">
              <span className={cx('metric-number', resumen.faltasInjustificadas > 0 ? 'text-red' : 'text-muted')}>
                {faltas}
              </span>
              <span className="metric-label">
                {resumen.faltasInjustificadas > 0
                  ? plural(resumen.faltasInjustificadas, 'falta injustificada', 'faltas injustificadas')
                  : 'sin faltas injustificadas'}
              </span>
            </div>
            <div className="metric-icon-box bg-neutral-light">
              <i className="pi pi-file-edit text-neutral"></i>
            </div>
          </div>
        </div>

        {/* 3. PENDIENTES */}
        <div className="metric-block">
          <div className="metric-head">
            <span className="metric-title text-amber">PENDIENTES</span>
            <span className="metric-badge badge-amber">{resumen.pendientes > 0 ? 'Por registrar' : 'Al día'}</span>
          </div>
          <div className="metric-body-row">
            <div className="metric-data">
              <span className="metric-number text-amber">{resumen.pendientes}</span>
              <span className="metric-label">integrantes sin registro de asistencia</span>
            </div>
            <div className="metric-icon-box bg-amber-light">
              <i className="pi pi-clock text-amber"></i>
            </div>
          </div>
        </div>

        {/* 4. EN CUARTEL / SALIDAS */}
        <div className="metric-block">
          <div className="metric-head">
            <span className="metric-title text-blue">EN CUARTEL</span>
            <span className="metric-badge badge-blue">Control de puerta</span>
          </div>
          <div className="metric-body-row">
            <div className="flow-data-col">
              <div className="flow-sub-row">
                <i className="pi pi-sign-in text-green"></i>
                <span className="flow-val">
                  <strong>{resumen.presentesAhora}</strong> {esHoy ? 'presentes ahora' : 'sin salida registrada'}
                </span>
              </div>
              <div className="flow-sub-row">
                <i className="pi pi-sign-out"></i>
                <span className="flow-val">
                  <strong>{salidas}</strong> salidas
                  {resumen.salidasAnticipadas > 0 ? ` (${resumen.salidasAnticipadas} anticipadas)` : ''}
                </span>
              </div>
            </div>
            <div className="metric-icon-box bg-blue-light">
              <i className="pi pi-sort-alt text-blue"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Cinta inferior de estado */}
      <div className="summary-bottom-ribbon">
        <div className="ribbon-item">
          <i className="pi pi-calendar"></i>
          <span>{jornadas.length === 0 ? 'Sin jornadas en la fecha' : plural(jornadas.length, 'jornada', 'jornadas')}</span>
        </div>
        <span className="ribbon-sep">·</span>
        <div className={cx('ribbon-item', conectado ? 'en-linea' : 'sin-conexion')}>
          <i className={conectado ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'}></i>
          <span>{conectado ? 'Actualización en tiempo real activa' : 'Sin conexión en tiempo real: los datos pueden no estar al día'}</span>
        </div>
        <span className="ribbon-sep">·</span>
        <div className="ribbon-item">
          <i className="pi pi-building"></i>
          <span>Cuartel Rímac 21 · Jr. Trujillo</span>
        </div>
      </div>
    </section>
  );
}
