import { Component, computed, input } from '@angular/core';
import { ResumenHoy } from '../../core/models/api.models';

/**
 * Bloque Estado de Hoy: Tarjeta ejecutiva con acento institucional rojo,
 * 4 métricas de mando con mini-indicadores visuales SVG y balance de flujo operativo.
 */
@Component({
  selector: 'app-daily-summary',
  template: `
    <section class="r21-daily-summary" aria-label="Estado operativo del día">
      <div class="accent-red-bar"></div>

      <!-- Barra superior contextual -->
      <div class="summary-top-header">
        <div class="status-indicator-wrap">
          <span
            class="pulse-dot"
            [class.dot-green]="resumen().presentesAhora > 0"
            [class.dot-gray]="resumen().presentesAhora === 0"
          ></span>
          <span class="status-text">
            {{ resumen().presentesAhora > 0 ? 'Jornada de instrucción en curso' : 'Sin jornada activa en este momento' }}
          </span>
          <span class="header-sep">·</span>
          <span class="header-org-tag">B-21 Rímac</span>
        </div>

        <div class="next-session-pill">
          <i class="pi pi-calendar-clock"></i>
          <span>Próxima instrucción: Sábado 19/09 · 09:00 hrs</span>
        </div>
      </div>

      <!-- Cuadrícula de 4 Métricas de Mando con Gráficos y Gauges -->
      <div class="metrics-grid">
        <!-- 1. ASISTIDOS (Con mini gauge circular SVG) -->
        <div class="metric-block block-asistidos">
          <div class="metric-head">
            <span class="metric-title text-green">ASISTIDOS</span>
            <span class="metric-badge badge-green">{{ porcentajeAsistidos() }}%</span>
          </div>
          <div class="metric-body-row">
            <div class="metric-data">
              <span class="metric-number text-dark">{{ resumen().presentesAhora }}</span>
              <span class="metric-label">efectivos presentes en formación</span>
            </div>
            <!-- Mini Donut SVG -->
            <div class="metric-svg-ring" [title]="porcentajeAsistidos() + '% de asistencia'">
              <svg viewBox="0 0 36 36" class="mini-donut-svg">
                <path
                  class="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  class="circle-fill-green"
                  [attr.stroke-dasharray]="porcentajeAsistidos() + ', 100'"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <i class="pi pi-users ring-icon text-green"></i>
            </div>
          </div>
        </div>

        <!-- 2. FALTAS (Con indicador disciplinario) -->
        <div class="metric-block block-faltas">
          <div class="metric-head">
            <span class="metric-title text-neutral">FALTAS</span>
            <span class="metric-badge badge-neutral">
              {{ resumen().justificados }} justificada{{ resumen().justificados === 1 ? '' : 's' }}
            </span>
          </div>
          <div class="metric-body-row">
            <div class="metric-data">
              <span class="metric-number text-muted">{{ resumen().justificados }}</span>
              <span class="metric-label">faltas registradas con justificación</span>
            </div>
            <div class="metric-icon-box bg-neutral-light">
              <i class="pi pi-file-edit text-neutral"></i>
            </div>
          </div>
        </div>

        <!-- 3. PENDIENTES (Con alerta de estado) -->
        <div class="metric-block block-pendientes">
          <div class="metric-head">
            <span class="metric-title text-amber">PENDIENTES</span>
            <span class="metric-badge badge-amber">
              {{ resumen().pendientes > 0 ? 'Por registrar' : 'Al día' }}
            </span>
          </div>
          <div class="metric-body-row">
            <div class="metric-data">
              <span class="metric-number text-amber">{{ resumen().pendientes }}</span>
              <span class="metric-label">por confirmar pase de lista</span>
            </div>
            <div class="metric-icon-box bg-amber-light">
              <i class="pi pi-clock text-amber"></i>
            </div>
          </div>
        </div>

        <!-- 4. BALANCE DE FLUJO (Ingresos vs Salidas) -->
        <div class="metric-block block-flujo">
          <div class="metric-head">
            <span class="metric-title text-blue">FLUJO OPERATIVO</span>
            <span class="metric-badge badge-blue">Control de puerta</span>
          </div>
          <div class="metric-body-row">
            <div class="flow-data-col">
              <div class="flow-sub-row">
                <i class="pi pi-sign-in text-green"></i>
                <span class="flow-val"><strong>{{ resumen().ingresaronHoy }}</strong> ingresaron</span>
              </div>
              <div class="flow-sub-row">
                <i class="pi pi-sign-out text-muted"></i>
                <span class="flow-val"><strong>{{ resumen().salidasAnticipadas }}</strong> salidas previas</span>
              </div>
            </div>
            <div class="metric-icon-box bg-blue-light">
              <i class="pi pi-sort-alt text-blue"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- Cinta de flujo inferior informativa -->
      <div class="summary-bottom-ribbon">
        <div class="ribbon-item">
          <i class="pi pi-shield"></i>
          <span>Área de Instrucción activa</span>
        </div>
        <span class="ribbon-sep">·</span>
        <div class="ribbon-item">
          <i class="pi pi-check-circle text-green"></i>
          <span>Pizarras sincronizadas con el servidor</span>
        </div>
        <span class="ribbon-sep">·</span>
        <div class="ribbon-item">
          <i class="pi pi-building"></i>
          <span>Cuartel Rímac 21 · Jr. Trujillo</span>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .r21-daily-summary {
      position: relative;
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-md);
      box-shadow: var(--r21-shadow-sm);
      overflow: hidden;
      padding: 18px 24px 16px 26px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .accent-red-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 4px;
      background-color: var(--r21-red);
    }

    .summary-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .status-indicator-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--r21-text-primary);

      .pulse-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;

        &.dot-green {
          background-color: var(--r21-green);
          box-shadow: 0 0 0 2px rgba(20, 128, 74, 0.2);
        }

        &.dot-gray {
          background-color: var(--r21-text-muted);
        }
      }

      .header-sep {
        color: var(--r21-border);
      }

      .header-org-tag {
        font-size: 11px;
        font-weight: 700;
        color: var(--r21-red);
        background: #FEF3F2;
        padding: 1px 6px;
        border-radius: 4px;
      }
    }

    .next-session-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 500;
      color: var(--r21-text-secondary);
      background-color: #F8F9FA;
      padding: 3px 10px;
      border-radius: var(--r21-radius-sm);
      border: 1px solid var(--r21-border);

      i {
        color: var(--r21-text-muted);
        font-size: 11px;
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
    }

    @media (min-width: 640px) {
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1080px) {
      .metrics-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .metric-block {
      background-color: #FAFAFA;
      border: 1px solid var(--r21-border-subtle);
      border-radius: var(--r21-radius-sm);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: background-color var(--r21-transition-fast), border-color var(--r21-transition-fast);

      &:hover {
        background-color: #FFFFFF;
        border-color: #D0D5DD;
      }
    }

    .metric-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }

    .metric-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;

      &.text-green { color: var(--r21-green); }
      &.text-neutral { color: #475467; }
      &.text-amber { color: var(--r21-amber); }
      &.text-blue { color: #0284C7; }
    }

    .metric-badge {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      font-variant-numeric: tabular-nums;

      &.badge-green {
        background-color: #ECFDF3;
        color: var(--r21-green);
      }

      &.badge-neutral {
        background-color: #F2F4F7;
        color: #475467;
      }

      &.badge-amber {
        background-color: #FEF0C7;
        color: var(--r21-amber);
      }

      &.badge-blue {
        background-color: #F0F9FF;
        color: #0284C7;
      }
    }

    .metric-body-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .metric-data {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .metric-number {
      font-size: 24px;
      font-weight: 750;
      line-height: 1.1;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;

      &.text-dark { color: var(--r21-text-primary); }
      &.text-muted { color: #475467; }
      &.text-amber { color: var(--r21-amber); }
    }

    .metric-label {
      font-size: 11.5px;
      color: var(--r21-text-secondary);
      line-height: 1.3;
    }

    .metric-svg-ring {
      position: relative;
      width: 40px;
      height: 40px;
      flex-shrink: 0;

      .mini-donut-svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);

        .circle-bg {
          fill: none;
          stroke: #E5E7EB;
          stroke-width: 3.5;
        }

        .circle-fill-green {
          fill: none;
          stroke: var(--r21-green);
          stroke-width: 3.5;
          stroke-linecap: round;
          transition: stroke-dasharray 0.4s ease;
        }
      }

      .ring-icon {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }
    }

    .metric-icon-box {
      width: 36px;
      height: 36px;
      border-radius: var(--r21-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      i {
        font-size: 15px;
      }

      &.bg-neutral-light {
        background-color: #F2F4F7;
      }

      &.bg-amber-light {
        background-color: #FEF0C7;
      }

      &.bg-blue-light {
        background-color: #F0F9FF;
      }
    }

    .flow-data-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .flow-sub-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--r21-text-secondary);

      i {
        font-size: 11px;
      }

      strong {
        color: var(--r21-text-primary);
      }
    }

    .summary-bottom-ribbon {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--r21-border-subtle);
      font-size: 12px;
      color: var(--r21-text-secondary);
    }

    .ribbon-item {
      display: flex;
      align-items: center;
      gap: 6px;

      i {
        font-size: 12px;
        color: var(--r21-text-muted);
      }
    }

    .ribbon-sep {
      color: var(--r21-border);
    }
  `]
})
export class DailySummaryComponent {
  readonly resumen = input.required<ResumenHoy>();

  readonly porcentajeAsistidos = computed(() => {
    const r = this.resumen();
    const total = r.presentesAhora + r.pendientes + r.justificados;
    if (total === 0) return 0;
    return Math.min(100, Math.round((r.presentesAhora / total) * 100));
  });
}
