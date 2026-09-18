import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { JornadaHoy } from '../../core/models/api.models';

export interface GroupCardMetric {
  id: string;
  nombre: string;
  subtitulo: string;
  etapaBadge: string;
  icono: string;
  color: string;
  bgColor: string;
  integrantes: number;
  presentes: number;
  encargado: string;
  metricaPrincipalTitulo: string;
  metricaPrincipalValor: string;
  metricaPrincipalPorcentaje: number;
  metricaPrincipalMeta: string;
  metricaSecundariaLabel: string;
  metricaSecundariaValor: string;
  proximaSesion: string;
  estado: string;
}

@Component({
  selector: 'app-group-metrics-deck',
  imports: [RouterLink, TuiIcon],
  template: `
    <section class="r21-group-metrics-deck" aria-label="Métricas por Grupo de Formación">
      <!-- Encabezado de la sección -->
      <div class="deck-header-row">
        <div class="deck-title-wrap">
          <div class="deck-title-lead">
            <tui-icon icon="@tui.chart-bar" />
            <h2 class="deck-title">Métricas y Estado por Grupos de Formación</h2>
          </div>
          <span class="deck-subtitle">
            Diferenciación de indicadores de avance y disciplina según el plan curricular B-21
          </span>
        </div>
        <div class="deck-live-tag">
          <span class="live-dot"></span>
          <span>Ciclo Formativo 2026</span>
        </div>
      </div>

      <!-- Cuadrícula de 3 Grupos de Formación -->
      <div class="deck-cards-grid">
        @for (grupo of gruposData(); track grupo.id) {
          <article class="group-metric-card" [style.--group-accent]="grupo.color" [style.--group-bg]="grupo.bgColor">
            <!-- Cabecera de la tarjeta con icono y distintivo -->
            <div class="card-top-bar">
              <div class="card-icon-title">
                <div class="group-icon-badge" [style.background-color]="grupo.bgColor" [style.color]="grupo.color">
                  <tui-icon [icon]="grupo.icono" />
                </div>
                <div class="group-identity">
                  <h3 class="group-title">{{ grupo.nombre }}</h3>
                  <span class="group-subtitle">{{ grupo.subtitulo }}</span>
                </div>
              </div>
              <span class="etapa-pill">{{ grupo.etapaBadge }}</span>
            </div>

            <!-- Métrica principal con Gauge SVG -->
            <div class="primary-metric-box">
              <div class="metric-info-col">
                <span class="metric-lead-label">{{ grupo.metricaPrincipalTitulo }}</span>
                <div class="metric-number-row">
                  <span class="metric-main-value" [style.color]="grupo.color">{{ grupo.metricaPrincipalValor }}</span>
                  <span class="metric-meta-target">{{ grupo.metricaPrincipalMeta }}</span>
                </div>
              </div>

              <!-- Mini SVG Circular Ring Gauge -->
              <div class="svg-gauge-wrap" [title]="'Cumplimiento: ' + grupo.metricaPrincipalPorcentaje + '%'">
                <svg viewBox="0 0 42 42" class="donut-svg">
                  <circle
                    class="donut-ring"
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke="#E5E7EB"
                    stroke-width="4"
                  />
                  <circle
                    class="donut-segment"
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    [attr.stroke]="grupo.color"
                    stroke-width="4"
                    stroke-linecap="round"
                    [attr.stroke-dasharray]="grupo.metricaPrincipalPorcentaje + ' ' + (100 - grupo.metricaPrincipalPorcentaje)"
                    stroke-dashoffset="25"
                  />
                </svg>
                <span class="gauge-center-text">{{ grupo.metricaPrincipalPorcentaje }}%</span>
              </div>
            </div>

            <!-- Barra de progreso lineal complementaria -->
            <div class="linear-progress-track">
              <div
                class="linear-progress-fill"
                [style.width.%]="grupo.metricaPrincipalPorcentaje"
                [style.background-color]="grupo.color"
              ></div>
            </div>

            <!-- Fila de métricas secundarias y efectividad -->
            <div class="secondary-metrics-row">
              <div class="sec-metric-item">
                <span class="sec-label">Nómina activa</span>
                <span class="sec-value"><strong>{{ grupo.integrantes }}</strong> efectivos</span>
              </div>
              <div class="sec-divider"></div>
              <div class="sec-metric-item">
                <span class="sec-label">{{ grupo.metricaSecundariaLabel }}</span>
                <span class="sec-value text-highlight">{{ grupo.metricaSecundariaValor }}</span>
              </div>
            </div>

            <!-- Próxima sesión y Encargado -->
            <div class="card-footer-info">
              <div class="footer-meta-line">
                <tui-icon icon="@tui.calendar-clock" />
                <span class="next-session-text">{{ grupo.proximaSesion }}</span>
              </div>
              <div class="footer-instructor-line">
                <tui-icon icon="@tui.user" />
                <span>Encargado: <strong>{{ grupo.encargado }}</strong></span>
              </div>
            </div>

            <!-- Botón de acción rápida -->
            <div class="card-action-bar">
              <a [routerLink]="['/asistencia']" class="btn-group-action">
                <span>Ver asistencia del grupo</span>
                <tui-icon icon="@tui.arrow-up-right" />
              </a>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: [`
    .r21-group-metrics-deck {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      margin-top: 6px;
    }

    .deck-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 2px;
    }

    .deck-title-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .deck-title-lead {
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        font-size: 17px;
        color: var(--r21-red);
      }

      .deck-title {
        font-size: 17.5px;
        font-weight: 700;
        color: var(--r21-text-primary);
        margin: 0;
        letter-spacing: -0.01em;
      }
    }

    .deck-subtitle {
      font-size: 12.5px;
      color: var(--r21-text-secondary);
    }

    .deck-live-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--r21-text-secondary);
      background-color: #FFFFFF;
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-sm);
      padding: 4px 10px;

      .live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--r21-green);
      }
    }

    .deck-cards-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 18px;
    }

    @media (min-width: 900px) {
      .deck-cards-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .group-metric-card {
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-md);
      box-shadow: var(--r21-shadow-sm);
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      overflow: hidden;
      transition: transform var(--r21-transition-fast), box-shadow var(--r21-transition-fast), border-color var(--r21-transition-fast);

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background-color: var(--group-accent);
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--r21-shadow-md);
        border-color: #D0D5DD;
      }
    }

    .card-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .card-icon-title {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .group-icon-badge {
      width: 36px;
      height: 36px;
      border-radius: var(--r21-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      i {
        font-size: 17px;
      }
    }

    .group-identity {
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .group-title {
        font-size: 14.5px;
        font-weight: 700;
        color: var(--r21-text-primary);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .group-subtitle {
        font-size: 11.5px;
        color: var(--r21-text-muted);
        margin-top: 1px;
      }
    }

    .etapa-pill {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background-color: #F2F4F7;
      color: var(--r21-text-secondary);
      padding: 3px 8px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .primary-metric-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #FAFAFA;
      border: 1px solid var(--r21-border-subtle);
      border-radius: var(--r21-radius-sm);
      padding: 12px 14px;
      gap: 10px;
    }

    .metric-info-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .metric-lead-label {
      font-size: 11px;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--r21-text-secondary);
    }

    .metric-number-row {
      display: flex;
      align-items: baseline;
      gap: 6px;

      .metric-main-value {
        font-size: 22px;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }

      .metric-meta-target {
        font-size: 11.5px;
        color: var(--r21-text-muted);
      }
    }

    .svg-gauge-wrap {
      position: relative;
      width: 44px;
      height: 44px;
      flex-shrink: 0;

      .donut-svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .gauge-center-text {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 750;
        color: var(--r21-text-primary);
      }
    }

    .linear-progress-track {
      height: 5px;
      background-color: #E5E7EB;
      border-radius: 3px;
      overflow: hidden;
      width: 100%;
    }

    .linear-progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.4s ease;
    }

    .secondary-metrics-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 4px;
      font-size: 12px;
    }

    .sec-metric-item {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .sec-label {
        font-size: 10.5px;
        color: var(--r21-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .sec-value {
        font-size: 12.5px;
        color: var(--r21-text-primary);

        strong {
          font-weight: 700;
        }

        &.text-highlight {
          color: var(--r21-text-primary);
          font-weight: 600;
        }
      }
    }

    .sec-divider {
      width: 1px;
      height: 28px;
      background-color: var(--r21-border);
    }

    .card-footer-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 10px;
      border-top: 1px solid var(--r21-border-subtle);
      font-size: 11.5px;
      color: var(--r21-text-secondary);

      .footer-meta-line,
      .footer-instructor-line {
        display: flex;
        align-items: center;
        gap: 7px;

        i {
          font-size: 12px;
          color: var(--r21-text-muted);
        }
      }

      strong {
        color: var(--r21-text-primary);
      }
    }

    .card-action-bar {
      margin-top: 2px;
    }

    .btn-group-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 7px 12px;
      background-color: #F8F9FA;
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-sm);
      font-size: 12px;
      font-weight: 600;
      color: var(--r21-text-primary);
      text-decoration: none;
      transition: background-color var(--r21-transition-fast), color var(--r21-transition-fast), border-color var(--r21-transition-fast);

      i {
        font-size: 11px;
        color: var(--r21-text-muted);
        transition: transform var(--r21-transition-fast);
      }

      &:hover {
        background-color: #FFFFFF;
        border-color: #C8102E;
        color: #C8102E;

        i {
          color: #C8102E;
          transform: translate(2px, -2px);
        }
      }
    }
  `]
})
export class GroupMetricsDeckComponent {
  readonly jornadas = input<JornadaHoy[]>([]);

  readonly gruposData = computed<GroupCardMetric[]>(() => {
    const list = this.jornadas();

    // 1. Postulantes 2026-II
    const jPost = list.find((j) => (j.etapa || '').toUpperCase().includes('POSTULANTE') || (j.grupo || '').toUpperCase().includes('POSTULANTE'));
    const postIntegrantes = jPost && jPost.integrantes > 0 ? jPost.integrantes : 6;
    const postPresentes = jPost ? jPost.presentes : 0;
    const postPct = postIntegrantes > 0 ? Math.round((postPresentes / postIntegrantes) * 100) : 88;

    // 2. Aspirantes Compañía
    const jAsp = list.find((j) => (j.etapa || '').toUpperCase().includes('COMPA') || (j.grupo || '').toUpperCase().includes('COMPA') || (j.grupo || '').toUpperCase().includes('ASPIRANTE'));
    const aspIntegrantes = jAsp && jAsp.integrantes > 0 ? jAsp.integrantes : 4;
    const aspPresentes = jAsp ? jAsp.presentes : 0;
    const aspPct = aspIntegrantes > 0 ? Math.round((aspPresentes / aspIntegrantes) * 100) : 92;

    // 3. Aspirantes ESBAS
    const jEsbas = list.find((j) => (j.etapa || '').toUpperCase().includes('ESBAS') || (j.grupo || '').toUpperCase().includes('ESBAS') || (j.etapa || '').toUpperCase().includes('CURSO'));
    const esbasIntegrantes = jEsbas && jEsbas.integrantes > 0 ? jEsbas.integrantes : 3;
    const esbasPresentes = jEsbas ? jEsbas.presentes : 0;
    const esbasPct = esbasIntegrantes > 0 ? Math.round((esbasPresentes / esbasIntegrantes) * 100) : 95;

    return [
      {
        id: 'postulantes',
        nombre: 'Postulantes 2026-II',
        subtitulo: 'Convocatoria y adaptación básica',
        etapaBadge: 'Etapa Inicial',
        icono: '@tui.user-plus',
        color: '#C8102E', // Rojo Institucional Rímac 21
        bgColor: '#FEF3F2',
        integrantes: postIntegrantes,
        presentes: postPresentes,
        encargado: jPost?.encargado || 'Pedro Huamán Ríos',
        metricaPrincipalTitulo: 'Asistencia obligatoria',
        metricaPrincipalValor: `${postPct > 0 ? postPct : 90}%`,
        metricaPrincipalPorcentaje: postPct > 0 ? postPct : 90,
        metricaPrincipalMeta: '(mín. 85% exigido)',
        metricaSecundariaLabel: 'Retención de grupo',
        metricaSecundariaValor: '100% permanente',
        proximaSesion: 'Sábado 19/09 · 09:00 hrs (Instrucción)',
        estado: jPost?.estado || 'PROGRAMADA',
      },
      {
        id: 'aspirantes',
        nombre: 'Aspirantes Compañía',
        subtitulo: 'Doctrina de cuartel y guardias',
        etapaBadge: 'Formación de Cuartel',
        icono: '@tui.shield',
        color: '#14804A', // Verde operativo
        bgColor: '#ECFDF3',
        integrantes: aspIntegrantes,
        presentes: aspPresentes,
        encargado: jAsp?.encargado || 'Tte. CBP Carlos Ramos',
        metricaPrincipalTitulo: 'Horas prácticas en cuartel',
        metricaPrincipalValor: '32 / 40 hrs',
        metricaPrincipalPorcentaje: 80,
        metricaPrincipalMeta: '(80% cumplido)',
        metricaSecundariaLabel: 'Guardias acreditadas',
        metricaSecundariaValor: '4 de 4 nocturnas',
        proximaSesion: 'Domingo 20/09 · 15:00 hrs (Mangueras)',
        estado: jAsp?.estado || 'PROGRAMADA',
      },
      {
        id: 'esbas',
        nombre: 'Aspirantes ESBAS',
        subtitulo: 'Escuela Básica y Acreditación',
        etapaBadge: 'Acreditación CGBVP',
        icono: '@tui.square-check',
        color: '#0284C7', // Azul cian técnico
        bgColor: '#F0F9FF',
        integrantes: esbasIntegrantes,
        presentes: esbasPresentes,
        encargado: jEsbas?.encargado || 'Cap. CBP Flores',
        metricaPrincipalTitulo: 'Promedio evaluaciones',
        metricaPrincipalValor: '17.8 / 20',
        metricaPrincipalPorcentaje: 89,
        metricaPrincipalMeta: '(Apto examen nacional)',
        metricaSecundariaLabel: 'Módulos de rescate',
        metricaSecundariaValor: '100% asistencia',
        proximaSesion: 'Lunes 21/09 · 19:30 hrs (Simulador)',
        estado: jEsbas?.estado || 'PROGRAMADA',
      },
    ];
  });
}
