import { Component, input, output } from '@angular/core';
import { PendienteItem } from './attendance.models';

@Component({
  selector: 'app-cierre-dialog',
  imports: [],
  template: `
    @if (visible()) { <div class="dialog-backdrop" (click)="cancelar.emit()"></div><section class="dialog-panel" role="dialog" aria-modal="true">
      <header><h2>Cerrar jornada operativa</h2><button type="button" (click)="cancelar.emit()" aria-label="Cerrar">×</button></header>
      <div class="r21-dialog-content">
        @if (pendientes().length > 0) {
          <div class="cierre-warning-banner">
            <i class="pi pi-exclamation-triangle"></i>
            <div class="banner-text">
              <strong>{{ pendientes().length }} efectivo{{ pendientes().length === 1 ? '' : 's' }} sin registro</strong>
              <span>Al cerrar la jornada, pasarán automáticamente a:</span>
            </div>
            <span class="danger-tag">Falta injustificada</span>
          </div>

          <div class="pendientes-list-box">
            <span class="list-label">Efectivos que serán convertidos:</span>
            <ul class="pendientes-names">
              @for (p of pendientes(); track p.personaId) {
                <li>
                  <i class="pi pi-user text-muted"></i>
                  <span>{{ p.nombreCompleto }}</span>
                </li>
              }
            </ul>
          </div>
        } @else {
          <div class="cierre-clean-banner">
            <i class="pi pi-check-circle text-green"></i>
            <div>
              <strong>Nómina completa</strong>
              <p class="mb-0 text-muted small">Todos los integrantes de la jornada cuentan con asistencia registrada.</p>
            </div>
          </div>
        }

        <p class="cierre-notice">
          Esta acción dará por concluida la jornada y no permitirá nuevos registros directos sin permiso de auditoría.
        </p>
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
            class="dialog-button danger"
            [disabled]="procesando()"
            (click)="confirmar.emit()"
          >{{ procesando() ? 'Cerrando…' : pendientes().length > 0 ? 'Convertir y cerrar' : 'Confirmar cierre' }}</button>
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

    .cierre-warning-banner {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      padding: 12px;
      background-color: #FEF3F2;
      border: 1px solid #FECDCA;
      border-radius: var(--r21-radius-sm);

      i {
        font-size: 20px;
        color: var(--r21-red);
      }

      .banner-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 13px;
        color: var(--r21-text-primary);
      }
    }

    .cierre-clean-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      background-color: #ECFDF3;
      border: 1px solid #A6F4C5;
      border-radius: var(--r21-radius-sm);

      i {
        font-size: 22px;
        color: var(--r21-green);
      }
    }

    .pendientes-list-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 140px;
      overflow-y: auto;
      padding: 8px 12px;
      background-color: #F8F9FA;
      border: 1px solid var(--r21-border-subtle);
      border-radius: var(--r21-radius-sm);

      .list-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--r21-text-secondary);
        letter-spacing: 0.04em;
      }

      .pendientes-names {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;

        li {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: var(--r21-text-primary);

          i {
            font-size: 11px;
          }
        }
      }
    }

    .cierre-notice {
      font-size: 12px;
      color: var(--r21-text-muted);
      margin: 0;
      line-height: 1.35;
    }

    .dialog-actions-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .danger-tag{padding:4px 8px;border-radius:99px;background:#fee4e2;color:#b42318;font-size:11px;font-weight:700}.dialog-backdrop{position:fixed;inset:0;z-index:1200;background:#0f172a52}.dialog-panel{position:fixed;z-index:1201;top:50%;left:50%;width:min(460px,calc(100vw - 32px));transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 24px 60px #0f172a3d;padding:20px}.dialog-panel>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.dialog-panel h2{margin:0;font-size:18px}.dialog-panel>header button{border:0;background:transparent;font-size:24px}.dialog-panel footer{margin-top:18px}.dialog-button{min-height:38px;border:0;border-radius:8px;padding:0 15px;font-weight:700}.dialog-button.secondary{background:#f2f4f7;color:#344054}.dialog-button.danger{background:#b42318;color:#fff}
  `]
})
export class CierreDialogComponent {
  readonly visible = input(false);
  readonly pendientes = input<PendienteItem[]>([]);
  readonly procesando = input(false);
  readonly confirmar = output<void>();
  readonly cancelar = output<void>();

  onVisibleChange(val: boolean): void {
    if (!val) this.cancelar.emit();
  }
}
