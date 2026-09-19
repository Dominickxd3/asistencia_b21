import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceApiService } from './attendance-api.service';
import { EventoAuditoriaItem, HoraManualResult } from './attendance.models';

@Component({
  selector: 'app-hora-manual-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    @if (visible()) {
      <div class="dialog-backdrop" (click)="cancelar.emit()"></div>
      <section class="dialog-panel" role="dialog" aria-modal="true">
        <!-- Cabecera Institucional -->
        <header class="dialog-header">
          <div class="header-titles">
            <h2>{{ titulo() }}</h2>
            <span class="header-subtitle">
              {{ soloHistorial() ? 'Trazabilidad y registro de cambios' : (modoAjuste() ? 'Corrección de horario reglamentario' : 'Asignación manual de entrada') }}
            </span>
          </div>
          <button type="button" class="btn-close" (click)="cancelar.emit()" aria-label="Cerrar">
            <i class="pi pi-times"></i>
          </button>
        </header>

        <div class="r21-dialog-content">
          <!-- Tarjeta de Efectivo y Estado Actual -->
          <div class="target-member-card">
            <div class="member-info">
              <i class="pi pi-user member-icon"></i>
              <div class="member-text">
                <span class="member-name">{{ persona() }}</span>
                <div class="member-badges">
                  @if (estadoActual(); as est) {
                    <span class="badge-status" [class]="'status-' + est.toLowerCase()">{{ formatearEstado(est) }}</span>
                  }
                  @if (tipoRegistroActual(); as tipo) {
                    <span class="badge-origin">Origen: {{ tipo === 'QR' ? 'Código QR' : (tipo === 'AUTOMATICO' ? 'Automático' : 'Manual') }}</span>
                  }
                </div>
              </div>
            </div>

            <!-- Resumen actual registrado si está en modo ajuste o historial -->
            @if (modoAjuste() || soloHistorial()) {
              <div class="current-times-strip">
                <div class="time-item">
                  <span class="time-label">Entrada registrada</span>
                  <strong class="time-value">
                    {{ horaEntradaFormateada() || '—' }}
                  </strong>
                </div>
                <div class="time-divider"></div>
                <div class="time-item">
                  <span class="time-label">Salida registrada</span>
                  <strong class="time-value">
                    {{ horaSalidaFormateada() || (estadoActual() === 'PRESENTE' ? 'En curso' : '—') }}
                  </strong>
                </div>
              </div>
            }
          </div>

          <!-- Pestañas si está en modo ajuste (para alternar entre Modificar e Historial) -->
          @if (modoAjuste() && asistenciaId()) {
            <div class="dialog-tabs">
              <button
                type="button"
                class="tab-btn"
                [class.active]="tabActiva() === 'edicion'"
                (click)="tabActiva.set('edicion')"
              >
                <i class="pi pi-clock"></i> Corregir horas
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="tabActiva() === 'historial'"
                (click)="tabActiva.set('historial')"
              >
                <i class="pi pi-history"></i> Historial / Auditoría
                @if (historialEventos().length > 0) {
                  <span class="tab-count">{{ historialEventos().length }}</span>
                }
              </button>
            </div>
          }

          <!-- VISTA: Formulario de edición de horas -->
          @if (!soloHistorial() && tabActiva() === 'edicion') {
            @if (modoAjuste()) {
              <div class="times-grid">
                <div class="input-field-group">
                  <label class="field-label" for="hora-in">
                    Hora de entrada
                    @if (horaEntradaFormateada()) {
                      <span class="label-hint">(Registrada: {{ horaEntradaFormateada() }})</span>
                    }
                  </label>
                  <input
                    id="hora-in"
                    type="time"
                    class="form-control"
                    [(ngModel)]="horaEntrada"
                  />
                </div>
                <div class="input-field-group">
                  <label class="field-label" for="hora-out">
                    Hora de salida
                    @if (horaSalidaFormateada()) {
                      <span class="label-hint">(Registrada: {{ horaSalidaFormateada() }})</span>
                    }
                  </label>
                  <input
                    id="hora-out"
                    type="time"
                    class="form-control"
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
                  class="form-control"
                  [(ngModel)]="horaEntrada"
                />
              </div>
            }

            <div class="input-field-group">
              <label class="field-label" for="hora-motivo">
                Motivo reglamentario *
                <span class="label-hint">(Obligatorio para auditoría)</span>
              </label>
              <textarea
                id="hora-motivo"
                class="form-control"
                rows="2"
                maxlength="500"
                placeholder="Ej.: Efectivo llegó al cuartel a las 19:10 por retén de servicio..."
                [(ngModel)]="motivo"
              ></textarea>
            </div>

            @if (error()) {
              <div class="field-error-msg">
                <i class="pi pi-exclamation-circle"></i>
                <span>{{ error() }}</span>
              </div>
            }
          }

          <!-- VISTA: Historial y Auditoría -->
          @if (soloHistorial() || tabActiva() === 'historial') {
            <div class="history-section">
              <div class="history-heading">
                <span class="section-title">
                  <i class="pi pi-history"></i> Trazabilidad de operaciones
                </span>
                @if (historialCargando()) {
                  <span class="loading-tag"><i class="pi pi-spin pi-spinner"></i> Consultando…</span>
                }
              </div>

              @if (historialCargando() && historialEventos().length === 0) {
                <div class="history-empty">
                  <i class="pi pi-spin pi-spinner"></i>
                  <span>Cargando eventos de auditoría…</span>
                </div>
              } @else if (historialEventos().length === 0) {
                <div class="history-empty">
                  <i class="pi pi-info-circle"></i>
                  <span>No hay registros previos de modificación para esta asistencia.</span>
                </div>
              } @else {
                <div class="timeline-container">
                  @for (ev of historialEventos(); track ev.id) {
                    <div class="timeline-entry">
                      <div class="timeline-marker">
                        <span class="marker-dot" [class]="claseAccion(ev.accion)"></span>
                        <div class="marker-line"></div>
                      </div>
                      <div class="timeline-content">
                        <div class="entry-header">
                          <span class="entry-action" [class]="claseAccion(ev.accion)">
                            {{ etiquetaAccion(ev.accion) }}
                          </span>
                          <span class="entry-time">{{ ev.fechaHora | date: 'dd/MM/yyyy HH:mm:ss' }}</span>
                        </div>
                        <div class="entry-meta">
                          <span class="entry-user"><i class="pi pi-shield"></i> {{ ev.usuario }}</span>
                          @if (ev.valorNuevo?.origen) {
                            <span class="entry-pill">Origen: {{ ev.valorNuevo.origen }}</span>
                          }
                          @if (ev.valorNuevo?.duracion) {
                            <span class="entry-pill"><i class="pi pi-clock"></i> {{ ev.valorNuevo.duracion }}</span>
                          }
                        </div>
                        @if (ev.valorNuevo?.horaEntrada || ev.valorNuevo?.horaSalida) {
                          <div class="entry-diff">
                            @if (ev.valorNuevo?.horaEntrada) {
                              <span>Entrada: <strong>{{ ev.valorNuevo.horaEntrada }}</strong></span>
                            }
                            @if (ev.valorNuevo?.horaSalida) {
                              <span>Salida: <strong>{{ ev.valorNuevo.horaSalida }}</strong></span>
                            }
                          </div>
                        }
                        @if (ev.valorNuevo?.motivo || ev.valorNuevo?.observacion) {
                          <p class="entry-motivo">
                            <strong>Motivo:</strong> {{ ev.valorNuevo?.motivo || ev.valorNuevo?.observacion }}
                          </p>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Pie de Acciones -->
        <footer class="dialog-footer">
          @if (soloHistorial()) {
            <button
              type="button"
              class="dialog-button secondary"
              (click)="cancelar.emit()"
            >Cerrar</button>
          } @else {
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
            >
              {{ procesando() ? 'Guardando…' : (modoAjuste() ? 'Guardar corrección' : 'Registrar') }}
            </button>
          }
        </footer>
      </section>
    }
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1200;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px);
    }

    .dialog-panel {
      position: fixed;
      z-index: 1201;
      top: 50%;
      left: 50%;
      width: min(520px, calc(100vw - 32px));
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      transform: translate(-50%, -50%);
      background: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 20px 48px rgba(15, 23, 42, 0.22);
      border: 1px solid var(--r21-border, #E4E7EC);
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 18px 22px 14px;
      border-bottom: 1px solid var(--r21-border, #E4E7EC);

      .header-titles {
        display: flex;
        flex-direction: column;
        gap: 2px;

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--r21-text-primary, #181C23);
        }

        .header-subtitle {
          font-size: 12px;
          color: var(--r21-text-secondary, #667085);
        }
      }

      .btn-close {
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--r21-text-muted, #8B949E);
        padding: 4px;
        font-size: 15px;
        border-radius: 6px;
        transition: all 0.15s ease;

        &:hover {
          color: var(--r21-text-primary, #181C23);
          background: #F2F4F7;
        }
      }
    }

    .r21-dialog-content {
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      max-height: calc(90vh - 140px);
    }

    /* Tarjeta de miembro y resumen */
    .target-member-card {
      background: #F8F9FA;
      border: 1px solid var(--r21-border, #E4E7EC);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .member-info {
        display: flex;
        align-items: center;
        gap: 10px;

        .member-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 1px solid var(--r21-border, #E4E7EC);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--r21-text-secondary, #667085);
          font-size: 14px;
          flex-shrink: 0;
        }

        .member-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;

          .member-name {
            font-size: 14px;
            font-weight: 700;
            color: var(--r21-text-primary, #181C23);
          }

          .member-badges {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;

            .badge-status {
              font-size: 10.5px;
              font-weight: 700;
              padding: 1px 6px;
              border-radius: 4px;
              text-transform: uppercase;

              &.status-presente {
                background: #E7F6ED;
                color: #14804A;
                border: 1px solid #A6F4C5;
              }

              &.status-finalizado {
                background: #F2F4F7;
                color: #344054;
                border: 1px solid #D0D5DD;
              }

              &.status-falta_justificada {
                background: #FEF6EE;
                color: #B54708;
                border: 1px solid #F9DBAF;
              }
            }

            .badge-origin {
              font-size: 11px;
              color: var(--r21-text-secondary, #667085);
            }
          }
        }
      }

      .current-times-strip {
        display: flex;
        align-items: center;
        background: #FFFFFF;
        border: 1px solid var(--r21-border-subtle, #EAECF0);
        border-radius: 6px;
        padding: 8px 14px;

        .time-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;

          .time-label {
            font-size: 10.5px;
            color: var(--r21-text-muted, #8B949E);
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.03em;
          }

          .time-value {
            font-size: 13.5px;
            font-weight: 700;
            color: var(--r21-text-primary, #181C23);
          }
        }

        .time-divider {
          width: 1px;
          height: 24px;
          background: var(--r21-border, #E4E7EC);
          margin: 0 12px;
        }
      }
    }

    /* Pestañas */
    .dialog-tabs {
      display: flex;
      border-bottom: 1px solid var(--r21-border, #E4E7EC);
      gap: 4px;

      .tab-btn {
        background: transparent;
        border: 0;
        border-bottom: 2px solid transparent;
        padding: 8px 14px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--r21-text-secondary, #667085);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: -1px;

        &.active {
          color: var(--r21-red, #C8102E);
          border-bottom-color: var(--r21-red, #C8102E);
          font-weight: 700;
        }

        .tab-count {
          font-size: 10.5px;
          background: #F2F4F7;
          color: #344054;
          padding: 1px 6px;
          border-radius: 10px;
        }
      }
    }

    /* Formulario */
    .times-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .input-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .field-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--r21-text-secondary, #667085);
        display: flex;
        align-items: center;
        gap: 4px;

        .label-hint {
          font-weight: 400;
          color: var(--r21-text-muted, #8B949E);
          font-size: 11px;
        }
      }

      .form-control {
        width: 100%;
        border: 1px solid var(--r21-border, #E4E7EC);
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 13.5px;
        color: var(--r21-text-primary, #181C23);
        background: #FFFFFF;
        box-sizing: border-box;

        &:focus {
          outline: none;
          border-color: var(--r21-red, #C8102E);
          box-shadow: 0 0 0 2px rgba(200, 16, 46, 0.1);
        }
      }
    }

    .field-error-msg {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--r21-red, #C8102E);
      font-size: 12px;
      padding: 6px 10px;
      background: #FDF2F2;
      border-radius: 6px;
    }

    /* Historial */
    .history-section {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .history-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .section-title {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--r21-text-primary, #181C23);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .loading-tag {
          font-size: 11px;
          color: var(--r21-text-muted, #8B949E);
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }

      .history-empty {
        padding: 24px;
        text-align: center;
        background: #F8F9FA;
        border: 1px dashed var(--r21-border, #E4E7EC);
        border-radius: 6px;
        font-size: 12.5px;
        color: var(--r21-text-muted, #8B949E);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .timeline-container {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .timeline-entry {
        display: flex;
        gap: 12px;
        position: relative;

        &:last-child .marker-line {
          display: none;
        }

        .timeline-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 14px;
          padding-top: 4px;

          .marker-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #98A2B3;

            &.action-entry { background: #14804A; }
            &.action-exit { background: #181C23; }
            &.action-modify { background: #B54708; }
            &.action-annul { background: #C8102E; }
          }

          .marker-line {
            width: 1px;
            flex: 1;
            background: #E4E7EC;
            margin: 4px 0;
            min-height: 24px;
          }
        }

        .timeline-content {
          flex: 1;
          padding-bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;

          .entry-header {
            display: flex;
            align-items: center;
            justify-content: space-between;

            .entry-action {
              font-size: 12.5px;
              font-weight: 700;
              color: var(--r21-text-primary, #181C23);

              &.action-entry { color: #14804A; }
              &.action-modify { color: #B54708; }
              &.action-annul { color: #C8102E; }
            }

            .entry-time {
              font-size: 11px;
              color: var(--r21-text-muted, #8B949E);
              font-variant-numeric: tabular-nums;
            }
          }

          .entry-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11.5px;
            color: var(--r21-text-secondary, #667085);

            .entry-user {
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 3px;
            }

            .entry-pill {
              background: #F2F4F7;
              padding: 1px 6px;
              border-radius: 4px;
              font-size: 10.5px;
              display: flex;
              align-items: center;
              gap: 3px;
            }
          }

          .entry-diff {
            font-size: 12px;
            color: var(--r21-text-primary, #181C23);
            background: #F8F9FA;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid #EAECF0;
            display: flex;
            gap: 12px;
          }

          .entry-motivo {
            margin: 0;
            font-size: 11.5px;
            color: var(--r21-text-secondary, #667085);
            background: #FEF6EE;
            border: 1px solid #F9DBAF;
            border-radius: 4px;
            padding: 4px 8px;
          }
        }
      }
    }

    /* Pie */
    .dialog-footer {
      padding: 14px 22px;
      border-top: 1px solid var(--r21-border, #E4E7EC);
      background: #F8F9FA;
      display: flex;
      justify-content: flex-end;
      gap: 10px;

      .dialog-button {
        min-height: 36px;
        padding: 0 16px;
        border-radius: 6px;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        border: 0;
        transition: all 0.15s ease;

        &.secondary {
          background: #FFFFFF;
          border: 1px solid var(--r21-border, #E4E7EC);
          color: var(--r21-text-primary, #181C23);

          &:hover:not(:disabled) {
            background: #F2F4F7;
          }
        }

        &.primary {
          background: var(--r21-red, #C8102E);
          color: #FFFFFF;

          &:hover:not(:disabled) {
            background: var(--r21-red-dark, #9F0B24);
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }
  `],
})
export class HoraManualDialogComponent {
  private readonly api = inject(AttendanceApiService);

  readonly visible = input(false);
  readonly titulo = input('Hora manual');
  readonly modoAjuste = input(false);
  readonly soloHistorial = input(false);
  readonly persona = input('');
  readonly procesando = input(false);
  readonly error = input<string | null>(null);

  readonly horaEntradaInicial = input<string | null>(null);
  readonly horaSalidaInicial = input<string | null>(null);
  readonly estadoActual = input<string | null>(null);
  readonly tipoRegistroActual = input<string | null>(null);
  readonly asistenciaId = input<number | null>(null);

  readonly confirmado = output<HoraManualResult>();
  readonly cancelar = output<void>();

  horaEntrada = '';
  horaSalida = '';
  motivo = '';

  readonly tabActiva = signal<'edicion' | 'historial'>('edicion');
  readonly historialCargando = signal(false);
  readonly historialEventos = signal<EventoAuditoriaItem[]>([]);

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.tabActiva.set(this.soloHistorial() ? 'historial' : 'edicion');

        // Pre-cargar horas registradas actuales
        this.horaEntrada = this.extraerHora(this.horaEntradaInicial()) || '';
        this.horaSalida = this.extraerHora(this.horaSalidaInicial()) || '';
        this.motivo = '';

        // Consultar historial de auditoría si existe asistencia
        const aId = this.asistenciaId();
        if (aId && aId > 0) {
          void this.cargarHistorial(aId);
        } else {
          this.historialEventos.set([]);
        }
      }
    });
  }

  horaEntradaFormateada(): string {
    return this.extraerHora(this.horaEntradaInicial());
  }

  horaSalidaFormateada(): string {
    return this.extraerHora(this.horaSalidaInicial());
  }

  private extraerHora(isoOStr: string | null | undefined): string {
    if (!isoOStr) return '';
    try {
      const d = new Date(isoOStr);
      if (isNaN(d.getTime())) {
        const match = isoOStr.match(/(\d{2}):(\d{2})/);
        return match ? `${match[1]}:${match[2]}` : '';
      }
      return new Intl.DateTimeFormat('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return '';
    }
  }

  async cargarHistorial(asistenciaId: number): Promise<void> {
    this.historialCargando.set(true);
    try {
      const data = await this.api.historial(asistenciaId);
      this.historialEventos.set(data?.eventos ?? []);
    } catch (e) {
      console.warn('No se pudo cargar el historial de auditoría:', e);
      this.historialEventos.set([]);
    } finally {
      this.historialCargando.set(false);
    }
  }

  formatearEstado(estado: string): string {
    const mapa: Record<string, string> = {
      PRESENTE: 'Presente',
      FINALIZADO: 'Finalizado',
      PENDIENTE: 'Pendiente',
      FALTA_JUSTIFICADA: 'Falta justificada',
      FALTA_INJUSTIFICADA: 'Falta injustificada',
      SALIDA_ANTICIPADA: 'Salida anticipada',
      ANULADO: 'Anulado',
    };
    return mapa[estado] ?? estado;
  }

  etiquetaAccion(accion: string): string {
    const mapa: Record<string, string> = {
      ATTENDANCE_ENTRY: 'Entrada registrada',
      ATTENDANCE_EXIT: 'Salida registrada',
      ATTENDANCE_MODIFIED: 'Horario / Asistencia modificada',
      ATTENDANCE_ANNULLED: 'Asistencia anulada',
      ATTENDANCE_JUSTIFIED: 'Falta justificada',
      ATTENDANCE_EARLY_EXIT: 'Salida anticipada',
    };
    return mapa[accion] ?? accion;
  }

  claseAccion(accion: string): string {
    if (accion.includes('ENTRY')) return 'action-entry';
    if (accion.includes('EXIT')) return 'action-exit';
    if (accion.includes('MODIFIED') || accion.includes('JUSTIFIED')) return 'action-modify';
    if (accion.includes('ANNULLED')) return 'action-annul';
    return '';
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
