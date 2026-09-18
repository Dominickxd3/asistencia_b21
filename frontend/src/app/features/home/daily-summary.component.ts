import {Component, input} from '@angular/core';
import {TuiIcon} from '@taiga-ui/core';
import {ResumenHoy} from '../../core/models/api.models';

@Component({
  selector: 'app-daily-summary',
  imports: [TuiIcon],
  template: `
    <section class="today-summary" aria-labelledby="today-summary-title">
      <div class="summary-state" [class.is-active]="jornadaActiva() && !modoMes()">
        <span class="section-label" id="today-summary-title">{{ modoMes() ? 'Resumen del periodo' : 'Estado del día' }}</span>
        <div class="state-line"><span class="state-dot" [class.inactive]="!jornadaActiva()"></span><strong>{{ modoMes() ? 'Periodo seleccionado' : (jornadaActiva() ? 'Jornada activa' : 'Sin jornada activa') }}</strong></div>
        <span class="state-context">{{ modoMes() ? 'Consolidado de las jornadas en el periodo' : (jornadaActiva() ? 'Registro de asistencia en curso' : 'No hay registros abiertos ahora') }}</span>
      </div>
      <div class="summary-metrics">
        <div class="summary-metric attendance"><div class="metric-icon"><tui-icon icon="@tui.user-check" /></div><div class="metric-copy"><span>{{ modoMes() ? 'Asistencias' : 'Presentes' }}</span><strong>{{ resumen().presentesAhora }}</strong><small>{{ modoMes() ? 'registros confirmados' : 'personas registradas' }}</small></div></div>
        <div class="summary-metric pending"><div class="metric-icon"><tui-icon icon="@tui.clock-3" /></div><div class="metric-copy"><span>Pendientes</span><strong>{{ resumen().pendientes }}</strong><small>{{ resumen().pendientes === 1 ? 'registro por resolver' : 'registros por resolver' }}</small></div></div>
        <div class="summary-metric absences"><div class="metric-icon"><tui-icon icon="@tui.user-x" /></div><div class="metric-copy"><span>{{ resumen().faltas === 1 ? 'Falta' : 'Faltas' }}</span><strong>{{ resumen().faltas }}</strong><small>incidencias registradas</small></div></div>
      </div>
    </section>
  `,
  styles: [`
    .today-summary{display:grid;grid-template-columns:minmax(260px,.95fr) 2.3fr;overflow:hidden;background:var(--r21-surface);border:1px solid var(--r21-border);border-radius:var(--r21-radius-lg);color:var(--r21-text-primary);box-shadow:var(--r21-shadow-card)}
    .summary-state{position:relative;display:flex;flex-direction:column;justify-content:center;gap:9px;padding:22px 28px 22px 31px;border-right:1px solid var(--r21-border-subtle)}.summary-state:before{position:absolute;inset:18px auto 18px 0;width:3px;border-radius:0 3px 3px 0;background:#98a2b3;content:''}.summary-state.is-active:before{background:var(--r21-green)}
    .section-label{color:var(--r21-text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}.state-line{display:flex;align-items:center;gap:10px;font-size:17px}.state-dot{width:9px;height:9px;border-radius:50%;background:#4ac487;box-shadow:0 0 0 4px #4ac48724}.state-dot.inactive{background:#98a2b3;box-shadow:none}.state-context{color:var(--r21-text-muted);font-size:11.5px}
    .summary-metrics{display:grid;grid-template-columns:repeat(3,1fr)}.summary-metric{position:relative;display:flex;align-items:center;gap:15px;min-height:112px;padding:20px 24px}.summary-metric+.summary-metric:before{position:absolute;inset:24px auto 24px 0;width:1px;background:var(--r21-border-subtle);content:''}.metric-icon{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:10px;color:#166b46;background:#edf8f2}.metric-icon tui-icon{font-size:19px}.metric-copy{display:flex;min-width:0;flex-direction:column}.summary-metric strong{order:2;margin-top:4px;font-size:31px;font-weight:750;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums}.summary-metric span{order:1;color:var(--r21-text-secondary);font-size:10.5px;font-weight:700;letter-spacing:.045em;text-transform:uppercase}.summary-metric small{order:3;margin-top:6px;color:var(--r21-text-muted);font-size:10.5px;white-space:nowrap}.pending .metric-icon{color:#a15c00;background:var(--r21-amber-bg)}.pending strong{color:#a15c00}.absences .metric-icon{color:var(--r21-red);background:var(--r21-red-light)}.absences strong{color:var(--r21-red)}
    @media(max-width:900px){.today-summary{grid-template-columns:1fr}.summary-state{border-right:0;border-bottom:1px solid var(--r21-border-subtle)}}
    @media(max-width:620px){.summary-metric{min-height:94px;padding:15px}.summary-metric strong{font-size:27px}.metric-icon,.summary-metric small{display:none}}
  `],
})
export class DailySummaryComponent {
  readonly resumen=input.required<ResumenHoy>();
  readonly jornadaActiva=input.required<boolean>();
  readonly modoMes=input(false);
}
