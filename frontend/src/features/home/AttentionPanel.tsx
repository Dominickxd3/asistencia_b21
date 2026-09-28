import { Link } from 'react-router';
import type { AtencionItem, TipoAtencion } from '../../core/models/api.models';
import { cx, plural } from '../../shared/utils/format';
import { rutaPizarra } from './SessionPanel';
import './attention-panel.scss';

const TIPOS: Record<TipoAtencion, { etiqueta: string; accion: string; clase: string }> = {
  JORNADA_SIN_ABRIR: { etiqueta: 'Sin abrir', accion: 'Abrir la jornada en la pizarra', clase: 'item-danger' },
  PENDIENTES: { etiqueta: 'Pendiente', accion: 'Completar el registro de asistencia', clase: 'item-warning' },
  JORNADA_SIN_CERRAR: { etiqueta: 'Sin cerrar', accion: 'Cerrar la jornada', clase: 'item-warning' },
  JUSTIFICACIONES: { etiqueta: 'Por revisar', accion: 'Revisar justificaciones', clase: '' },
};

interface Props {
  items: AtencionItem[];
  fecha: string;
  esHoy: boolean;
}

export function AttentionPanel({ items, fecha, esHoy }: Props) {
  return (
    <div className="r21-attention-panel">
      <div className="panel-header-row">
        <h2 className="panel-title">Requieren atención</h2>
        {items.length > 0 && <span className="badge-alert-count">{plural(items.length, 'alerta')}</span>}
      </div>

      <div className="panel-card-content">
        {items.length === 0 ? (
          <>
            <div className="all-clear-state">
              <div className="clear-icon-badge">
                <i className="pi pi-check"></i>
              </div>
              <div className="clear-text-wrap">
                <span className="clear-title">Pizarra operativa al día</span>
                <span className="clear-sub">
                  Sin jornadas atrasadas, pendientes por registrar ni justificaciones por revisar.
                </span>
              </div>
            </div>
            <div className="clear-footer-row">
              <i className="pi pi-shield"></i>
              <span>Control de asistencia conforme a reglamento B-21</span>
            </div>
          </>
        ) : (
          <div className="incidencias-list">
            {items.map((item, i) => {
              const tipo = TIPOS[item.tipo] ?? TIPOS.JUSTIFICACIONES;
              return (
                <Link
                  key={i}
                  to={rutaPizarra(item.jornadaId, fecha, esHoy)}
                  className={cx('incidencia-item', tipo.clase)}
                >
                  <span className="item-dot"></span>
                  <div className="item-body">
                    <div className="item-main-row">
                      <strong className="item-title" title={item.descripcion}>
                        {item.descripcion}
                      </strong>
                      <span className="item-type-tag">{tipo.etiqueta}</span>
                    </div>
                    <span className="item-sub">
                      {tipo.accion} <i className="pi pi-arrow-right"></i>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
