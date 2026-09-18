import { Component, input, output } from '@angular/core';

/** Envoltorio de diálogo modal institucional (sin JS de Bootstrap). */
@Component({
  selector: 'app-modal',
  template: `
    @if (visible()) {
      <div class="r21-modal-backdrop" (click)="cerrar.emit()"></div>
      <div class="r21-modal-wrap" role="dialog" aria-modal="true">
        <div class="r21-modal" (click)="$event.stopPropagation()">
          <div class="r21-modal-header">
            <h3>{{ titulo() }}</h3>
            <button type="button" class="btn-close" aria-label="Cerrar" (click)="cerrar.emit()"></button>
          </div>
          <div class="r21-modal-body">
            <ng-content />
          </div>
          <div class="r21-modal-footer">
            <ng-content select="[acciones]" />
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  readonly titulo = input.required<string>();
  readonly visible = input(false);
  readonly cerrar = output<void>();
}
