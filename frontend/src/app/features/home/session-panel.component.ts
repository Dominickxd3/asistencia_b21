import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { JornadaHoy, AtencionItem } from '../../core/models/api.models';

@Component({
  selector: 'app-session-panel',
  imports: [RouterLink, ProgressBarModule, TagModule],
  template: `
    <article class="r21-session-panel">
      <!-- 1. Cabecera de la Jornada -->
      <div class="panel-header-row">
        <div class="header-left">
          <div class="title-and-tags">
            <h3 class="panel-group-title">{{ nombreGrupo() }}</h3>
            <p-tag
              [value]="tipoJornada()"
              [severity]="tipoJornada() === 'OBLIGATORIA' ? 'danger' : 'secondary'"
              styleClass="tag-compact-caps"
            />
          </div>
          <div class="schedule-line">
            <i class="pi pi-clock"></i>
            <span class="schedule-time">{{ horario() }}</span>
            <span class="schedule-dot">·</span>
            <span class="schedule-meta">{{ etapaTexto() }}</span>
          </div>
        </div>

        <div class="status-badge-wrap" [class.badge-active]="esActiva()" [class.badge-pending]="!esActiva()">
          <span class="status-indicator-dot" [class.dot-green]="esActiva()" [class.dot-amber]="!esActiva()"></span>
          <span class="status-badge-text">{{ estadoTexto() }}</span>
        </div>
      </div>

      <!-- 2. Barra de Progreso y Rango de Asistencia -->
      <div class="progress-box">
        <div class="progress-labels-row">
          <div class="count-attendance">
            <span class="count-main">
              <strong>{{ presentes() }}</strong> / {{ totalIntegrantes() }} presentes
            </span>
            <span class="pct-badge">({{ porcentajeProgreso() }}%)</span>
          </div>
          <span class="count-pending" [class.has-pending]="pendientes() > 0">
            @if (pendientes() > 0) {
              {{ pendientes() }} pendiente{{ pendientes() === 1 ? '' : 's' }} por registrar
            } @else if (presentes() > 0 && presentes() === totalIntegrantes()) {
              Nómina completa (100%)
            } @else {
              En espera de toma de lista
            }
          </span>
        </div>
        <p-progressBar [value]="porcentajeProgreso()" [showValue]="false" styleClass="r21-progress-thick" />
      </div>

      <!-- 3. Detalle de Casos Relevantes -->
      <div class="relevant-cases-section">
        <div class="cases-title-row">
          <span class="cases-heading">Detalle de casos relevantes</span>
          @if (casosRelevantes().length > 0) {
            <span class="cases-count-tag">{{ casosRelevantes().length }} caso{{ casosRelevantes().length === 1 ? '' : 's' }}</span>
          }
        </div>

        <div class="cases-list-wrap">
          @if (casosRelevantes().length === 0) {
            <div class="case-item-clean">
              <span class="case-dot-icon dot-green"></span>
              <div class="case-text-group">
                <strong class="case-bold-title">Todo en orden</strong>
                <span class="case-inline-desc">Sin incidencias disciplinarias ni faltas pendientes en este grupo</span>
              </div>
            </div>
          } @else {
            @for (caso of casosRelevantes(); track $index) {
              <div class="case-item-warning">
                <span class="case-dot-icon dot-amber"></span>
                <div class="case-text-group">
                  <strong class="case-bold-title">{{ caso.descripcion }}</strong>
                  <span class="case-inline-desc">Requiere confirmación de asistencia en pizarra</span>
                </div>
                <span class="case-alert-chip">Pendiente</span>
              </div>
            }
          }
        </div>
      </div>

      <!-- 4. Pie del Panel: Encargado y Botón de Acción -->
      <div class="panel-footer-row">
        <div class="instructor-profile">
          <div class="instructor-avatar-mini">
            <i class="pi pi-user"></i>
          </div>
          <div class="instructor-info">
            <span class="inst-label">Encargado de grupo</span>
            <span class="inst-name">{{ encargado() }}</span>
          </div>
        </div>

        <a
          [routerLink]="['/asistencia']"
          class="btn-action-asistencia"
        >
          <span>Ver registro de asistencia</span>
          <i class="pi pi-arrow-right"></i>
        </a>
      </div>
    </article>
  `,
  styles: [`
    .r21-session-panel {
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-md);
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-shadow: var(--r21-shadow-sm);
    }

    .panel-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .title-and-tags {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .panel-group-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--r21-text-primary);
      margin: 0;
      line-height: 1.25;
    }

    :host ::ng-deep .tag-compact-caps {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 7px;
    }

    .schedule-line {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: var(--r21-text-secondary);

      i {
        font-size: 12px;
        color: var(--r21-text-muted);
      }

      .schedule-time {
        font-weight: 600;
        color: var(--r21-text-primary);
        font-variant-numeric: tabular-nums;
      }

      .schedule-dot {
        color: var(--r21-border);
      }
    }

    .status-badge-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;

      &.badge-active {
        background-color: var(--r21-green-bg);
        border: 1px solid #A6F4C5;
        color: var(--r21-green);
      }

      &.badge-pending {
        background-color: var(--r21-amber-bg);
        border: 1px solid #FEDF89;
        color: var(--r21-amber);
      }
    }

    .status-indicator-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;

      &.dot-green { background-color: var(--r21-green); }
      &.dot-amber { background-color: var(--r21-amber); }
    }

    .progress-box {
      background-color: #FAFAFA;
      border: 1px solid var(--r21-border-subtle);
      border-radius: var(--r21-radius-sm);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .progress-labels-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12.5px;

      .count-attendance {
        display: flex;
        align-items: baseline;
        gap: 6px;
        color: var(--r21-text-primary);

        strong {
          font-weight: 750;
        }

        .pct-badge {
          font-size: 11.5px;
          color: var(--r21-text-secondary);
        }
      }

      .count-pending {
        color: var(--r21-text-secondary);
        font-size: 12px;

        &.has-pending {
          color: var(--r21-amber);
          font-weight: 600;
        }
      }
    }

    :host ::ng-deep .r21-progress-thick {
      height: 7px;
      border-radius: 4px;
      background-color: #E9ECEF;

      .p-progressbar-value {
        background-color: var(--r21-red);
        border-radius: 4px;
      }
    }

    .relevant-cases-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .cases-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .cases-heading {
      font-size: 11px;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--r21-text-secondary);
    }

    .cases-count-tag {
      font-size: 11px;
      font-weight: 600;
      color: var(--r21-amber);
    }

    .cases-list-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .case-item-clean,
    .case-item-warning {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: var(--r21-radius-sm);
      font-size: 12px;
    }

    .case-item-clean {
      background-color: #F8FAF8;
      border: 1px solid #E2EFE5;
    }

    .case-item-warning {
      background-color: #FEF7ED;
      border: 1px solid #FEDF89;
      justify-content: space-between;
    }

    .case-dot-icon {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;

      &.dot-green { background-color: var(--r21-green); }
      &.dot-amber { background-color: var(--r21-amber); }
    }

    .case-text-group {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex-wrap: wrap;

      .case-bold-title {
        font-weight: 650;
        color: var(--r21-text-primary);
      }

      .case-inline-desc {
        color: var(--r21-text-secondary);
      }
    }

    .case-alert-chip {
      font-size: 11px;
      font-weight: 600;
      background-color: #FEF7ED;
      color: var(--r21-amber);
      padding: 1px 6px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .panel-footer-row {
      padding-top: 14px;
      border-top: 1px solid #F2F4F7;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .instructor-profile {
      display: flex;
      align-items: center;
      gap: 10px;

      .instructor-avatar-mini {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: #F2F4F7;
        border: 1px solid var(--r21-border);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--r21-text-secondary);
        font-size: 13px;
      }

      .instructor-info {
        display: flex;
        flex-direction: column;

        .inst-label {
          font-size: 11px;
          color: var(--r21-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }

        .inst-name {
          font-size: 13px;
          font-weight: 650;
          color: var(--r21-text-primary);
        }
      }
    }

    .btn-action-asistencia {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: var(--r21-radius-sm);
      border: 1px solid var(--r21-red);
      background-color: var(--r21-red);
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: background-color var(--r21-transition-fast), border-color var(--r21-transition-fast);

      i {
        font-size: 11px;
        transition: transform var(--r21-transition-fast);
      }

      &:hover {
        background-color: var(--r21-red-dark);
        border-color: var(--r21-red-dark);

        i {
          transform: translateX(2px);
        }
      }
    }

    @media (max-width: 576px) {
      .panel-header-row,
      .panel-footer-row {
        flex-direction: column;
        align-items: flex-start;
      }

      .btn-action-asistencia {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class SessionPanelComponent {
  readonly jornada = input<JornadaHoy | null>(null);
  readonly grupoId = input.required<string>();
  readonly incidencias = input<AtencionItem[]>([]);

  protected readonly nombreGrupo = computed(() => {
    const j = this.jornada();
    if (j) return j.grupo;
    const nombres: Record<string, string> = {
      postulantes: 'Postulantes 2026-II',
      aspirantes: 'Aspirantes Compañía',
      esbas: 'Aspirantes ESBAS',
    };
    return nombres[this.grupoId()] ?? 'Grupo de Formación';
  });

  protected readonly tipoJornada = computed(() => {
    return this.jornada()?.tipoJornada || 'OBLIGATORIA';
  });

  protected readonly horario = computed(() => {
    return this.jornada()?.horario || '19:00 — 22:00';
  });

  protected readonly etapaTexto = computed(() => {
    const j = this.jornada();
    if (j?.etapa) return j.etapa;
    const etapas: Record<string, string> = {
      postulantes: 'Etapa Postulante',
      aspirantes: 'Etapa Aspirante Compañía',
      esbas: 'Etapa Aspirante ESBAS',
    };
    return etapas[this.grupoId()] ?? 'Instrucción';
  });

  protected readonly esActiva = computed(() => {
    return this.jornada()?.estado === 'ABIERTA';
  });

  protected readonly estadoTexto = computed(() => {
    const e = this.jornada()?.estado;
    if (e === 'ABIERTA') return 'En curso';
    if (e === 'FINALIZADO' || e === 'CERRADA') return 'Finalizada';
    return 'Programada';
  });

  protected readonly presentes = computed(() => {
    const j = this.jornada();
    return j ? j.presentes + j.finalizados : 0;
  });

  protected readonly totalIntegrantes = computed(() => {
    const j = this.jornada();
    if (j && j.integrantes > 0) return j.integrantes;
    // Cuotas por nómina activa según seed
    const cuotas: Record<string, number> = {
      postulantes: 6,
      aspirantes: 4,
      esbas: 3,
    };
    return cuotas[this.grupoId()] ?? 6;
  });

  protected readonly pendientes = computed(() => {
    return this.jornada()?.pendientes || 0;
  });

  protected readonly porcentajeProgreso = computed(() => {
    const total = this.totalIntegrantes();
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.presentes() / total) * 100));
  });

  protected readonly encargado = computed(() => {
    const j = this.jornada();
    if (j?.encargado) return j.encargado;
    const encargados: Record<string, string> = {
      postulantes: 'Pedro Huamán Ríos',
      aspirantes: 'Tte. CBP Ramos',
      esbas: 'Cap. CBP Flores',
    };
    return encargados[this.grupoId()] ?? 'Carlos Quispe Mamani';
  });

  protected readonly casosRelevantes = computed(() => {
    return this.incidencias();
  });
}
