import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../shared/components/modal.component';
import { PendienteItem } from './attendance.models';

/** Cierre de jornada: muestra pendientes que se convertirán en faltas injustificadas. */
@Component({
  selector: 'app-cierre-dialog',
  imports: [ModalComponent],
  template: `
    <app-modal titulo="Cerrar jornada" [visible]="visible()" (cerrar)="cancelar.emit()">
      @if (pendientes().length > 0) {
        <p>
          <strong>{{ pendientes().length }}</strong>
          persona(s) quedaron sin registro. Al cerrar quedarán como
          <span class="r21-badge peligro">Falta injustificada</span>:
        </p>
        <ul class="mb-0 ps-3">
          @for (p of pendientes(); track p.personaId) {
            <li>{{ p.nombreCompleto }}</li>
          }
        </ul>
      } @else {
        <p>Todos los integrantes tienen registro. ¿Confirmas el cierre de la jornada?</p>
      }

      <ng-container acciones>
        <button type="button" class="btn btn-sm btn-r21-outline" (click)="cancelar.emit()">Cancelar</button>
        <button
          type="button"
          class="btn btn-sm btn-r21"
          [disabled]="procesando()"
          (click)="confirmar.emit()"
        >
          {{ procesando() ? 'Cerrando…' : pendientes().length > 0 ? 'Convertir y cerrar' : 'Cerrar jornada' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class CierreDialogComponent {
  readonly visible = input(false);
  readonly pendientes = input<PendienteItem[]>([]);
  readonly procesando = input(false);
  readonly confirmar = output<void>();
  readonly cancelar = output<void>();
}
