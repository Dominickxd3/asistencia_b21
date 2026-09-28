import { Link } from 'react-router';
import type { GrupoMetricas } from '../../core/models/api.models';
import { EmptyState } from '../../shared/components/EmptyState';
import { desdeIso, fechaCorta, plural } from '../../shared/utils/format';
import './group-metrics-deck.scss';

interface Props {
  grupos: GrupoMetricas[];
  fecha: string;
}

export function GroupMetricsDeck({ grupos, fecha }: Props) {
  const mes = desdeIso(fecha).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  return (
    <section className="r21-group-metrics-deck" aria-label="Indicadores por grupo de formación">
      <div className="deck-header-row">
        <div className="deck-title-wrap">
          <div className="deck-title-lead">
            <h2 className="deck-title">Indicadores por grupo</h2>
          </div>
          <span className="deck-subtitle">
            Jornadas obligatorias cerradas de {mes}
          </span>
        </div>
        <div className="deck-live-tag">
          <span className="live-dot"></span>
          <span>{plural(grupos.length, 'grupo activo', 'grupos activos')}</span>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="r21-card r21-card-body">
          <EmptyState mensaje="No hay grupos de formación activos" icono="pi pi-th-large" />
        </div>
      ) : (
        <div className="deck-cards-grid">
          {grupos.map((grupo) => {
            const pct = grupo.asistenciaPct;
            const esEsbas = grupo.etapaCodigo === 'ASPIRANTE_ESBAS';
            return (
              <article
                key={grupo.grupoId}
                className="group-metric-card"
              >
                <div className="card-top-bar">
                  <div className="card-icon-title">
                    <div className="group-icon-badge">
                      <i className="pi pi-users"></i>
                    </div>
                    <div className="group-identity">
                      <h3 className="group-title" title={grupo.nombre}>
                        {grupo.nombre}
                      </h3>
                      <span className="group-subtitle">{plural(grupo.integrantes, 'integrante activo', 'integrantes activos')}</span>
                    </div>
                  </div>
                  <span className="etapa-pill" title={grupo.etapa}>
                    {grupo.etapa}
                  </span>
                </div>

                <div className="primary-metric-box">
                  <div className="metric-info-col">
                    <span className="metric-lead-label">
                      {esEsbas ? 'Participación voluntaria del mes' : 'Cumplimiento obligatorio del mes'}
                    </span>
                    <div className="metric-number-row">
                      <span className="metric-main-value">
                        {esEsbas ? grupo.participacionesVoluntariasMes : pct === null ? '—' : `${pct}%`}
                      </span>
                      <span className="metric-meta-target">
                        {esEsbas
                          ? 'Cumplimiento obligatorio: No aplica'
                          : grupo.jornadasMes > 0
                          ? `en ${plural(grupo.jornadasMes, 'jornada', 'jornadas')}`
                          : 'sin jornadas cerradas'}
                      </span>
                    </div>
                  </div>

                  {!esEsbas && <div className="svg-gauge-wrap" title={pct === null ? 'Sin datos' : `Asistencia: ${pct}%`}>
                    <svg viewBox="0 0 42 42" className="donut-svg" aria-hidden="true">
                      <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#E5E7EB" strokeWidth="4" />
                      {pct !== null && pct > 0 && (
                        <circle
                          cx="21"
                          cy="21"
                          r="15.91549430918954"
                          fill="transparent"
                          stroke="var(--r21-text-primary)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={`${pct} ${100 - pct}`}
                          strokeDashoffset="25"
                        />
                      )}
                    </svg>
                    <span className="gauge-center-text">{pct === null ? '—' : `${pct}%`}</span>
                  </div>}
                </div>

                {!esEsbas && <div className="linear-progress-track">
                  <div
                    className="linear-progress-fill"
                    style={{ width: `${pct ?? 0}%` }}
                  ></div>
                </div>}

                <div className="secondary-metrics-row">
                  {esEsbas ? (
                    <>
                      <div className="sec-metric-item"><span className="sec-label">Horas volunt.</span><span className="sec-value"><strong>{grupo.horasVoluntariasMes}</strong> h</span></div>
                      <div className="sec-divider"></div>
                      <div className="sec-metric-item"><span className="sec-label">Total registrado</span><span className="sec-value"><strong>{grupo.horasTotalesMes}</strong> h</span></div>
                      <div className="sec-divider"></div>
                      <div className="sec-metric-item"><span className="sec-label">Faltas oblig.</span><span className="sec-value"><strong>No aplica</strong></span></div>
                    </>
                  ) : (
                    <>
                      <div className="sec-metric-item"><span className="sec-label">Faltas injust.</span><span className={grupo.faltasInjustificadasMes > 0 ? 'sec-value text-alerta' : 'sec-value'}><strong>{grupo.faltasInjustificadasMes}</strong></span></div>
                      <div className="sec-divider"></div>
                      <div className="sec-metric-item"><span className="sec-label">Horas oblig.</span><span className="sec-value"><strong>{grupo.horasMes}</strong> h</span></div>
                      <div className="sec-divider"></div>
                      <div className="sec-metric-item"><span className="sec-label">Horas volunt.</span><span className="sec-value"><strong>{grupo.horasVoluntariasMes}</strong> h</span></div>
                    </>
                  )}
                </div>

                <div className="card-footer-info">
                  <div className="footer-meta-line">
                    <i className="pi pi-calendar-clock"></i>
                    <span className="next-session-text">
                      {grupo.proximaJornada
                        ? `Próxima: ${fechaCorta(grupo.proximaJornada.fecha)}${
                            grupo.proximaJornada.horaInicio ? ` · ${grupo.proximaJornada.horaInicio} hrs` : ''
                          }`
                        : 'Sin jornadas programadas'}
                    </span>
                  </div>
                  <div className="footer-instructor-line">
                    <i className="pi pi-user"></i>
                    <span>
                      Encargado: {grupo.encargado ? <strong>{grupo.encargado}</strong> : <em>sin asignar</em>}
                    </span>
                  </div>
                </div>

                <div className="card-action-bar">
                  <Link to={`/seguimiento?grupo=${grupo.grupoId}`} className="btn-group-action">
                    <span>Ver seguimiento del grupo</span>
                    <i className="pi pi-arrow-up-right"></i>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
