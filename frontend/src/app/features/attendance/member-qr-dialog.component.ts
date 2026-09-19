import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { PizarraItem } from './attendance.models';
import QRCode from 'qrcode';

@Component({
  selector: 'app-member-qr-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      [visible]="visible()"
      [modal]="true"
      [closable]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '440px' }"
      styleClass="r21-member-qr-dialog"
    >
      <ng-template pTemplate="header">
        <div class="modal-header-wrap">
          <div class="modal-title-box">
            <span class="badge-eyebrow">Credencial de Asistencia</span>
            <h3>Carnet Digital con QR</h3>
          </div>
          <button type="button" class="btn-close-modal" (click)="cerrar.emit()">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      @if (item(); as m) {
        <div class="modal-content-wrap">
          <!-- TARJETA FOTOCHECK / CARNET -->
          <div #carnetCard class="fotocheck-card">
            <div class="card-top-stripe">
              <div class="stripe-content">
                <span class="stripe-title">BOMBEROS RÍMAC N° 21</span>
                <span class="stripe-subtitle">CGBVP · XXIV Comandancia Departamental Lima Sur</span>
              </div>
            </div>

            <div class="card-body">
              <div class="member-avatar-wrap">
                <div class="member-avatar-circle">
                  {{ iniciales() }}
                </div>
              </div>

              <h4 class="card-member-name">{{ m.nombreCompleto }}</h4>

              <div class="card-group-pill">
                {{ nombreGrupo() || 'Instrucción Rímac 21' }}
              </div>

              <div class="card-meta-line">
                @if (m.dni) {
                  <span><strong>DNI:</strong> {{ m.dni }}</span>
                  <span class="dot">·</span>
                }
                <span><strong>ID:</strong> #{{ m.personaId }}</span>
              </div>

              <!-- CONTENEDOR DEL CÓDIGO QR -->
              <div class="qr-image-container">
                @if (qrDataUrl()) {
                  <img [src]="qrDataUrl()" alt="Código QR de Asistencia" class="qr-code-img" />
                } @else {
                  <div class="qr-loading">
                    <i class="pi pi-spin pi-spinner"></i>
                    <span>Generando QR…</span>
                  </div>
                }
              </div>

              <p class="qr-instruction">
                Acerque este código al escáner en el pórtico para registrar entrada y salida.
              </p>
            </div>

            <div class="card-bottom-footer">
              <span>SISTEMA DE ASISTENCIA RÍMAC 21</span>
              <span>CÓDIGO: {{ codigoQrValor() }}</span>
            </div>
          </div>

          <!-- BOTONES DE ACCIÓN RÁPIDA -->
          <div class="modal-actions-row">
            <button type="button" class="btn-action-primary" (click)="descargarCarnet()">
              <i class="pi pi-download"></i>
              <span>Descargar Carnet</span>
            </button>
            <button type="button" class="btn-action-whatsapp" (click)="compartirWhatsApp()">
              <i class="pi pi-whatsapp"></i>
              <span>Enviar por WhatsApp</span>
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

    ::ng-deep .r21-member-qr-dialog .p-dialog-header {
      background: #0F172A;
      color: #FFFFFF;
      padding: 16px 20px;
      border-bottom: 1px solid #1E293B;
    }

    ::ng-deep .r21-member-qr-dialog .p-dialog-content {
      padding: 20px;
      background: #F8FAFC;
    }

    .modal-header-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .modal-title-box {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .badge-eyebrow {
        font-size: 11px;
        font-weight: 750;
        color: #C8102E;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 750;
        color: #F8FAFC;
      }
    }

    .btn-close-modal {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #1E293B;
      color: #94A3B8;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s ease;

      &:hover {
        background: #334155;
        color: #FFFFFF;
      }
    }

    .modal-content-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    /* CARNET / FOTOCHECK */
    .fotocheck-card {
      width: 100%;
      max-width: 330px;
      background: #FFFFFF;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06);
      border: 1px solid #E2E8F0;
      display: flex;
      flex-direction: column;
      text-align: center;
    }

    .card-top-stripe {
      background: linear-gradient(135deg, #C8102E 0%, #991B1B 100%);
      color: #FFFFFF;
      padding: 12px 14px;
      border-bottom: 3px solid #F59E0B;
    }

    .stripe-content {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .stripe-title {
        font-size: 13px;
        font-weight: 850;
        letter-spacing: 0.06em;
      }

      .stripe-subtitle {
        font-size: 9.5px;
        font-weight: 600;
        opacity: 0.9;
        letter-spacing: 0.02em;
      }
    }

    .card-body {
      padding: 16px 18px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .member-avatar-wrap {
      margin-top: -6px;
      margin-bottom: 8px;
    }

    .member-avatar-circle {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #EFF6FF;
      color: #1D4ED8;
      border: 2px solid #BFDBFE;
      font-size: 18px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(29, 78, 216, 0.15);
    }

    .card-member-name {
      margin: 0 0 6px;
      font-size: 16px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.25;
    }

    .card-group-pill {
      display: inline-block;
      padding: 3px 10px;
      background: #F1F5F9;
      color: #334155;
      border-radius: 99px;
      font-size: 11.5px;
      font-weight: 700;
      margin-bottom: 8px;
      border: 1px solid #E2E8F0;
    }

    .card-meta-line {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #64748B;
      margin-bottom: 12px;

      .dot {
        color: #CBD5E1;
      }

      strong {
        color: #334155;
      }
    }

    .qr-image-container {
      width: 190px;
      height: 190px;
      background: #FFFFFF;
      padding: 8px;
      border: 1.5px solid #E2E8F0;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      margin-bottom: 10px;

      .qr-code-img {
        width: 100%;
        height: 100%;
        display: block;
      }

      .qr-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #64748B;
        font-size: 12px;
      }
    }

    .qr-instruction {
      margin: 0;
      font-size: 11px;
      color: #64748B;
      line-height: 1.35;
      max-width: 250px;
    }

    .card-bottom-footer {
      background: #F8FAFC;
      border-top: 1px solid #F1F5F9;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 9px;
      font-weight: 700;
      color: #94A3B8;
      letter-spacing: 0.03em;
    }

    /* BOTONES DE ACCIÓN */
    .modal-actions-row {
      display: flex;
      gap: 10px;
      width: 100%;
      max-width: 330px;
    }

    .btn-action-primary, .btn-action-whatsapp {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 38px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: 0;
      transition: all 0.15s ease;

      i {
        font-size: 14px;
      }
    }

    .btn-action-primary {
      background: #087443;
      color: #FFFFFF;

      &:hover {
        background: #065F36;
      }
    }

    .btn-action-whatsapp {
      background: #25D366;
      color: #FFFFFF;

      &:hover {
        background: #1EBE5B;
      }
    }
  `],
})
export class MemberQrDialogComponent {
  readonly visible = input<boolean>(false);
  readonly item = input<PizarraItem | null>(null);
  readonly nombreGrupo = input<string>('');
  readonly cerrar = output<void>();

  @ViewChild('carnetCard') carnetCardRef?: ElementRef<HTMLDivElement>;

  readonly qrDataUrl = signal<string>('');

  readonly codigoQrValor = computed(() => {
    const m = this.item();
    if (!m) return '';
    return m.dni ? m.dni.trim() : String(m.personaId);
  });

  readonly iniciales = computed(() => {
    const m = this.item();
    if (!m?.nombreCompleto) return '—';
    const partes = m.nombreCompleto.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
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
        width: 320,
        margin: 1,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      this.qrDataUrl.set(dataUrl);
    } catch {
      this.qrDataUrl.set('');
    }
  }

  descargarCarnet(): void {
    const dataUrl = this.qrDataUrl();
    if (!dataUrl) return;
    const m = this.item();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${m?.nombreCompleto?.replace(/\s+/g, '_') ?? 'integrante'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  compartirWhatsApp(): void {
    const m = this.item();
    if (!m) return;
    const codigo = this.codigoQrValor();
    const mensaje = encodeURIComponent(
      `¡Hola ${m.nombreCompleto}! 👋\n` +
      `Te compartimos tu código de asistencia para las formaciones en la Compañía de Bomberos Rímac N° 21.\n\n` +
      `📌 Código / DNI: ${codigo}\n` +
      `Grupo: ${this.nombreGrupo() || 'Instrucción B-21'}\n\n` +
      `Presenta este código al ingresar y salir del cuartel.`
    );
    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
  }
}
