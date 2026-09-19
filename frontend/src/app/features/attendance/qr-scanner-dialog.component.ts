import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { JornadaItem, ResultadoEscaneoQr } from './attendance.models';
import { AttendanceApiService } from './attendance-api.service';
import { GeoService } from '../../core/services/geo.service';
import jsQR from 'jsqr';

@Component({
  selector: 'app-qr-scanner-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      [visible]="visible()"
      [modal]="true"
      [closable]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '620px' }"
      styleClass="r21-scanner-dialog"
    >
      <ng-template pTemplate="header">
        <div class="scanner-header-wrap">
          <div class="scanner-title-box">
            <div class="scanner-live-badge">
              <span class="pulse-dot"></span>
              <span>Cámara activa</span>
            </div>
            <h2>Escáner de asistencia</h2>
          </div>
          <button
            type="button"
            class="btn-close-scanner"
            (click)="cerrarDialogo()"
            title="Cerrar escáner"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="scanner-content-body">
        <!-- Indicador de Jornada Actual -->
        @if (jornada(); as j) {
          <div class="session-info-banner">
            <div class="session-label-wrap">
              <span class="session-eyebrow">Jornada actual:</span>
              <strong class="session-name">{{ nombreGrupoVisible(j) }}</strong>
            </div>
            <div class="session-type-tags">
              <span class="type-pill" [class.mandatory]="j.tipoJornada === 'OBLIGATORIA'">
                {{ j.tipoJornada === 'OBLIGATORIA' ? 'Obligatoria' : 'Voluntaria' }}
              </span>
              <span class="status-live-tag">En curso</span>
            </div>
          </div>
        }

        <!-- Contenedor del Visor de la Cámara -->
        <div class="camera-viewport-container">
          <video
            #videoElement
            class="camera-video-stream"
            autoplay
            playsinline
            muted
          ></video>

          <canvas #canvasElement style="display: none;"></canvas>

          <!-- Overlay con miras de encuadre y mensaje guía -->
          <div class="scanner-overlay-aim">
            <div class="scanner-reticle-box">
              <div class="reticle-corner corner-tl"></div>
              <div class="reticle-corner corner-tr"></div>
              <div class="reticle-corner corner-bl"></div>
              <div class="reticle-corner corner-br"></div>
              <div class="scanner-laser-line"></div>
            </div>
            <div class="scanner-guide-text">
              <i class="pi pi-qrcode"></i>
              <span>Acerque el QR al lector</span>
            </div>
          </div>

          <!-- Spinner durante procesamiento de red -->
          @if (procesando()) {
            <div class="processing-curtain">
              <i class="pi pi-spin pi-spinner"></i>
              <span>Validando registro…</span>
            </div>
          }
        </div>

        <!-- Alerta de advertencia suave (ej. duplicado o advertencia) -->
        @if (avisoReciente()) {
          <div class="scanner-notice-banner" [class.is-warning]="avisoTipo() === 'DUPLICADO'">
            <i class="pi" [class.pi-exclamation-triangle]="avisoTipo() === 'DUPLICADO'" [class.pi-info-circle]="avisoTipo() !== 'DUPLICADO'"></i>
            <div class="notice-text">
              <strong>{{ avisoReciente() }}</strong>
              @if (avisoDetalle()) {
                <span>{{ avisoDetalle() }}</span>
              }
            </div>
          </div>
        }

        <!-- Error si no se pudo acceder a la cámara -->
        @if (errorCamara()) {
          <div class="camera-error-banner">
            <i class="pi pi-camera"></i>
            <div>
              <strong>No se pudo acceder a la cámara</strong>
              <p>{{ errorCamara() }}</p>
              <button type="button" class="btn-retry-camera" (click)="iniciarCamara()">
                <i class="pi pi-refresh"></i> Reintentar
              </button>
            </div>
          </div>
        }

        <!-- TARJETA: Último registro -->
        <div class="last-record-section">
          <div class="section-title-line">
            <span class="section-label">Último registro</span>
            @if (ultimoRegistro()) {
              <span class="realtime-tag">✓ Confirmado</span>
            }
          </div>

          @if (ultimoRegistro(); as ult) {
            <div
              class="last-record-card"
              [class.card-entrada]="ult.resultado === 'ENTRADA'"
              [class.card-salida]="ult.resultado === 'SALIDA'"
            >
              <div class="check-icon-bubble">
                <i class="pi pi-check"></i>
              </div>
              <div class="record-info-col">
                <div class="member-name">{{ ult.persona.nombreCompleto }}</div>
                <div class="record-meta-row">
                  <span
                    class="action-pill"
                    [class.pill-entry]="ult.resultado === 'ENTRADA'"
                    [class.pill-exit]="ult.resultado === 'SALIDA'"
                  >
                    {{ ult.resultado === 'ENTRADA' ? 'Entrada' : 'Salida' }}
                  </span>
                  <span class="meta-dot">·</span>
                  <span class="meta-time">{{ ult.hora }}</span>

                  @if (ult.resultado === 'SALIDA' && ult.duracion) {
                    <span class="meta-dot">·</span>
                    <span class="meta-duration">
                      <i class="pi pi-clock"></i> Duración · {{ ult.duracion }}
                    </span>
                  }
                </div>
              </div>
            </div>
          } @else {
            <div class="empty-record-card">
              <i class="pi pi-id-card"></i>
              <span>Aún no se ha realizado ninguna lectura en esta sesión.</span>
            </div>
          }
        </div>

        <!-- Entrada alternativa para lector de códigos USB o manual -->
        <div class="scanner-manual-input-row">
          <div class="manual-input-box">
            <i class="pi pi-barcode"></i>
            <input
              #manualInput
              type="text"
              placeholder="O ingrese DNI / carnet manualmente…"
              [(ngModel)]="codigoManual"
              (keydown.enter)="procesarManual()"
              [disabled]="procesando()"
            />
          </div>
          <button
            type="button"
            class="btn-submit-code"
            (click)="procesarManual()"
            [disabled]="!codigoManual.trim() || procesando()"
          >
            Registrar
          </button>
        </div>
      </div>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
    }

    ::ng-deep .r21-scanner-dialog .p-dialog-content {
      padding: 0;
      overflow: hidden;
      border-radius: 12px;
      background: #FFFFFF;
    }

    ::ng-deep .r21-scanner-dialog .p-dialog-header {
      padding: 16px 20px;
      background: #0D141C;
      color: #FFFFFF;
      border-bottom: 1px solid #1E293B;
    }

    .scanner-header-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .scanner-title-box {
      display: flex;
      flex-direction: column;
      gap: 4px;

      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 750;
        color: #F8FAFC;
        letter-spacing: -0.01em;
      }
    }

    .scanner-live-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #4ADE80;
      text-transform: uppercase;
      letter-spacing: 0.05em;

      .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #22C55E;
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
        animation: pulse-green 1.8s infinite;
      }
    }

    @keyframes pulse-green {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
      }
    }

    .btn-close-scanner {
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

    .scanner-content-body {
      padding: 16px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: #FAFAFA;
    }

    /* Banner de Jornada Actual */
    .session-info-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 9px;
    }

    .session-label-wrap {
      display: flex;
      flex-direction: column;

      .session-eyebrow {
        font-size: 11px;
        color: #64748B;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .session-name {
        font-size: 14px;
        color: #0F172A;
        font-weight: 700;
      }
    }

    .session-type-tags {
      display: flex;
      align-items: center;
      gap: 6px;

      .type-pill {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 99px;
        background: #F1F5F9;
        color: #334155;
        border: 1px solid #CBD5E1;

        &.mandatory {
          background: #EFF6FF;
          color: #1D4ED8;
          border-color: #BFDBFE;
        }
      }

      .status-live-tag {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 99px;
        background: #ECFDF5;
        color: #047857;
        border: 1px solid #A7F3D0;
      }
    }

    /* Visor de Cámara */
    .camera-viewport-container {
      position: relative;
      width: 100%;
      height: 270px;
      background: #0F172A;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.6);
    }

    .camera-video-stream {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Retícula y láser de escaneo */
    .scanner-overlay-aim {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .scanner-reticle-box {
      position: relative;
      width: 190px;
      height: 190px;
    }

    .reticle-corner {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: #38BDF8;
      border-style: solid;
      border-width: 0;
    }

    .corner-tl {
      top: 0;
      left: 0;
      border-top-width: 3.5px;
      border-left-width: 3.5px;
      border-top-left-radius: 6px;
    }

    .corner-tr {
      top: 0;
      right: 0;
      border-top-width: 3.5px;
      border-right-width: 3.5px;
      border-top-right-radius: 6px;
    }

    .corner-bl {
      bottom: 0;
      left: 0;
      border-bottom-width: 3.5px;
      border-left-width: 3.5px;
      border-bottom-left-radius: 6px;
    }

    .corner-br {
      bottom: 0;
      right: 0;
      border-bottom-width: 3.5px;
      border-right-width: 3.5px;
      border-bottom-right-radius: 6px;
    }

    .scanner-laser-line {
      position: absolute;
      left: 6px;
      right: 6px;
      height: 2px;
      background: linear-gradient(90deg, transparent, #38BDF8, #E0F2FE, #38BDF8, transparent);
      box-shadow: 0 0 8px #38BDF8;
      animation: scan-vertical 2.2s ease-in-out infinite alternate;
    }

    @keyframes scan-vertical {
      0% {
        top: 8px;
        opacity: 0.3;
      }
      50% {
        opacity: 1;
      }
      100% {
        top: 178px;
        opacity: 0.3;
      }
    }

    .scanner-guide-text {
      margin-top: 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      border-radius: 99px;
      color: #F8FAFC;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .processing-curtain {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(3px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;

      i {
        font-size: 26px;
        color: #38BDF8;
      }
    }

    /* Avisos y duplicados */
    .scanner-notice-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      color: #92400E;
      font-size: 13px;

      i {
        font-size: 16px;
        flex-shrink: 0;
      }

      .notice-text {
        display: flex;
        flex-direction: column;

        strong {
          font-weight: 700;
        }

        span {
          font-size: 12px;
        }
      }
    }

    .camera-error-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: 8px;
      color: #991B1B;
      font-size: 13px;

      i {
        font-size: 20px;
        margin-top: 2px;
      }

      p {
        margin: 4px 0 8px;
        font-size: 12px;
        color: #B91C1C;
      }

      .btn-retry-camera {
        padding: 4px 10px;
        background: #DC2626;
        color: #FFFFFF;
        border: 0;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
    }

    /* SECCIÓN: Último Registro */
    .last-record-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .section-title-line {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .section-label {
        font-size: 12px;
        font-weight: 700;
        color: #475467;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .realtime-tag {
        font-size: 11px;
        font-weight: 700;
        color: #087443;
      }
    }

    .last-record-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 10px;
      background: #FFFFFF;
      border: 1.5px solid #D0D5DD;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(16, 24, 40, 0.04);

      &.card-entrada {
        border-color: #A6F4C5;
        background: #F6FEF9;

        .check-icon-bubble {
          background: #ECFDF3;
          color: #087443;
          border-color: #A6F4C5;
        }
      }

      &.card-salida {
        border-color: #B9E6FE;
        background: #F0F9FF;

        .check-icon-bubble {
          background: #E0F2FE;
          color: #026AA2;
          border-color: #B9E6FE;
        }
      }

      .check-icon-bubble {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 800;
        border: 1px solid #D0D5DD;
        flex-shrink: 0;
      }

      .record-info-col {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;

        .member-name {
          font-size: 15px;
          font-weight: 750;
          color: #101828;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .record-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          font-size: 12.5px;
          color: #475467;

          .action-pill {
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 6px;
            font-size: 11px;

            &.pill-entry {
              background: #D1FADF;
              color: #087443;
            }

            &.pill-exit {
              background: #BAE6FD;
              color: #026AA2;
            }
          }

          .meta-dot {
            color: #98A2B3;
          }

          .meta-time {
            font-weight: 650;
            color: #1D2939;
          }

          .meta-duration {
            font-weight: 650;
            color: #026AA2;
            display: inline-flex;
            align-items: center;
            gap: 4px;

            i {
              font-size: 11px;
            }
          }
        }
      }
    }

    .empty-record-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #FFFFFF;
      border: 1px dashed #D0D5DD;
      border-radius: 8px;
      color: #667085;
      font-size: 12.5px;

      i {
        font-size: 16px;
        color: #98A2B3;
      }
    }

    /* Entrada manual / Lector USB */
    .scanner-manual-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .manual-input-box {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      background: #FFFFFF;
      border: 1px solid #D0D5DD;
      border-radius: 8px;
      height: 38px;

      i {
        color: #667085;
        font-size: 14px;
      }

      input {
        border: 0;
        background: transparent;
        width: 100%;
        outline: none;
        font-size: 13px;
        color: #101828;

        &::placeholder {
          color: #98A2B3;
        }
      }
    }

    .btn-submit-code {
      height: 38px;
      padding: 0 14px;
      background: #087443;
      color: #FFFFFF;
      border: 0;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover:not(:disabled) {
        background: #065F36;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `],
})
export class QrScannerDialogComponent implements OnDestroy {
  private readonly api = inject(AttendanceApiService);
  private readonly geo = inject(GeoService);

