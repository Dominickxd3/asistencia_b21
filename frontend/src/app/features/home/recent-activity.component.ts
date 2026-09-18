import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ActividadItem } from '../../core/models/api.models';

@Component({
  selector: 'app-recent-activity',
  imports: [DatePipe, RouterLink, AvatarModule],
  template: `
    <div class="r21-recent-activity">
      <!-- Cabecera -->
      <div class="activity-header-row">
        <h2 class="activity-title">Actividad reciente</h2>
        @if (actividad().length > 0) {
          <span class="activity-count-badge">
            {{ actividad().length }} registro{{ actividad().length === 1 ? '' : 's' }}
          </span>
        }
      </div>

      <!-- Tarjeta de Contenido -->
      <div class="activity-card-content">
        @if (actividad().length === 0) {
          <div class="empty-activity-box">
            <div class="standby-icon-badge">
              <i class="pi pi-history"></i>
            </div>
            <div class="standby-text-wrap">
              <span class="standby-title">Bitácora en Espera</span>
              <span class="standby-desc">Las marcas de asistencia de las jornadas programadas se reflejarán aquí en tiempo real.</span>
            </div>
          </div>
          <div class="activity-footer-standby">
            <span class="pulse-dot-green"></span>
            <span>Canal de sincronización de cuartel activo</span>
          </div>
        } @else {
          <div class="activity-items-list">
            @for (item of actividadVisible(); track item.asistencia_id) {
              <div class="activity-row">
                <div class="activity-left-wrap">
                  <span class="time-col">{{ item.fechaHora | date: 'HH:mm' }}</span>
                  <p-avatar
                    [label]="obtenerIniciales(item.persona)"
                    shape="circle"
                    styleClass="r21-item-avatar"
                  />
                  <div class="details-col">
                    <span class="person-name">{{ item.persona }}</span>
                    <span class="action-and-group">
                      {{ etiquetaAccion(item.accion) }} · {{ item.grupo }}
                    </span>
                  </div>
                </div>
                <span class="live-status-dot"></span>
              </div>
            }
          </div>

          <!-- Pie: Ver actividad completa si hay registros -->
          <div class="activity-footer-row">
            <a [routerLink]="['/asistencia']" class="btn-full-activity">
              <span>Ver actividad completa</span>
              <i class="pi pi-arrow-right"></i>
            </a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .r21-recent-activity {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .activity-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .activity-title {
      font-size: 17px;
      font-weight: 650;
      color: var(--r21-text-primary);
      margin: 0;
    }

    .activity-count-badge {
      font-size: 11px;
      font-weight: 500;
      color: var(--r21-text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .activity-card-content {
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: var(--r21-shadow-sm);
    }

    .empty-activity-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background-color: #FAFAFA;
      border: 1px solid var(--r21-border-subtle);
      border-radius: var(--r21-radius-sm);

      .standby-icon-badge {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: #F2F4F7;
        color: var(--r21-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        i {
          font-size: 14px;
        }
      }

      .standby-text-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .standby-title {
          font-size: 13px;
          font-weight: 650;
          color: var(--r21-text-primary);
        }

        .standby-desc {
          font-size: 11.5px;
          color: var(--r21-text-secondary);
          line-height: 1.35;
        }
      }
    }

    .activity-footer-standby {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--r21-text-secondary);
      padding-top: 4px;

      .pulse-dot-green {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--r21-green);
        box-shadow: 0 0 0 2px rgba(20, 128, 74, 0.2);
        flex-shrink: 0;
      }
    }

    .activity-items-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .activity-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .activity-left-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .time-col {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--r21-text-secondary);
      font-variant-numeric: tabular-nums;
      width: 36px;
      flex-shrink: 0;
    }

    :host ::ng-deep .r21-item-avatar {
      width: 28px;
      height: 28px;
      font-size: 10px;
      font-weight: 700;
      background-color: #F2F4F7;
      color: #344054;
      border: 1px solid var(--r21-border);
      flex-shrink: 0;
    }

    .details-col {
      display: flex;
      flex-direction: column;
      min-width: 0;

      .person-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--r21-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .action-and-group {
        font-size: 11px;
        color: var(--r21-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .live-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--r21-green);
      flex-shrink: 0;
    }

    .activity-footer-row {
      padding-top: 10px;
      border-top: 1px solid #F2F4F7;
      display: flex;
      justify-content: flex-end;
    }

    .btn-full-activity {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--r21-text-secondary);
      text-decoration: none;
      transition: color var(--r21-transition-fast);

      i {
        font-size: 11px;
        transition: transform var(--r21-transition-fast);
      }

      &:hover {
        color: var(--r21-text-primary);

        i {
          transform: translateX(2px);
        }
      }
    }
  `]
})
export class RecentActivityComponent {
  readonly actividad = input.required<ActividadItem[]>();

  // Máximo 4-5 elementos visibles como solicitó el usuario
  protected readonly actividadVisible = computed(() => {
    return this.actividad().slice(0, 5);
  });

  obtenerIniciales(nombre: string): string {
    if (!nombre) return '';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  etiquetaAccion(accion: string): string {
    const mapa: Record<string, string> = {
      PRESENTE: 'Entrada registrada',
      FINALIZADO: 'Jornada concluida',
      FALTA_JUSTIFICADA: 'Falta justificada',
      FALTA_INJUSTIFICADA: 'Falta injustificada',
      SALIDA_ANTICIPADA: 'Salida anticipada',
    };
    return mapa[accion] ?? accion;
  }
}
