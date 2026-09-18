import { Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/components/modal.component';

/** Diálogo de motivo obligatorio (justificada, salida anticipada, observación, anulación). */
@Component({
  selector: 'app-motivo-dialog',
  imports: [ModalComponent, FormsModule],
  template: `
    <app-modal [titulo]="titulo()" [visible]="visible()" (cerrar)="cancelar.emit()">
      <p class="mb-2">
        <strong>{{ persona() }}</strong>
      </p>
      <label class="form-label fw-semibold small">{{ etiqueta() }}</label>
      <textarea
        class="form-control"
        rows="3"
        maxlength="500"
        placeholder="Escribe el motivo…"
        [(ngModel)]="texto"
      ></textarea>
      @if (error()) {
        <div class="text-danger small mt-2">{{ error() }}</div>
      }

      <ng-container acciones>
        <button type="button" class="btn btn-sm btn-r21-outline" (click)="cancelar.emit()">Cancelar</button>
        <button
          type="button"
          class="btn btn-sm"
          [class.btn-danger]="destructivo()"
          [class.btn-r21]="!destructivo()"
          [disabled]="procesando() || texto.trim().length < 3"
          (click)="confirmar()"
        >
          {{ procesando() ? 'Procesando…' : textoBoton() }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class MotivoDialogComponent {
  readonly visible = input(false);
  readonly titulo = input('Motivo');
  readonly etiqueta = input('Motivo');
  readonly textoBoton = input('Confirmar');
  readonly destructivo = input(false);
  readonly persona = input('');
  readonly procesando = input(false);
  readonly error = input<string | null>(null);

  readonly confirmado = output<string>();
  readonly cancelar = output<void>();

  texto = '';

  constructor() {
    // Cada vez que se abre, reinicia el contenido
    effect(() => {
      if (this.visible()) this.texto = '';
    });
  }

  confirmar(): void {
    if (this.texto.trim().length < 3) return;
    this.confirmado.emit(this.texto.trim());
  }
}
