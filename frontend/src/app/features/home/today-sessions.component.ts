import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { JornadaHoy } from '../../core/models/api.models';

interface JornadaSlot {
  id: string;
  nombre: string;
  jornada: JornadaHoy | null;
}

@Component({
  selector: 'app-today-sessions',
  imports: [RouterLink, TuiButton, TuiIcon],
  template: `
    <section class="sessions-section" aria-labelledby="sessions-title">
      <h2 id="sessions-title">{{ modoMes() ? 'Jornadas del periodo' : 'Jornadas del día' }}</h2>
      <div class="sessions-list">
        @for (slot of slots(); track slot.id) {
          <article class="session-row">
            <div class="session-main">
              <strong>{{ slot.jornada?.grupo || slot.nombre }}</strong>
              <span class="schedule"><tui-icon icon="@tui.calendar-clock" /> Programado: {{ slot.jornada?.horario || 'Sin horario' }}</span>
              @if (!modoMes() && slot.jornada) {
                <span class="real-time" [class.no-records]="!slot.jornada.primeraEntrada">
                  <tui-icon icon="@tui.scan-line" />
                  @if (slot.jornada.primeraEntrada) { Real: {{ slot.jornada.primeraEntrada }} → {{ slot.jornada.ultimaSalida || 'en curso' }} }
                  @else { Aún sin marcaciones }
                </span>
              }
            </div>

            <div class="session-status">
              <span class="status" [class.active]="slot.jornada?.estado === 'ABIERTA'">
                <i></i>{{ estado(slot.jornada) }}
              </span>
            </div>

            <div class="session-counts">
              @if (slot.jornada?.estado === 'ABIERTA' || slot.jornada?.estado === 'RESUMEN') {
                <strong>{{ slot.jornada!.presentes }} / {{ slot.jornada!.integrantes }}</strong>
                <span>{{ modoMes() ? 'asistencias' : 'presentes' }}</span>
              } @else {
                <strong>—</strong>
                <span>presentes</span>
              }
            </div>

            <div class="session-counts pending">
              <strong>{{ slot.jornada?.pendientes ?? 0 }}</strong>
              <span>{{ (slot.jornada?.pendientes ?? 0) === 1 ? 'pendiente' : 'pendientes' }}</span>
            </div>

            <div class="session-owner">
              <span>Encargado</span>
              <strong>{{ slot.jornada?.encargado || 'Sin asignar' }}</strong>
            </div>

            <a tuiButton appearance="flat" size="s" routerLink="/asistencia" class="session-action">
              Ver asistencia <tui-icon icon="@tui.arrow-right" />
            </a>
          </article>
        }
      </div>
    </section>
  `,
  styles: [`
    .sessions-section { display: flex; flex-direction: column; gap: 12px; }
    h2 { margin: 0; color: var(--r21-text-primary); font-size: 17px; font-weight: 680; }
    .sessions-list { overflow: hidden; background: var(--r21-surface); border: 1px solid var(--r21-border); border-radius: var(--r21-radius-md); box-shadow: var(--r21-shadow-sm); }
    .session-row { display: grid; grid-template-columns: minmax(200px, 1.5fr) 110px 88px 88px minmax(140px, 1fr) auto; align-items: center; gap: 16px; min-height: 92px; padding: 14px 18px; }
    .session-row + .session-row { border-top: 1px solid var(--r21-border-subtle); }
    .session-main, .session-owner, .session-counts { display: flex; flex-direction: column; min-width: 0; gap: 4px; }
    .session-main strong { overflow: hidden; color: var(--r21-text-primary); font-size: 13.5px; text-overflow: ellipsis; white-space: nowrap; }
    .schedule,.real-time { display:flex;align-items:center;gap:5px;color:var(--r21-text-muted);font-size:10.5px }.schedule tui-icon,.real-time tui-icon{font-size:13px}.real-time{color:var(--r21-green);font-weight:700}.real-time.no-records{color:var(--r21-text-muted);font-weight:500}.session-owner span, .session-counts span { color: var(--r21-text-muted); font-size: 10.5px; }
    .status { display: inline-flex; align-items: center; gap: 7px; color: var(--r21-text-secondary); font-size: 11.5px; font-weight: 600; }
    .status i { width: 7px; height: 7px; border-radius: 50%; background: #98a2b3; }
    .status.active { color: var(--r21-green); }
    .status.active i { background: var(--r21-green); }
    .session-counts strong { color: var(--r21-text-primary); font-size: 14px; font-variant-numeric: tabular-nums; }
    .session-counts.pending strong { color: var(--r21-amber); }
    .session-owner strong { overflow: hidden; color: var(--r21-text-primary); font-size: 11.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .session-action { color: var(--r21-red) !important; text-decoration: none; white-space: nowrap; }
    @media (max-width: 1100px) { .session-row { grid-template-columns: minmax(180px, 1fr) 100px 80px 80px; } .session-owner { grid-column: 1 / 4; } .session-action { grid-column: 4; grid-row: 2; justify-self: end; } }
    @media (max-width: 620px) { .session-row { grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; } .session-main { grid-column: 1 / -1; } .session-owner { grid-column: 1; } .session-action { grid-column: 2; grid-row: auto; justify-self: end; } }
  `],
})
export class TodaySessionsComponent {
  readonly jornadas = input.required<JornadaHoy[]>();
  readonly modoMes = input(false);

  readonly slots = computed<JornadaSlot[]>(() => {
    const jornadas = this.jornadas();
    const texto = (jornada: JornadaHoy) => `${jornada.grupo} ${jornada.etapa}`.toUpperCase();
    const postulantes = jornadas.find((j) => texto(j).includes('POSTULANTE')) ?? null;
    const esbas = jornadas.find((j) => texto(j).includes('ESBAS')) ?? null;
    const compania = jornadas.find((j) => {
      const valor = texto(j);
      return !valor.includes('POSTULANTE') && !valor.includes('ESBAS') &&
        (valor.includes('COMPAÑ') || valor.includes('COMPAN') || valor.includes('ASPIRANTE'));
    }) ?? null;
    return [
      { id: 'postulantes', nombre: 'Postulantes', jornada: postulantes },
      { id: 'compania', nombre: 'Aspirantes de compañía', jornada: compania },
      { id: 'esbas', nombre: 'Aspirantes ESBAS', jornada: esbas },
    ];
  });

  estado(jornada: JornadaHoy | null): string {
    if (!jornada) return 'Sin jornada';
    if (jornada.estado === 'RESUMEN') return 'Resumen mensual';
    if (jornada.estado === 'ABIERTA') return 'En curso';
    if (jornada.estado === 'CERRADA' || jornada.estado === 'FINALIZADO') return 'Finalizada';
    if (jornada.estado === 'CANCELADA') return 'Cancelada';
    return 'Programada';
  }
}
