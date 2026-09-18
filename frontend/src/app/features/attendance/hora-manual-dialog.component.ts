import { Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HoraManualResult } from './attendance.models';

@Component({
  selector: 'app-hora-manual-dialog',
  imports: [FormsModule],
  template: `
    @if (visible()) { <div class="dialog-backdrop" (click)="cancelar.emit()"></div><section class="dialog-panel" role="dialog" aria-modal="true">
      <header><h2>{{ titulo() }}</h2><button type="button" (click)="cancelar.emit()" aria-label="Cerrar">×</button></header>
      <div class="r21-dialog-content">
        <!-- Persona objetivo -->
        <div class="target-person-box">
          <i class="pi pi-user text-muted"></i>
          <span class="target-name">{{ persona() }}</span>
        </div>

        @if (modoAjuste()) {
          <div class="times-grid">
            <div class="input-field-group">
              <label class="field-label" for="hora-in">Hora de entrada</label>
              <input
                id="hora-in"
                type="time"
                class="w-100"
                [(ngModel)]="horaEntrada"
              />
            </div>
            <div class="input-field-group">
              <label class="field-label" for="hora-out">Hora de salida</label>
              <input
                id="hora-out"
                type="time"
                class="w-100"
                [(ngModel)]="horaSalida"
              />
            </div>
          </div>
        } @else {
          <div class="input-field-group">
            <label class="field-label" for="hora-in-single">Hora de entrada *</label>
            <input
              id="hora-in-single"
              type="time"
              class="w-100"
              [(ngModel)]="horaEntrada"
            />
          </div>
        }

        <div class="input-field-group">
          <label class="field-label" for="hora-motivo">Motivo reglamentario *</label>
          <textarea
            id="hora-motivo"
            class="w-100"
            rows="2"
            maxlength="500"
            placeholder="Ej.: Efectivo llegó al cuartel a las 19:10 por retén..."
            [(ngModel)]="motivo"
          ></textarea>
        </div>

        @if (error()) {
          <div class="field-error-msg">
            <i class="pi pi-exclamation-circle"></i>
            <span>{{ error() }}</span>
          </div>
        }
      </div>

      <footer>
        <div class="dialog-actions-row">
          <button
            type="button"
            class="dialog-button secondary"
            (click)="cancelar.emit()"
            [disabled]="procesando()"
          >Cancelar</button>
          <button
            type="button"
            class="dialog-button primary"
            [disabled]="procesando() || !formularioValido()"
            (click)="confirmar()"
          >{{ procesando() ? 'Guardando…' : 'Registrar' }}</button>
        </div>
      </footer>
    </section> }
  `,
  styles: [`
    .r21-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding-top: 6px;
    }

    .target-person-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background-color: #F8F9FA;
      border: 1px solid var(--r21-border-subtle);
      border-radius: var(--r21-radius-sm);

      .target-name {
        font-size: 13.5px;
        font-weight: 700;
        color: var(--r21-text-primary);
      }
    }

    .times-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .input-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .field-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--r21-text-secondary);
      }
    }

    .field-error-msg {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--r21-red);
      font-size: 12px;
    }

    .dialog-actions-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .dialog-backdrop{position:fixed;inset:0;z-index:1200;background:#0f172a52}.dialog-panel{position:fixed;z-index:1201;top:50%;left:50%;width:min(460px,calc(100vw - 32px));transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 24px 60px #0f172a3d;padding:20px}.dialog-panel>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.dialog-panel h2{margin:0;font-size:18px}.dialog-panel>header button{border:0;background:transparent;font-size:24px}.dialog-panel footer{margin-top:18px}.dialog-button{min-height:38px;border:0;border-radius:8px;padding:0 15px;font-weight:700}.dialog-button.secondary{background:#f2f4f7;color:#344054}.dialog-button.primary{background:#bd1233;color:#fff}input,textarea{width:100%;border:1px solid #d0d5dd;border-radius:8px;padding:9px;font:inherit}
  `]
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

  onVisibleChange(val: boolean): void {
    if (!val) this.cancelar.emit();
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
