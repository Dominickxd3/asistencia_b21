import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { JornadaItem, ResultadoEscaneoQr } from './attendance.models';
import { AttendanceApiService } from './attendance-api.service';
import { GeoService } from '../../core/services/geo.service';
import jsQR from 'jsqr';

@Component({
  selector: 'app-qr-scanner-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule],
  template: `
    <p-dialog
      [visible]="visible()"
      [modal]="true"
      [closable]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '540px' }"
      styleClass="r21-scanner-dialog"
    >
      <ng-template pTemplate="header">
        <div class="scanner-header-wrap">
          <div class="scanner-title-box">
            <h2>Escáner de asistencia</h2>
            <div class="scanner-live-badge">
              <span class="pulse-dot"></span>
              <span>Cámara activa</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-close-scanner"
            (click)="cerrarDialogo()"
            title="Cerrar escáner"
            aria-label="Cerrar"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="scanner-content-body">
        <!-- Indicador sutil de jornada -->
        @if (jornada(); as j) {
          <div class="session-info-strip">
            <span class="session-name">{{ nombreGrupoVisible(j) }}</span>
            <div class="session-tags">
              <span class="tag-type" [class.mandatory]="j.tipoJornada === 'OBLIGATORIA'">
                {{ j.tipoJornada === 'OBLIGATORIA' ? 'Obligatoria' : 'Voluntaria' }}
              </span>
              <span class="tag-status">En curso</span>
            </div>
          </div>
        }

        <!-- Visor de la Cámara -->
        <div class="camera-viewport-container">
          <video
            #videoElement
            class="camera-video-stream"
            autoplay
            playsinline
            muted
          ></video>

          <canvas #canvasElement style="display: none;"></canvas>

          <!-- Overlay con miras limpias de encuadre -->
          <div class="scanner-overlay-aim">
            <div class="scanner-reticle-box">
              <div class="reticle-corner corner-tl"></div>
              <div class="reticle-corner corner-tr"></div>
              <div class="reticle-corner corner-bl"></div>
              <div class="reticle-corner corner-br"></div>
            </div>
          </div>

          <!-- Spinner durante procesamiento de red -->
          @if (procesando()) {
            <div class="processing-curtain">
              <i class="pi pi-spin pi-spinner"></i>
              <span>Registrando…</span>
            </div>
          }
        </div>

        <!-- Alerta suave de advertencia (duplicado o nota) -->
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

        <!-- TARJETA: Último registro con UX clara y limpia -->
        <div class="last-record-section">
          <span class="section-label">Último registro</span>

          @if (ultimoRegistro(); as ult) {
            <div
              class="last-record-card"
              [class.card-entrada]="ult.resultado === 'ENTRADA'"
              [class.card-salida]="ult.resultado === 'SALIDA'"
            >
              <div class="check-bubble">
                <i class="pi pi-check"></i>
              </div>
              <div class="record-data">
                <span class="member-name">{{ ult.persona.nombreCompleto }}</span>
                <div class="record-meta">
                  <span
                    class="badge-action"
                    [class.badge-entry]="ult.resultado === 'ENTRADA'"
                    [class.badge-exit]="ult.resultado === 'SALIDA'"
                  >
                    {{ ult.resultado === 'ENTRADA' ? 'Entrada' : 'Salida' }}
                  </span>
                  <span class="meta-sep">·</span>
                  <span class="meta-time">{{ ult.hora }}</span>

                  @if (ult.resultado === 'SALIDA' && ult.duracion) {
                    <span class="meta-sep">·</span>
                    <span class="meta-duration">
                      <i class="pi pi-clock"></i> {{ ult.duracion }}
                    </span>
                  }
                </div>
              </div>
            </div>
          } @else {
            <div class="empty-record-card">
              <i class="pi pi-qrcode"></i>
              <span>Esperando lectura de código QR…</span>
            </div>
          }
        </div>
      </div>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
    }

    ::ng-deep .r21-scanner-dialog .p-dialog-header {
      padding: 16px 20px;
      background: var(--r21-surface, #FFFFFF);
      color: var(--r21-text-primary, #181C23);
      border-bottom: 1px solid var(--r21-border, #E4E7EC);
    }

    ::ng-deep .r21-scanner-dialog .p-dialog-content {
      padding: 16px 20px 20px;
      background: var(--r21-surface, #FFFFFF);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .scanner-header-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .scanner-title-box {
      display: flex;
      align-items: center;
      gap: 10px;

      h2 {
        margin: 0;
        font-size: 16.5px;
        font-weight: 700;
        color: var(--r21-text-primary, #181C23);
      }
    }

    .scanner-live-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      color: var(--r21-green, #14804A);
      background: var(--r21-green-bg, #E7F6ED);
      border: 1px solid #A6F4C5;
      padding: 2px 7px;
      border-radius: 99px;

      .pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--r21-green, #14804A);
        box-shadow: 0 0 0 0 rgba(20, 128, 74, 0.7);
        animation: pulse-green 1.8s infinite;
      }
    }

    @keyframes pulse-green {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(20, 128, 74, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(20, 128, 74, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(20, 128, 74, 0);
      }
    }

    .btn-close-scanner {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid var(--r21-border, #E4E7EC);
      background: #FFFFFF;
      color: var(--r21-text-secondary, #667085);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s ease;

      &:hover {
        background: #F4F5F6;
        color: var(--r21-text-primary, #181C23);
      }
    }

    .scanner-content-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Franja de información de jornada */
    .session-info-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #F8F9FA;
      border: 1px solid var(--r21-border, #E4E7EC);
      border-radius: 6px;

      .session-name {
        font-size: 13px;
        font-weight: 700;
        color: var(--r21-text-primary, #181C23);
      }

      .session-tags {
        display: flex;
        align-items: center;
        gap: 6px;

        .tag-type {
          font-size: 10.5px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 99px;
          background: #ECEFF3;
          color: #475467;

          &.mandatory {
            background: var(--r21-red-light, #FBECEE);
            color: var(--r21-red, #C8102E);
          }
        }

        .tag-status {
          font-size: 10.5px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 99px;
          background: var(--r21-green-bg, #E7F6ED);
          color: var(--r21-green, #14804A);
        }
      }
    }

    /* Visor de Cámara */
    .camera-viewport-container {
      position: relative;
      width: 100%;
      height: 280px;
      background: #181C23;
      border-radius: 8px;
      border: 1px solid var(--r21-border, #E4E7EC);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .camera-video-stream {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Retícula blanca de encuadre */
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
      width: 180px;
      height: 180px;
    }

    .reticle-corner {
      position: absolute;
      width: 22px;
      height: 22px;
      border-color: #FFFFFF;
      border-style: solid;
      border-width: 0;
      filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
    }

    .corner-tl {
      top: 0;
      left: 0;
      border-top-width: 3px;
      border-left-width: 3px;
      border-top-left-radius: 4px;
    }

    .corner-tr {
      top: 0;
      right: 0;
      border-top-width: 3px;
      border-right-width: 3px;
      border-top-right-radius: 4px;
    }

    .corner-bl {
      bottom: 0;
      left: 0;
      border-bottom-width: 3px;
      border-left-width: 3px;
      border-bottom-left-radius: 4px;
    }

    .corner-br {
      bottom: 0;
      right: 0;
      border-bottom-width: 3px;
      border-right-width: 3px;
      border-bottom-right-radius: 4px;
    }

    .processing-curtain {
      position: absolute;
      inset: 0;
      background: rgba(24, 28, 35, 0.85);
      backdrop-filter: blur(2px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;

      i {
        font-size: 24px;
        color: #FFFFFF;
      }
    }

    /* Avisos / advertencias */
    .scanner-notice-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 6px;
      background: var(--r21-amber-bg, #FEF6E7);
      border: 1px solid #FEDF89;
      color: var(--r21-amber, #B76E00);
      font-size: 12.5px;

      i {
        font-size: 15px;
        flex-shrink: 0;
      }

      .notice-text {
        display: flex;
        flex-direction: column;

        strong {
          font-weight: 700;
        }

        span {
          font-size: 11.5px;
        }
      }
    }

    .camera-error-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      background: var(--r21-red-light, #FBECEE);
      border: 1px solid #FECDCA;
      border-radius: 6px;
      color: var(--r21-red-dark, #9F0B24);
      font-size: 12.5px;

      i {
        font-size: 18px;
        margin-top: 2px;
      }

      p {
        margin: 2px 0 6px;
        font-size: 11.5px;
      }

      .btn-retry-camera {
        padding: 4px 10px;
        background: var(--r21-red, #C8102E);
        color: #FFFFFF;
        border: 0;
        border-radius: 4px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
    }

    /* SECCIÓN: Último Registro */
    .last-record-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .section-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--r21-text-secondary, #667085);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .last-record-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #FFFFFF;
      border: 1px solid var(--r21-border, #E4E7EC);

      &.card-entrada {
        border-color: #A6F4C5;
        background: var(--r21-green-bg, #E7F6ED);

        .check-bubble {
          background: #FFFFFF;
          color: var(--r21-green, #14804A);
          border-color: #A6F4C5;
        }
      }

      &.card-salida {
        border-color: #E4E7EC;
        background: #F8F9FA;

        .check-bubble {
          background: #FFFFFF;
          color: var(--r21-text-primary, #181C23);
          border-color: #D0D5DD;
        }
      }

      .check-bubble {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 800;
        border: 1px solid var(--r21-border, #E4E7EC);
        flex-shrink: 0;
      }

      .record-data {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;

        .member-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--r21-text-primary, #181C23);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .record-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--r21-text-secondary, #667085);

          .badge-action {
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 10.5px;

            &.badge-entry {
              background: #FFFFFF;
              color: var(--r21-green, #14804A);
              border: 1px solid #A6F4C5;
            }

            &.badge-exit {
              background: #FFFFFF;
              color: var(--r21-text-primary, #181C23);
              border: 1px solid #D0D5DD;
            }
          }

          .meta-sep {
            color: #D0D5DD;
          }

          .meta-time {
            font-weight: 600;
            color: var(--r21-text-primary, #181C23);
          }

          .meta-duration {
            font-weight: 600;
            color: var(--r21-text-secondary, #667085);
            display: inline-flex;
            align-items: center;
            gap: 3px;

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
      gap: 8px;
      padding: 10px 14px;
      background: #FFFFFF;
      border: 1px dashed var(--r21-border, #E4E7EC);
      border-radius: 6px;
      color: var(--r21-text-muted, #8B949E);
      font-size: 12px;

      i {
        font-size: 14px;
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

        const video = this.videoElementRef?.nativeElement;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          await video.play();
          this.iniciarBucleEscaneo();
        }
      } else {
        this.errorCamara.set('Tu navegador no admite acceso a la cámara mediante MediaDevices.');
      }
    } catch (err: any) {
      console.warn('Error al acceder a la cámara:', err);
      if (err.name === 'NotAllowedError') {
        this.errorCamara.set('Permiso de cámara denegado. Permite el acceso a la cámara en el navegador.');
      } else if (err.name === 'NotFoundError') {
        this.errorCamara.set('No se encontró ninguna cámara disponible en el dispositivo.');
      } else {
        this.errorCamara.set('No se pudo inicializar la cámara: ' + (err.message || 'Error desconocido'));
      }
    }
  }

  detenerCamara(): void {
    this.isScanningLoopActive = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    const video = this.videoElementRef?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }

  private iniciarBucleEscaneo(): void {
    if (this.isScanningLoopActive) return;
    this.isScanningLoopActive = true;

    // Verificar si BarcodeDetector nativo está disponible (acelerado por hardware)
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let nativeDetector: any = null;
    if (hasBarcodeDetector) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        nativeDetector = null;
      }
    }

    const tick = async () => {
      if (!this.isScanningLoopActive) return;

      const video = this.videoElementRef?.nativeElement;
      const canvas = this.canvasElementRef?.nativeElement;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !this.procesando()) {
        try {
          if (nativeDetector) {
            const barcodes = await nativeDetector.detect(video);
            if (barcodes && barcodes.length > 0) {
              const valor = barcodes[0].rawValue;
              if (valor) {
                await this.procesarCodigoDetectado(valor);
              }
            }
          } else if (canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height, {
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
