import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { AtencionItem } from '../../core/models/api.models';

@Component({
  selector: 'app-attention-panel',
  imports: [RouterLink, TuiIcon],
  template: `
    <section class="attention-section" aria-labelledby="attention-title">
      <div class="section-heading">
        <h2 id="attention-title">Requieren atención</h2>
      </div>

      <div class="attention-card">
        @if (items().length === 0) {
          <div class="all-clear">
            <tui-icon icon="@tui.circle-check" />
            <strong>Todo en orden</strong>
          </div>
        } @else {
          @for (item of items(); track item.jornadaId + '-' + item.tipo) {
            <a routerLink="/asistencia" class="attention-row">
              <span class="alert-mark" [class.absence]="item.tipo !== 'PENDIENTES'"></span>
              <span class="attention-copy">
                <strong>{{ item.descripcion }}</strong>
                <small>{{ item.grupo }}</small>
              </span>
              <tui-icon icon="@tui.chevron-right" />
            </a>
          }
        }
      </div>
    </section>
  `,
  styles: [`
    .attention-section { display: flex; flex-direction: column; gap: 12px; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; }
    h2 { margin: 0; color: var(--r21-text-primary); font-size: 17px; font-weight: 680; }
    .attention-card { overflow: hidden; background: var(--r21-surface); border: 1px solid var(--r21-border); border-radius: var(--r21-radius-md); box-shadow: var(--r21-shadow-sm); }
    .all-clear { display: flex; align-items: center; gap: 10px; min-height: 72px; padding: 16px; color: var(--r21-green); font-size: 13px; }
    .attention-row { display: flex; align-items: center; gap: 11px; min-height: 68px; padding: 12px 14px; color: inherit; text-decoration: none; transition: background var(--r21-transition-fast); }
    .attention-row + .attention-row { border-top: 1px solid var(--r21-border-subtle); }
    .attention-row:hover { background: #fafafa; }
    .attention-row > tui-icon { margin-left: auto; color: var(--r21-text-muted); font-size: 15px; }
    .alert-mark { flex: 0 0 8px; width: 8px; height: 8px; border-radius: 50%; background: var(--r21-amber); }
    .alert-mark.absence { background: var(--r21-red); }
    .attention-copy { display: flex; flex-direction: column; min-width: 0; gap: 4px; }
    .attention-copy strong { color: var(--r21-text-primary); font-size: 12.5px; font-weight: 650; }
    .attention-copy small { overflow: hidden; color: var(--r21-text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  `],
})
export class AttentionPanelComponent {
  readonly items = input.required<AtencionItem[]>();
}
