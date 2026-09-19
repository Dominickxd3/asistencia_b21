import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PizarraItem } from './attendance.models';
import QRCode from 'qrcode';

@Component({
  selector: 'app-group-qr-print-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, InputTextModule],
  template: `
    <p-dialog
      [visible]="visible()"
      [modal]="true"
      [closable]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '900px', height: '88vh' }"
      styleClass="clean-group-qr-dialog"
    >
      <ng-template pTemplate="header">
        <div class="dialog-header">
          <div class="header-titles">
            <h3>Códigos QR del Grupo</h3>
            <span class="count-sub">{{ integrantesFiltrados().length }} de {{ integrantes().length }} aspirantes</span>
          </div>

          <div class="header-actions">
            <button
              type="button"
              class="btn-print"
              (click)="imprimir()"
              [disabled]="generando()"
            >
              <i class="pi pi-print"></i>
              <span>Imprimir</span>
            </button>
            <button type="button" class="btn-close" (click)="cerrar.emit()" aria-label="Cerrar">
              <i class="pi pi-times"></i>
            </button>
          </div>
        </div>
      </ng-template>

      <!-- BARRA DE BÚSQUEDA RÁPIDA -->
      <div class="filter-strip no-print">
        <input
          type="text"
          pInputText
          placeholder="Buscar por nombre o DNI…"
          [ngModel]="filtro()"
          (ngModelChange)="filtro.set($event)"
          class="search-input"
        />
      </div>

      <!-- LISTA / GRILLA LIMPIA DE QRs -->
      <div class="scroll-container">
        @if (generando()) {
          <div class="loading-state">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Generando códigos QR…</span>
          </div>
        } @else if (integrantesFiltrados().length === 0) {
          <div class="empty-state">
            <span>No se encontraron aspirantes.</span>
          </div>
        } @else {
          <div class="qr-print-grid">
            @for (item of integrantesFiltrados(); track item.personaId) {
              <div class="qr-card">
                <div class="qr-image-wrap">
                  @if (qrMap().get(item.personaId); as qrUrl) {
                    <img [src]="qrUrl" [alt]="'QR ' + item.nombreCompleto" class="qr-img" />
                  }
                </div>
                <div class="qr-details">
                  <h4 class="member-name">{{ item.nombreCompleto }}</h4>
                  <div class="member-meta">
                    @if (item.dni) {
                      <span>DNI: {{ item.dni }}</span>
                    } @else {
                      <span>ID: #{{ item.personaId }}</span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
    }

    ::ng-deep .clean-group-qr-dialog .p-dialog-header {
      padding: 16px 20px;
      border-bottom: 1px solid #E5E7EB;
      background: #FFFFFF;
    }

    ::ng-deep .clean-group-qr-dialog .p-dialog-content {
      padding: 0;
      background: #F9FAFB;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;

      .header-titles {
        display: flex;
        align-items: baseline;
        gap: 10px;

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }

        .count-sub {
          font-size: 12px;
          color: #6B7280;
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-print {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 34px;
        padding: 0 14px;
        background: #111827;
        color: #FFFFFF;
        border: 1px solid #111827;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;

        &:hover:not(:disabled) {
          background: #1F2937;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .btn-close {
        background: transparent;
        border: 0;
        color: #6B7280;
        font-size: 15px;
        cursor: pointer;
        padding: 6px;
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

    .filter-strip {
      padding: 10px 20px;
      background: #FFFFFF;
      border-bottom: 1px solid #E5E7EB;

      .search-input {
        width: 260px;
        height: 34px;
        font-size: 13px;
        border: 1px solid #D1D5DB;
        border-radius: 6px;
        padding: 0 10px;

        &:focus {
          border-color: #111827;
        }
      }
    }

    .scroll-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 60px 20px;
      color: #6B7280;
      font-size: 13px;
    }

    /* GRILLA LIMPIA DE QRs */
    .qr-print-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .qr-card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .qr-image-wrap {
      width: 140px;
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;

      .qr-img {
        width: 100%;
        height: 100%;
        image-rendering: pixelated;
        display: block;
      }
    }

    .qr-details {
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 100%;

      .member-name {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: #111827;
        line-height: 1.25;
        white-space: normal;
      }

      .member-meta {
        font-size: 12px;
        color: #6B7280;
        font-weight: 500;
      }
    }

    /* ESTILOS DE IMPRESIÓN */
    @media print {
      body * {
        visibility: hidden !important;
      }

      .qr-print-grid,
      .qr-print-grid * {
        visibility: visible !important;
      }

      .no-print,
      .p-dialog-header,
      .filter-strip {
        display: none !important;
      }

      .scroll-container {
        padding: 0 !important;
        overflow: visible !important;
      }

      .qr-print-grid {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 12mm !important;
        padding: 10mm !important;
      }

      .qr-card {
        border: 1px solid #D1D5DB !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  `],
})
export class GroupQrPrintDialogComponent {
  readonly visible = input<boolean>(false);
  readonly integrantes = input<PizarraItem[]>([]);
  readonly nombreGrupo = input<string>('');
  readonly fechaJornada = input<string>('');
  readonly cerrar = output<void>();

  readonly filtro = signal<string>('');
  readonly generando = signal<boolean>(false);
  readonly qrMap = signal<Map<number, string>>(new Map());

  readonly integrantesFiltrados = computed(() => {
    const list = this.integrantes();
    const query = this.filtro().trim().toLowerCase();
    if (!query) return list;

    return list.filter((m) => {
      const nom = (m.nombreCompleto || '').toLowerCase();
      const dni = (m.dni || '').toLowerCase();
      const id = String(m.personaId);
      return nom.includes(query) || dni.includes(query) || id.includes(query);
    });
  });

  constructor() {
    effect(() => {
      const vis = this.visible();
      const list = this.integrantes();
      if (vis && list.length > 0) {
        void this.generarTodosLosQr(list);
      }
    });
  }

  private async generarTodosLosQr(items: PizarraItem[]): Promise<void> {
    this.generando.set(true);
    const mapa = new Map<number, string>();

    try {
      const promesas = items.map(async (item) => {
        const codigo = item.dni && item.dni.trim() ? item.dni.trim() : String(item.personaId);
        const dataUrl = await QRCode.toDataURL(codigo, {
          width: 220,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H',
        });
        mapa.set(item.personaId, dataUrl);
      });

      await Promise.all(promesas);
      this.qrMap.set(mapa);
    } catch (err) {
      console.error('Error generando QRs:', err);
    } finally {
      this.generando.set(false);
    }
  }

  imprimir(): void {
    window.print();
  }
}
