import {Component, input} from '@angular/core';
import {TuiIcon} from '@taiga-ui/core';
import {ResumenHoy} from '../../core/models/api.models';

@Component({
  selector: 'app-daily-summary',
  imports: [TuiIcon],
  template: `
    <section class="today-summary" aria-label="Indicadores de asistencia">
      <div class="summary-metrics">
        <div class="summary-metric attendance"><div class="metric-icon"><tui-icon icon="@tui.user-check" /></div><div class="metric-copy"><span>{{ modoMes() ? 'Asistencias' : 'Presentes' }}</span><strong>{{ resumen().presentesAhora }}</strong><small>{{ modoMes() ? 'registros confirmados' : 'personas registradas' }}</small></div></div>
        <div class="summary-metric pending"><div class="metric-icon"><tui-icon icon="@tui.clock-3" /></div><div class="metric-copy"><span>Pendientes</span><strong>{{ resumen().pendientes }}</strong><small>{{ resumen().pendientes === 1 ? 'registro por resolver' : 'registros por resolver' }}</small></div></div>
        <div class="summary-metric absences"><div class="metric-icon"><tui-icon icon="@tui.user-x" /></div><div class="metric-copy"><span>{{ resumen().faltas === 1 ? 'Falta' : 'Faltas' }}</span><strong>{{ resumen().faltas }}</strong><small>incidencias registradas</small></div></div>
      </div>
    </section>
  `,
  styles: [`
    .today-summary{overflow:hidden;background:var(--r21-surface);border:1px solid var(--r21-border);border-radius:var(--r21-radius-lg);color:var(--r21-text-primary);box-shadow:var(--r21-shadow-card)}
    .summary-metrics{display:grid;grid-template-columns:repeat(3,1fr)}.summary-metric{position:relative;display:flex;align-items:center;gap:15px;min-height:112px;padding:20px 24px}.summary-metric+.summary-metric:before{position:absolute;inset:24px auto 24px 0;width:1px;background:var(--r21-border-subtle);content:''}.metric-icon{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:10px;color:#166b46;background:#edf8f2}.metric-icon tui-icon{font-size:19px}.metric-copy{display:flex;min-width:0;flex-direction:column}.summary-metric strong{order:2;margin-top:4px;font-size:31px;font-weight:750;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums}.summary-metric span{order:1;color:var(--r21-text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.045em;text-transform:uppercase}.summary-metric small{order:3;margin-top:6px;color:var(--r21-text-muted);font-size:10.5px;white-space:nowrap}.pending .metric-icon{color:#a15c00;background:var(--r21-amber-bg)}.pending strong{color:#a15c00}.absences .metric-icon{color:var(--r21-red);background:var(--r21-red-light)}.absences strong{color:var(--r21-red)}
    @media(max-width:620px){.summary-metric{min-height:94px;padding:15px}.summary-metric strong{font-size:27px}.metric-icon,.summary-metric small{display:none}}
  `],
})
export class DailySummaryComponent {
  readonly resumen=input.required<ResumenHoy>();
  readonly modoMes=input(false);
}
