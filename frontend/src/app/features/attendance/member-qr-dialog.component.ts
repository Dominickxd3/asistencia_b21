import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { PizarraItem } from './attendance.models';
import QRCode from 'qrcode';

@Component({
  selector: 'app-member-qr-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule],
  template: `
    <p-dialog
      [visible]="visible()"
      [modal]="true"
      [closable]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '90vw', maxWidth: '380px' }"
      styleClass="clean-qr-dialog"
    >
      <ng-template pTemplate="header">
        <div class="dialog-header">
          <h3>Código QR</h3>
          <button type="button" class="btn-close" (click)="cerrar.emit()" aria-label="Cerrar">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      @if (item(); as m) {
        <div class="qr-content-body">
          <div class="member-meta">
            <h4 class="member-name">{{ m.nombreCompleto }}</h4>
            <div class="member-info">
              @if (m.dni) {
                <span><strong>DNI:</strong> {{ m.dni }}</span>
              } @else {
                <span><strong>ID:</strong> {{ m.personaId }}</span>
              }
              @if (nombreGrupo()) {
                <span class="dot">·</span>
                <span>{{ nombreGrupo() }}</span>
              }
            </div>
          </div>

          <div class="qr-box">
            @if (qrDataUrl()) {
              <img [src]="qrDataUrl()" [alt]="'QR de ' + m.nombreCompleto" class="qr-image" />
            } @else {
              <div class="qr-loading">
                <i class="pi pi-spin pi-spinner"></i>
                <span>Generando QR…</span>
              </div>
            }
          </div>

          <span class="qr-code-label">Código: {{ codigoQrValor() }}</span>

          <div class="actions-row">
            <button type="button" class="btn-download" (click)="descargarQr()">
              <i class="pi pi-download"></i>
              <span>Descargar QR</span>
            </button>
            <button type="button" class="btn-secondary" (click)="cerrar.emit()">
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      }
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
    }

    ::ng-deep .clean-qr-dialog .p-dialog-header {
      padding: 16px 20px 12px;
      border-bottom: 1px solid #E5E7EB;
      background: #FFFFFF;
    }

    ::ng-deep .clean-qr-dialog .p-dialog-content {
      padding: 20px;
      background: #FFFFFF;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #111827;
      }

      .btn-close {
        background: transparent;
        border: 0;
        color: #6B7280;
        font-size: 15px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          color: #111827;
          background: #F3F4F6;
        }
      }
    }

    .qr-content-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 16px;
    }

    .member-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .member-name {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #111827;
      }

      .member-info {
        font-size: 13px;
        color: #6B7280;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;

        strong {
          color: #374151;
        }

        .dot {
          color: #D1D5DB;
        }
      }
    }

    .qr-box {
      width: 240px;
      height: 240px;
      padding: 12px;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;

      .qr-image {
        width: 100%;
        height: 100%;
        image-rendering: pixelated;
        display: block;
      }

      .qr-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #9CA3AF;
        font-size: 13px;

        i {
          font-size: 20px;
        }
      }
    }

    .qr-code-label {
      font-size: 12px;
      font-weight: 600;
      color: #6B7280;
      font-family: monospace;
    }

    .actions-row {
      display: flex;
      gap: 10px;
      width: 100%;
      margin-top: 4px;

      button {
        flex: 1;
        height: 38px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background 0.15s ease;
      }

      .btn-download {
        background: #111827;
        color: #FFFFFF;
        border: 1px solid #111827;

        &:hover {
          background: #1F2937;
        }
      }

      .btn-secondary {
        background: #F3F4F6;
        color: #374151;
        border: 1px solid #D1D5DB;

        &:hover {
          background: #E5E7EB;
        }
      }
    }
  `],
})
export class MemberQrDialogComponent {
  readonly visible = input<boolean>(false);
  readonly item = input<PizarraItem | null>(null);
  readonly nombreGrupo = input<string>('');
  readonly cerrar = output<void>();

  readonly qrDataUrl = signal<string>('');

  readonly codigoQrValor = computed(() => {
    const m = this.item();
    if (!m) return '';
    return m.dni ? m.dni.trim() : String(m.personaId);
  });

  constructor() {
    effect(() => {
      const code = this.codigoQrValor();
      if (this.visible() && code) {
        void this.generarQr(code);
      } else {
        this.qrDataUrl.set('');
      }
    });
  }

  private async generarQr(text: string): Promise<void> {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 280,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      this.qrDataUrl.set(dataUrl);
    } catch {
      this.qrDataUrl.set('');
    }
  }

  descargarQr(): void {
    const dataUrl = this.qrDataUrl();
    if (!dataUrl) return;
    const m = this.item();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${m?.nombreCompleto?.replace(/\s+/g, '_') ?? 'aspirante'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
