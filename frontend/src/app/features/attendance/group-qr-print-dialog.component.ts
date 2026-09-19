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
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PizarraItem } from './attendance.models';
import QRCode from 'qrcode';

@Component({
  selector: 'app-group-qr-print-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, InputTextModule],
  template: `
    <p-dialog
      [visible]="visible()"
      [modal]="true"
      [closable]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '95vw', maxWidth: '1050px', height: '90vh' }"
      styleClass="r21-group-qr-dialog"
    >
      <ng-template pTemplate="header">
        <div class="group-dialog-header">
          <div class="header-titles">
            <span class="badge-eyebrow">Credenciales Grupales</span>
            <div class="title-with-count">
              <h3>Carnets con QR del Grupo</h3>
              <span class="count-badge">{{ integrantes().length }} integrantes</span>
            </div>
            <p class="subtitle-text">
              {{ nombreGrupo() || 'Instrucción Rímac 21' }} · Formato optimizado para impresión A4 (8 por hoja)
            </p>
          </div>

          <div class="header-actions">
            <button
              type="button"
              class="btn-print-primary"
              (click)="imprimir()"
              [disabled]="generando()"
            >
              <i class="pi pi-print"></i>
              <span>Imprimir carnets (A4)</span>
            </button>

            <button type="button" class="btn-close-modal" (click)="cerrar.emit()">
              <i class="pi pi-times"></i>
            </button>
          </div>
        </div>
      </ng-template>

      <!-- BARRA DE HERRAMIENTAS / FILTRO -->
      <div class="toolbar-strip no-print">
        <div class="search-box">
          <i class="pi pi-search search-icon"></i>
          <input
            type="text"
            pInputText
            placeholder="Buscar integrante por nombre o DNI…"
            [ngModel]="filtro()"
            (ngModelChange)="filtro.set($event)"
            class="filter-input"
          />
        </div>

        <div class="print-instructions">
          <i class="pi pi-info-circle"></i>
          <span>
            Cada carnet tiene dimensiones de <strong>fotocheck estándar</strong> con líneas de corte para recortar y enmicar o plastificar.
          </span>
        </div>
      </div>

      <!-- ÁREA DE CARNETS IMPRIMIBLES -->
      <div class="preview-scroll-container">
        @if (generando()) {
          <div class="loading-state">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Generando códigos QR de alta resolución…</span>
          </div>
        } @else if (integrantesFiltrados().length === 0) {
          <div class="empty-state">
            <i class="pi pi-users"></i>
            <span>No se encontraron integrantes que coincidan con la búsqueda.</span>
          </div>
        } @else {
          <div class="a4-sheet-container printable-roster-sheet">
            <div class="print-page-header">
              <div class="cgbvp-brand">
                <strong>CUERPO GENERAL DE BOMBEROS VOLUNTARIOS DEL PERÚ</strong>
                <span>Compañía de Bomberos Rímac N° 21 · XXIV Comandancia Departamental Lima Sur</span>
              </div>
              <div class="sheet-meta">
                <span><strong>Grupo:</strong> {{ nombreGrupo() || 'Instrucción B-21' }}</span>
                <span><strong>Total:</strong> {{ integrantesFiltrados().length }} credenciales</span>
              </div>
            </div>

            <div class="cards-grid">
              @for (item of integrantesFiltrados(); track item.personaId) {
                <div class="id-card-wrapper">
                  <div class="id-card">
                    <!-- ENCABEZADO ROJO BOMBEROS -->
                    <div class="card-header-bar">
                      <div class="header-left">
                        <span class="shield-badge">B-21</span>
                        <div class="header-text">
                          <span class="station-name">BOMBEROS RÍMAC N° 21</span>
                          <span class="cgbvp-subtitle">CGBVP · LIMA SUR</span>
                        </div>
                      </div>
                      <span class="tag-credencial">CREDENCIAL</span>
                    </div>

                    <!-- CUERPO PRINCIPAL DEL CARNET -->
                    <div class="card-inner-body">
                      <!-- LADO IZQUIERDO: AVATAR + DATOS -->
                      <div class="card-member-details">
                        <div class="avatar-row">
                          <div class="member-avatar">
                            {{ obtenerIniciales(item.nombreCompleto) }}
                          </div>
                          <div class="member-role-badge">
                            ASPIRANTE
                          </div>
                        </div>

                        <div class="member-name-block">
                          <h4 class="member-name" [title]="item.nombreCompleto">
                            {{ item.nombreCompleto }}
                          </h4>
                          <span class="group-label">
                            {{ nombreGrupo() || 'Instrucción Rímac 21' }}
                          </span>
                        </div>

                        <div class="member-id-badges">
                          @if (item.dni) {
                            <div class="id-badge">
                              <span class="badge-lbl">DNI</span>
                              <span class="badge-val">{{ item.dni }}</span>
                            </div>
                          }
                          <div class="id-badge">
                            <span class="badge-lbl">ID</span>
                            <span class="badge-val">#{{ item.personaId }}</span>
                          </div>
                        </div>
                      </div>

                      <!-- LADO DERECHO: CÓDIGO QR -->
                      <div class="card-qr-section">
                        @if (qrMap().get(item.personaId); as qrUrl) {
                          <div class="qr-frame">
                            <img [src]="qrUrl" [alt]="'QR de ' + item.nombreCompleto" class="qr-img" />
                          </div>
                        } @else {
                          <div class="qr-placeholder">
                            <i class="pi pi-qrcode"></i>
                          </div>
                        }
                        <span class="qr-hint">ESCANEAR PARA ASISTENCIA</span>
                      </div>
                    </div>

                    <!-- PIE INFERIOR -->
                    <div class="card-footer-bar">
                      <span>SISTEMA DE ASISTENCIA OPERATIVA B-21</span>
                      <span>COD: {{ obtenerCodigo(item) }}</span>
                    </div>
                  </div>

                  <!-- LÍNEA DE CORTE GUÍA (TIJERAS) -->
                  <div class="cut-guide">
                    <span class="cut-icon">✂</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
    }

    ::ng-deep .r21-group-qr-dialog .p-dialog-header {
      background: #0F172A;
      color: #FFFFFF;
      padding: 16px 24px;
      border-bottom: 1px solid #1E293B;
    }

    ::ng-deep .r21-group-qr-dialog .p-dialog-content {
      padding: 0;
      background: #F1F5F9;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .group-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .header-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .badge-eyebrow {
        font-size: 11px;
        font-weight: 750;
        color: #EF4444;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .title-with-count {
        display: flex;
        align-items: center;
        gap: 10px;

        h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 750;
          color: #F8FAFC;
        }

        .count-badge {
          background: #334155;
          color: #E2E8F0;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 99px;
        }
      }

      .subtitle-text {
        margin: 2px 0 0;
        font-size: 12px;
        color: #94A3B8;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn-print-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 38px;
      padding: 0 18px;
      background: #087443;
      color: #FFFFFF;
      border: 1px solid #065F36;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(16, 24, 40, 0.1);
      transition: all 0.15s ease;

      i {
        font-size: 15px;
      }

      &:hover:not(:disabled) {
        background: #065F36;
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(8, 116, 67, 0.25);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-close-modal {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #1E293B;
      color: #94A3B8;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.15s ease;

      &:hover {
        background: #334155;
        color: #FFFFFF;
      }
    }

    .toolbar-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 24px;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E8F0;
      flex-wrap: wrap;
    }

    .search-box {
      position: relative;
      width: 320px;
      max-width: 100%;

      .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #94A3B8;
        font-size: 13px;
      }

      .filter-input {
        width: 100%;
        height: 36px;
        padding-left: 34px;
        border-radius: 8px;
        border: 1px solid #CBD5E1;
        font-size: 13px;

        &:focus {
          border-color: #C8102E;
          box-shadow: 0 0 0 2px rgba(200, 16, 46, 0.15);
        }
      }
    }

    .print-instructions {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: #475467;

      i {
        color: #087443;
        font-size: 15px;
      }

      strong {
        color: #101828;
      }
    }

    .preview-scroll-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 60px 20px;
      color: #64748B;
      font-size: 14px;
      font-weight: 600;

      i {
        font-size: 32px;
        color: #94A3B8;
      }
    }

    /* HOJA A4 IMPRIMIBLE */
    .a4-sheet-container {
      width: 100%;
      max-width: 900px;
      background: #FFFFFF;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      border: 1px solid #E2E8F0;
    }

    .print-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      margin-bottom: 20px;
      border-bottom: 2px solid #0F172A;

      .cgbvp-brand {
        display: flex;
        flex-direction: column;

        strong {
          font-size: 13px;
          color: #0F172A;
          letter-spacing: 0.04em;
        }

        span {
          font-size: 11px;
          color: #475467;
        }
      }

      .sheet-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        font-size: 11.5px;
        color: #334155;
      }
    }

    /* GRID DE CARNETS: 2 COLUMNAS (8 por página A4 aprox) */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .id-card-wrapper {
      position: relative;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* FOTOCHECK / CARNET FÍSICO (85x54 mm aspect ratio) */
    .id-card {
      background: #FFFFFF;
      border: 1.5px solid #CBD5E1;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 195px;
      box-shadow: 0 2px 5px rgba(15, 23, 42, 0.05);
      position: relative;
    }

    .card-header-bar {
      background: linear-gradient(135deg, #C8102E 0%, #991B1B 100%);
      color: #FFFFFF;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .shield-badge {
        background: #FFFFFF;
        color: #C8102E;
        font-size: 10px;
        font-weight: 900;
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.05em;
      }

      .header-text {
        display: flex;
        flex-direction: column;

        .station-name {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.03em;
          line-height: 1.1;
        }

        .cgbvp-subtitle {
          font-size: 8px;
          font-weight: 600;
          opacity: 0.85;
          letter-spacing: 0.02em;
        }
      }

      .tag-credencial {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.08em;
        background: rgba(0, 0, 0, 0.25);
        padding: 2px 6px;
        border-radius: 4px;
      }
    }

    .card-inner-body {
      flex: 1;
      display: flex;
      padding: 10px 12px;
      gap: 12px;
      align-items: center;
      background: #FAFAFA;
    }

    .card-member-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
    }

    .avatar-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .member-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #C8102E;
      flex-shrink: 0;
    }

    .member-role-badge {
      font-size: 9px;
      font-weight: 800;
      color: #C8102E;
      background: #FEE2E2;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }

    .member-name-block {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 4px;

      .member-name {
        margin: 0;
        font-size: 13.5px;
        font-weight: 800;
        color: #0F172A;
        line-height: 1.25;
        white-space: normal;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .group-label {
        font-size: 10.5px;
        font-weight: 600;
        color: #475467;
      }
    }

    .member-id-badges {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;

      .id-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: #EDF2F7;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;

        .badge-lbl {
          font-weight: 700;
          color: #64748B;
        }

        .badge-val {
          font-weight: 800;
          color: #0F172A;
        }
      }
    }

    .card-qr-section {
      width: 110px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .qr-frame {
      width: 100px;
      height: 100px;
      background: #FFFFFF;
      padding: 4px;
      border-radius: 6px;
      border: 1px solid #CBD5E1;
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

    .qr-placeholder {
      width: 100px;
      height: 100px;
      background: #F1F5F9;
      border: 1px dashed #CBD5E1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94A3B8;
      font-size: 24px;
    }

    .qr-hint {
      font-size: 7.5px;
      font-weight: 800;
      color: #64748B;
      letter-spacing: 0.05em;
      text-align: center;
    }

    .card-footer-bar {
      background: #0F172A;
      color: #94A3B8;
      padding: 4px 12px;
      font-size: 8.5px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
      letter-spacing: 0.04em;
    }

    .cut-guide {
      margin-top: 4px;
      border-bottom: 1px dashed #CBD5E1;
      position: relative;
      height: 8px;

      .cut-icon {
        position: absolute;
        top: -6px;
        right: 8px;
        font-size: 11px;
        color: #94A3B8;
      }
    }

    /* ESTILOS DE IMPRESIÓN OFICIAL (A4) */
    @media print {
      body * {
        visibility: hidden !important;
      }

      .printable-roster-sheet,
      .printable-roster-sheet * {
        visibility: visible !important;
      }

      .no-print,
      .p-dialog-header,
      .toolbar-strip,
      .header-actions {
        display: none !important;
      }

      .preview-scroll-container {
        padding: 0 !important;
        overflow: visible !important;
      }

      .a4-sheet-container {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-width: none !important;
        padding: 5mm !important;
        box-shadow: none !important;
        border: none !important;
        background: #FFFFFF !important;
      }

      .cards-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 6mm !important;
      }

      .id-card {
        border: 1px solid #94A3B8 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .card-header-bar {
        background: #C8102E !important;
        color: #FFFFFF !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .card-footer-bar {
        background: #0F172A !important;
        color: #FFFFFF !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .cut-guide {
        border-bottom: 1px dashed #94A3B8 !important;
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
        const codigo = this.obtenerCodigo(item);
        const dataUrl = await QRCode.toDataURL(codigo, {
          width: 200,
          margin: 1,
          color: {
            dark: '#0F172A',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H',
        });
        mapa.set(item.personaId, dataUrl);
      });

      await Promise.all(promesas);
      this.qrMap.set(mapa);
    } catch (err) {
      console.error('Error generando QRs grupales:', err);
    } finally {
      this.generando.set(false);
    }
  }

  obtenerCodigo(item: PizarraItem): string {
    return item.dni && item.dni.trim() ? item.dni.trim() : String(item.personaId);
  }

  obtenerIniciales(nombre: string): string {
    if (!nombre) return '—';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  imprimir(): void {
    window.print();
  }
}
