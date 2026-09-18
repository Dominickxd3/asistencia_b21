import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AtencionItem } from '../../core/models/api.models';

@Component({
  selector: 'app-attention-panel',
  imports: [RouterLink],
  template: `
    <div class="r21-attention-panel">
      <!-- Cabecera de Requieren atención -->
      <div class="panel-header-row">
        <h2 class="panel-title">Requieren atención</h2>
        @if (items().length > 0) {
          <span class="badge-alert-count">
            {{ items().length }} alerta{{ items().length === 1 ? '' : 's' }}
          </span>
        }
      </div>

      <div class="panel-card-content">
        @if (items().length === 0) {
          <div class="all-clear-state">
            <div class="clear-icon-badge">
              <i class="pi pi-check"></i>
            </div>
            <div class="clear-text-wrap">
              <span class="clear-title">Pizarra Operativa al Día</span>
              <span class="clear-sub">No se registran faltas injustificadas ni incidencias disciplinarias activas.</span>
            </div>
          </div>
          <div class="clear-footer-row">
            <i class="pi pi-shield"></i>
            <span>Control de asistencia conforme a reglamento B-21</span>
          </div>
        } @else {
          <!-- Lista de incidencias reales -->
          <div class="incidencias-list">
            @for (item of items(); track $index) {
              <a
                [routerLink]="['/asistencia']"
                class="incidencia-item"
                [class.item-warning]="item.tipo === 'PENDIENTES'"
              >
                <span
                  class="item-dot"
                  [class.dot-amber]="item.tipo === 'PENDIENTES'"
                  [class.dot-gray]="item.tipo !== 'PENDIENTES'"
                ></span>
                <div class="item-body">
                  <div class="item-main-row">
                    <strong class="item-title">{{ item.descripcion }}</strong>
                    <span
                      class="item-type-tag"
                      [class.tag-amber]="item.tipo === 'PENDIENTES'"
                    >
                      {{ item.tipo === 'PENDIENTES' ? 'Pendiente' : 'Registrado' }}
                    </span>
                  </div>
                  <span class="item-sub">Requiere verificación de asistencia</span>
                </div>
              </a>
            }
          </div>

          <!-- Pie: Estado general -->
          <div class="clear-footer-row">
            <i class="pi pi-check-circle"></i>
            <span>Sin incidencias críticas operativas</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .r21-attention-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .panel-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .panel-title {
      font-size: 17px;
      font-weight: 650;
      color: var(--r21-text-primary);
      margin: 0;
    }

    .badge-alert-count {
      font-size: 11px;
      font-weight: 600;
      background-color: var(--r21-amber-bg);
      border: 1px solid #FEDF89;
      color: var(--r21-amber);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .panel-card-content {
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: var(--r21-shadow-sm);
    }

    .all-clear-state {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background-color: #F8FAF8;
      border: 1px solid #E2EFE5;
      border-radius: var(--r21-radius-sm);

      .clear-icon-badge {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: #ECFDF3;
        color: var(--r21-green);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        i {
          font-size: 14px;
          font-weight: 700;
        }
      }

      .clear-text-wrap {
        display: flex;
        flex-direction: column;

        .clear-title {
          font-size: 13px;
          font-weight: 650;
          color: var(--r21-text-primary);
        }

        .clear-sub {
          font-size: 11.5px;
          color: var(--r21-text-secondary);
        }
      }
    }

    .incidencias-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .incidencia-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--r21-radius-sm);
      background-color: #F9FAFB;
      border: 1px solid var(--r21-border-subtle);
      text-decoration: none;
      transition: background-color var(--r21-transition-fast);

      &:hover {
        background-color: #F2F4F7;
      }

      &.item-warning {
        background-color: #FEF7ED;
        border-color: #FEDF89;

        &:hover {
          background-color: #FDE8D0;
        }
      }
    }

    .item-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;

      &.dot-amber { background-color: var(--r21-amber); }
      &.dot-gray { background-color: var(--r21-text-secondary); }
    }

    .item-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .item-main-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;

      .item-title {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--r21-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-type-tag {
        font-size: 11px;
        font-weight: 500;
        color: var(--r21-text-secondary);
        flex-shrink: 0;

        &.tag-amber {
          color: var(--r21-amber);
          font-weight: 600;
        }
      }
    }

    .item-sub {
      font-size: 11px;
      color: var(--r21-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .clear-footer-row {
      padding-top: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--r21-green);

      i {
        font-size: 13px;
      }
    }
  `]
})
export class AttentionPanelComponent {
  readonly items = input.required<AtencionItem[]>();
}
