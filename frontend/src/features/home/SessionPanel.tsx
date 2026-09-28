import { Link } from 'react-router';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type { AtencionItem, JornadaHoy, ProximaJornada } from '../../core/models/api.models';
import { EmptyState } from '../../shared/components/EmptyState';
import { cx, fechaCorta, plural } from '../../shared/utils/format';
import './session-panel.scss';

interface Props {
  jornada: JornadaHoy | null;
  fecha: string;
  esHoy: boolean;
  incidencias?: AtencionItem[];
  proximaJornada: ProximaJornada | null;
}

const ESTADO: Record<string, { texto: string; clase: string }> = {
  ABIERTA: { texto: 'En curso', clase: 'badge-active' },
  PROGRAMADA: { texto: 'Programada', clase: 'badge-pending' },
  CERRADA: { texto: 'Cerrada', clase: 'badge-closed' },
  CANCELADA: { texto: 'Cancelada', clase: 'badge-closed' },
};

const ETIQUETA_CASO: Record<string, string> = {
  PENDIENTES: 'Pendiente',
  JORNADA_SIN_ABRIR: 'Sin abrir',
  JORNADA_SIN_CERRAR: 'Sin cerrar',
  JUSTIFICACIONES: 'Por revisar',
};

/** Enlace a la pizarra de una jornada concreta (fecha incluida si no es hoy) */
export function rutaPizarra(jornadaId: number, fecha: string, esHoy: boolean): string {
  return esHoy ? `/asistencia?jornada=${jornadaId}` : `/asistencia?fecha=${fecha}&jornada=${jornadaId}`;
}

export function SessionPanel({ jornada, fecha, esHoy, incidencias = [], proximaJornada }: Props) {
  if (!jornada) {
    return (
      <article className="r21-session-panel">
        <EmptyState
          mensaje={esHoy ? 'No hay jornadas programadas para hoy' : 'No hay jornadas programadas para esta fecha'}
          descripcion={
            proximaJornada
              ? `Próxima: ${proximaJornada.grupo} · ${fechaCorta(proximaJornada.fecha)}${
                  proximaJornada.horaInicio ? ` · ${proximaJornada.horaInicio} hrs` : ''
                }`
              : 'No hay jornadas próximas programadas.'
          }
          icono="pi pi-calendar-times"
        />
      </article>
    );
  }

  const estado = ESTADO[jornada.estado] ?? ESTADO.PROGRAMADA;
  const registrados = jornada.integrantes - jornada.pendientes;
  const asistieron = jornada.ingresaron;
  const porcentaje = jornada.integrantes > 0 ? Math.round((registrados / jornada.integrantes) * 100) : 0;

  let lineaPendientes: string;
  if (jornada.estado === 'PROGRAMADA') lineaPendientes = 'La jornada aún no se abre';
  else if (jornada.pendientes > 0) lineaPendientes = `${plural(jornada.pendientes, 'pendiente')} por registrar`;
  else if (jornada.integrantes > 0) lineaPendientes = 'Nómina completa';
  else lineaPendientes = 'El grupo no tiene integrantes activos';

  return (
    <article className="r21-session-panel">
      {/* 1. Cabecera de la jornada */}
      <div className="panel-header-row">
        <div className="header-left">
          <div className="title-and-tags">
            <h3 className="panel-group-title">{jornada.grupo}</h3>
            <span>
              <Tag
                value={jornada.tipoJornada}
                severity={jornada.tipoJornada === 'OBLIGATORIA' ? 'danger' : 'secondary'}
                className="tag-compact-caps"
              />
            </span>
            {jornada.origen === 'EXTRAORDINARIA' && <span className="r21-badge warn">Extraordinaria</span>}
          </div>
          <div className="schedule-line">
            <i className="pi pi-clock"></i>
            <span className="schedule-time">{jornada.horario}</span>
            <span className="schedule-dot">·</span>
            <span className="schedule-meta">{jornada.etapa}</span>
          </div>
        </div>

        <div className={cx('status-badge-wrap', estado.clase)}>
          <span className="status-indicator-dot"></span>
          <span className="status-badge-text">{estado.texto}</span>
        </div>
      </div>

      {/* 2. Avance del registro */}
      <div className="progress-box">
        <div className="progress-labels-row">
          <div className="count-attendance">
            <span className="count-main">
              <strong>{registrados}</strong> / {jornada.integrantes} con registro
            </span>
            <span className="pct-badge">({porcentaje}%)</span>
          </div>
          <span className={cx('count-pending', jornada.pendientes > 0 && jornada.estado === 'ABIERTA' && 'has-pending')}>
            {lineaPendientes}
          </span>
        </div>
        <ProgressBar value={porcentaje} showValue={false} className="r21-progress-thick" />
        <div className="progress-breakdown">
          <span>
            <i className="pi pi-sign-in"></i> {asistieron} asistieron
          </span>
          <span>
            <i className="pi pi-home"></i> {jornada.presentes} en cuartel
          </span>
          <span>
            <i className="pi pi-file-edit"></i> {jornada.justificados + jornada.faltasInjustificadas} faltas
          </span>
        </div>
      </div>

      {/* 3. Casos que requieren atención en esta jornada */}
      <div className="relevant-cases-section">
        <div className="cases-title-row">
          <span className="cases-heading">Casos que requieren atención</span>
          {incidencias.length > 0 && <span className="cases-count-tag">{plural(incidencias.length, 'caso')}</span>}
        </div>

        <div className="cases-list-wrap">
          {incidencias.length === 0 ? (
            <div className="case-item-clean">
              <span className="case-dot-icon dot-green"></span>
              <div className="case-text-group">
                <strong className="case-bold-title">Todo en orden</strong>
                <span className="case-inline-desc">Sin pendientes ni alertas para esta jornada</span>
              </div>
            </div>
          ) : (
            incidencias.map((caso, i) => (
              <div key={i} className="case-item-warning">
                <div className="case-text-group">
                  <span className="case-dot-icon dot-amber"></span>
                  <strong className="case-bold-title">{caso.descripcion}</strong>
                </div>
                <span className="case-alert-chip">{ETIQUETA_CASO[caso.tipo] ?? 'Revisar'}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Pie: encargado y acceso a la pizarra */}
      <div className="panel-footer-row">
        <div className="instructor-profile">
          <div className="instructor-avatar-mini">
            <i className="pi pi-user"></i>
          </div>
          <div className="instructor-info">
            <span className="inst-label">Encargado de grupo</span>
            <span className={cx('inst-name', !jornada.encargado && 'sin-asignar')}>
              {jornada.encargado ?? 'Sin encargado asignado'}
            </span>
          </div>
        </div>

        <Link to={rutaPizarra(jornada.jornadaId, fecha, esHoy)} className="btn-action-asistencia">
          <span>{jornada.estado === 'PROGRAMADA' ? 'Ir a la pizarra para abrirla' : 'Ver registro de asistencia'}</span>
          <i className="pi pi-arrow-right"></i>
        </Link>
      </div>
    </article>
  );
}
