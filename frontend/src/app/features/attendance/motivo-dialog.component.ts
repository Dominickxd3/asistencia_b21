import { Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-motivo-dialog',
  imports: [FormsModule],
  template: `
    @if (visible()) { <div class="dialog-backdrop" (click)="cancelar.emit()"></div><section class="dialog-panel" role="dialog" aria-modal="true">
      <header><h2>{{ titulo() }}</h2><button type="button" (click)="cancelar.emit()" aria-label="Cerrar">×</button></header>
      <div class="r21-dialog-content">
        <!-- Nombre de la persona destacada -->
        <div class="target-person-box">
          <i class="pi pi-user text-muted"></i>
          <span class="target-name">{{ persona() }}</span>
        </div>

        <div class="input-field-group">
          <label class="field-label" for="motivo-text">{{ etiqueta() }}</label>
          <textarea
            id="motivo-text"
            class="w-100"
            rows="3"
            maxlength="500"
            [placeholder]="placeholderTexto()"
            [(ngModel)]="texto"
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
            [class]="destructivo() ? 'dialog-button danger' : 'dialog-button primary'"
            [disabled]="procesando() || texto.trim().length < 3"
            (click)="confirmar()"
          >{{ procesando() ? 'Guardando…' : textoBoton() }}</button>
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

    .input-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .field-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--r21-text-secondary);
      }

      textarea {
        resize: vertical;
        font-family: inherit;
        font-size: 13px;
        line-height: 1.4;
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
    .dialog-backdrop{position:fixed;inset:0;z-index:1200;background:#0f172a52}.dialog-panel{position:fixed;z-index:1201;top:50%;left:50%;width:min(460px,calc(100vw - 32px));transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 24px 60px #0f172a3d;padding:20px}.dialog-panel>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.dialog-panel h2{margin:0;font-size:18px}.dialog-panel>header button{border:0;background:transparent;font-size:24px}.dialog-panel footer{margin-top:18px}.dialog-button{min-height:38px;border:0;border-radius:8px;padding:0 15px;font-weight:700}.dialog-button.secondary{background:#f2f4f7;color:#344054}.dialog-button.primary{background:#087443;color:#fff}.dialog-button.danger{background:#b42318;color:#fff}textarea{width:100%;border:1px solid #d0d5dd;border-radius:8px;padding:10px}
  `]
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
    effect(() => {
      if (this.visible()) {
        this.texto = '';
      }
    });
  }

  placeholderTexto(): string {
    const t = this.titulo().toLowerCase();
    if (t.includes('falta')) return 'Indica el motivo justificado de inasistencia…';
    if (t.includes('salida')) return 'Indica el motivo de salida anticipada de cuartel…';
    if (t.includes('anular')) return 'Motivo reglamentario por el cual se anula la marca…';
    return 'Escribe la observación aquí…';
  }

  onVisibleChange(val: boolean): void {
    if (!val) this.cancelar.emit();
  }

  confirmar(): void {
    if (this.texto.trim().length < 3) return;
    this.confirmado.emit(this.texto.trim());
  }
}