  readonly visible = input<boolean>(false);
  readonly jornada = input<JornadaItem | null>(null);
  readonly cerrar = output<void>();
  readonly registroExitoso = output<ResultadoEscaneoQr>();

  @ViewChild('videoElement') videoElementRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElementRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('manualInput') manualInputRef?: ElementRef<HTMLInputElement>;

  codigoManual = '';
  readonly procesando = signal(false);
  readonly errorCamara = signal('');
  readonly ultimoRegistro = signal<ResultadoEscaneoQr | null>(null);
  readonly avisoReciente = signal('');
  readonly avisoDetalle = signal('');
  readonly avisoTipo = signal<'DUPLICADO' | 'INFO'>('INFO');

  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private isScanningLoopActive = false;
  private audioContext: AudioContext | null = null;

  /** Mapa de enfriamiento cliente (anti-doble escaneo) */
  private readonly clientCooldowns = new Map<string, number>();

  constructor() {
    effect(() => {
      if (this.visible()) {
        setTimeout(() => {
          void this.iniciarCamara();
          this.manualInputRef?.nativeElement?.focus();
        }, 150);
      } else {
        this.detenerCamara();
      }
    });
  }

  ngOnDestroy(): void {
    this.detenerCamara();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
    }
  }

  cerrarDialogo(): void {
    this.detenerCamara();
    this.cerrar.emit();
  }

  async iniciarCamara(): Promise<void> {
    this.errorCamara.set('');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        this.mediaStream = stream;
        if (this.videoElementRef?.nativeElement) {
          const video = this.videoElementRef.nativeElement;
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          await video.play();
          this.iniciarBucleEscaneo();
        }
      } else {
        this.errorCamara.set('Tu navegador o dispositivo no soporta acceso a la cámara.');
      }
    } catch (err: any) {
      this.errorCamara.set(
        err?.message ?? 'No se pudo activar la cámara. Revisa los permisos de tu navegador.',
      );
    }
  }

  private detenerCamara(): void {
    this.isScanningLoopActive = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElementRef?.nativeElement) {
      this.videoElementRef.nativeElement.srcObject = null;
    }
  }

  private iniciarBucleEscaneo(): void {
    if (this.isScanningLoopActive) return;
    this.isScanningLoopActive = true;

    // Verificar si BarcodeDetector nativo está disponible
    const hasNativeBarcodeDetector = 'BarcodeDetector' in window;
    let detector: any = null;
    if (hasNativeBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
      } catch {
        detector = null;
      }
    }

    const tick = async () => {
      if (!this.isScanningLoopActive || !this.visible()) return;

      const video = this.videoElementRef?.nativeElement;
      const canvas = this.canvasElementRef?.nativeElement;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !this.procesando()) {
        try {
          if (detector) {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              await this.procesarCodigoDetectado(barcodes[0].rawValue);
            }
          } else if (canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (code && code.data) {
                await this.procesarCodigoDetectado(code.data);
              }
            }
          }
        } catch {
          // Ignorar cuadros fallidos y continuar el bucle sin interrupción
        }
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  async procesarManual(): Promise<void> {
    const cod = this.codigoManual.trim();
    if (!cod || this.procesando()) return;
    this.codigoManual = '';
    await this.procesarCodigoDetectado(cod);
  }

  private async procesarCodigoDetectado(qrCode: string): Promise<void> {
    const raw = (qrCode || '').trim();
    if (!raw || this.procesando()) return;

    const j = this.jornada();
    if (!j) return;

    // 1. Verificación de duplicado en cliente (< 6 segundos)
    const ultimoScan = this.clientCooldowns.get(raw);
    const ahora = Date.now();
    if (ultimoScan && ahora - ultimoScan < 6000) {
      this.avisoTipo.set('DUPLICADO');
      this.avisoReciente.set('QR ya procesado recientemente.');
      this.avisoDetalle.set('Espera unos segundos antes de volver a escanear a la misma persona.');
      this.playTone('aviso');
      return;
    }

    this.clientCooldowns.set(raw, ahora);
    this.procesando.set(true);
    this.avisoReciente.set('');
    this.avisoDetalle.set('');

    try {
      const geo = await this.geo.capturar();
      const resultado = await this.api.escanearQr(j.id, raw, geo);

      if (resultado.resultado === 'DUPLICADO') {
        this.avisoTipo.set('DUPLICADO');
        this.avisoReciente.set('QR ya procesado recientemente.');
        this.avisoDetalle.set(`${resultado.persona?.nombreCompleto ?? ''} · No se registró una segunda operación.`);
        this.playTone('aviso');
      } else if (resultado.resultado === 'ENTRADA') {
        this.ultimoRegistro.set(resultado);
        this.registroExitoso.emit(resultado);
        this.playTone('entrada');
      } else if (resultado.resultado === 'SALIDA') {
        this.ultimoRegistro.set(resultado);
        this.registroExitoso.emit(resultado);
        this.playTone('salida');
      } else {
        this.avisoTipo.set('INFO');
        this.avisoReciente.set(resultado.mensaje);
        this.playTone('aviso');
      }
    } catch (err: any) {
      this.avisoTipo.set('INFO');
      this.avisoReciente.set(
        err?.error?.message ?? 'No se pudo registrar la lectura. Verifica que el integrante pertenezca al grupo.',
      );
      this.playTone('error');
    } finally {
      this.procesando.set(false);
      // Mantener foco en el input para lectores de pistola USB
      setTimeout(() => this.manualInputRef?.nativeElement?.focus(), 100);
    }
  }

  private playTone(type: 'entrada' | 'salida' | 'aviso' | 'error'): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }

      const ctx = this.audioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'entrada') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'salida') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.setValueAtTime(950, now + 0.08);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'aviso') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch {
      // Ignorar si el navegador bloquea audio sin interacción previa
    }
  }

  nombreGrupoVisible(j: JornadaItem): string {
    const etapa = (j.etapa || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const periodo = j.grupo.match(/\b\d{4}-(?:I|II)\b/i)?.[0] ?? '';
    if (etapa.includes('ESBAS')) return `Aspirantes ESBAS${periodo ? ` ${periodo}` : ''}`;
    if (etapa.includes('COMPANIA')) return `Aspirantes de compañía${periodo ? ` ${periodo}` : ''}`;
    return j.grupo;
  }
}
