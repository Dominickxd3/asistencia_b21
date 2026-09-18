import { Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/components/modal.component';

export interface HoraManualResult {
  horaEntrada?: string;
  horaSalida?: string;
  motivo: string;
}

/** Diálogo de registro/ajuste con hora manual (requiere motivo). */
@Component({
  selector: 'app-hora-manual-dialog',
  imports: [ModalComponent, FormsModule],
  template: `
    <app-modal [titulo]="titulo()" [visible]="visible()" (cerrar)="cancelar.emit()">
      <p class="mb-2">
        <strong>{{ persona() }}</strong>
      </p>
      @if (modoAjuste()) {
        <div class="row g-2">
          <div class="col-6">
            <label class="form-label small fw-semibold">Hora de entrada</label>
            <input type="time" class="form-control" [(ngModel)]="horaEntrada" />
          </div>
          <div class="col-6">
            <label class="form-label small fw-semibold">Hora de salida</label>
            <input type="time" class="form-control" [(ngModel)]="horaSalida" />
          </div>
        </div>
      } @else {
        <label class="form-label small fw-semibold">Hora de entrada</label>
        <input type="time" class="form-control" [(ngModel)]="horaEntrada" />
      }
      <label class="form-label small fw-semibold mt-3">Motivo (obligatorio)</label>
      <textarea
        class="form-control"
        rows="2"
        maxlength="500"
        [(ngModel)]="motivo"
        placeholder="Ej.: llegó con el bus de las 19:10 y no se registró"
      ></textarea>
      @if (error()) {
        <div class="text-danger small mt-2">{{ error() }}</div>
      }

      <ng-container acciones>
        <button type="button" class="btn btn-sm btn-r21-outline" (click)="cancelar.emit()">Cancelar</button>
        <button
          type="button"
          class="btn btn-sm btn-r21"
          [disabled]="procesando() || !formularioValido()"
          (click)="confirmar()"
        >
          {{ procesando() ? 'Procesando…' : 'Registrar' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class HoraManualDialogComponent {
  readonly visible = input(false);
  readonly titulo = input('Hora manual');
  readonly modoAjuste = input(false);
  readonly persona = input('');
  readonly procesando = input(false);
  readonly error = input<string | null>(null);

  readonly confirmado = output<HoraManualResult>();
  readonly cancelar = output<void>();

  horaEntrada = '';
  horaSalida = '';
  motivo = '';

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.horaEntrada = '';
        this.horaSalida = '';
        this.motivo = '';
      }
    });
  }

  formularioValido(): boolean {
    const conHora = this.modoAjuste() ? !!(this.horaEntrada || this.horaSalida) : !!this.horaEntrada;
    return conHora && this.motivo.trim().length >= 3;
  }

  confirmar(): void {
    if (!this.formularioValido()) return;
    this.confirmado.emit({
      horaEntrada: this.horaEntrada || undefined,
      horaSalida: this.horaSalida || undefined,
      motivo: this.motivo.trim(),
    });
  }
}
