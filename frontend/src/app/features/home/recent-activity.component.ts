import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { ActividadItem } from '../../core/models/api.models';

@Component({
  selector: 'app-recent-activity',
  imports: [DatePipe, TuiIcon],
  template: `
    <section class="activity-section" aria-labelledby="activity-title">
      <div class="activity-heading"><h2 id="activity-title">Últimos movimientos</h2></div>
      <div class="activity-card">
        @if (actividadVisible().length === 0) {
          <div class="empty-state">
            <tui-icon icon="@tui.history" />
            <span>Sin actividad registrada hoy</span>
          </div>
        } @else {
          @for (item of actividadVisible(); track $index) {
            <article class="activity-row">
              <time>{{ item.fechaHora | date: 'HH:mm' }}</time>
              <div class="activity-data">
                <strong>{{ item.persona }}</strong>
                <span>{{ etiquetaAccion(item.accion) }}</span>
                <small>{{ item.grupo }}</small>
              </div>
            </article>
          }
        }
      </div>
    </section>
  `,
  styles: [`
    .activity-section { display: flex; flex-direction: column; gap: 12px; }
    h2 { margin: 0; color: var(--r21-text-primary); font-size: 17px; font-weight: 680; }
    .activity-heading{display:flex;align-items:center;justify-content:space-between}
    .activity-card { overflow: hidden; background: var(--r21-surface); border: 1px solid var(--r21-border); border-radius: var(--r21-radius-md); box-shadow: var(--r21-shadow-sm); }
    .activity-row { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 12px; padding: 12px 14px; }
    .activity-row + .activity-row { border-top: 1px solid var(--r21-border-subtle); }
    time { padding-top: 2px; color: var(--r21-text-secondary); font-size: 11.5px; font-weight: 650; font-variant-numeric: tabular-nums; }
    .activity-data { display: grid; min-width: 0; gap: 2px; }
    .activity-data strong { overflow: hidden; color: var(--r21-text-primary); font-size: 12.5px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .activity-data span { color: var(--r21-text-secondary); font-size: 11.5px; }
    .activity-data small { overflow: hidden; color: var(--r21-text-muted); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
    .empty-state { display: flex; align-items: center; gap: 9px; min-height: 72px; padding: 16px; color: var(--r21-text-secondary); font-size: 12px; }
  `],
})
export class RecentActivityComponent {
  readonly actividad = input.required<ActividadItem[]>();
  readonly actividadVisible = computed(() => this.actividad().slice(0, 5));

  etiquetaAccion(accion: string): string {
    const mapa: Record<string, string> = {
      ENTRADA: 'Entrada registrada',
      SALIDA: 'Salida registrada',
      FALTA_JUSTIFICADA: 'Falta justificada',
      FALTA_INJUSTIFICADA: 'Falta injustificada',
      SALIDA_ANTICIPADA: 'Salida anticipada',
    };
    return mapa[accion] ?? accion;
  }
}
