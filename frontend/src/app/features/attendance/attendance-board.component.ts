import { Component, input, output } from '@angular/core';
import { JornadaItem, PizarraItem } from './attendance.models';
import { AttendanceMemberRowComponent, SolicitudAccion } from './member-row.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/** Pizarra completa de una jornada: cabecera + filas de integrantes. */
@Component({
  selector: 'app-attendance-board',
  imports: [AttendanceMemberRowComponent, StatusBadgeComponent, EmptyStateComponent],
  template: `
    <div class="r21-card">
      <div class="r21-card-header">
        <div>
          <h2>{{ jornada().grupo }}</h2>
          <div class="small text-muted">
            {{ jornada().etapa }} · {{ jornada().fecha }} ·
            <app-status-badge [estado]="jornada().tipoJornada" />
            @if (jornada().origen === 'EXTRAORDINARIA') {
              <span class="r21-badge warn">Extraordinaria</span>
            }
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <app-status-badge [estado]="jornada().estado" />
          @if (jornada().estado === 'ABIERTA') {
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cerrar.emit()">
              <i class="bi bi-lock"></i> Cerrar jornada
            </button>
          }
        </div>
      </div>
      <div class="r21-card-body pt-1 pb-1">
        @if (items().length === 0) {
          <app-empty-state mensaje="El grupo no tiene integrantes activos" icono="bi-people" />
        }
        @for (item of items(); track item.personaId) {
          <app-attendance-member-row
            [item]="item"
            [procesando]="procesandoId() === item.personaId"
            [puedeAjustar]="puedeAjustar()"
            [puedeAnular]="puedeAnular()"
            (accion)="accion.emit($event)"
          />
        }
      </div>
    </div>
  `,
})
export class AttendanceBoardComponent {
  readonly jornada = input.required<JornadaItem>();
  readonly items = input.required<PizarraItem[]>();
  readonly procesandoId = input<number | null>(null);
  readonly puedeAjustar = input(false);
  readonly puedeAnular = input(false);
  readonly accion = output<SolicitudAccion>();
  readonly cerrar = output<void>();
}
