import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PizarraItem } from './attendance.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

export type AccionFila =
  | 'entrada'
  | 'salida'
  | 'hora-manual'
  | 'falta-justificada'
  | 'salida-anticipada'
  | 'observacion'
  | 'ajustar'
  | 'anular';

export interface SolicitudAccion {
  accion: AccionFila;
  item: PizarraItem;
}

/** Fila de la pizarra: estado, hora y acción principal + menú contextual. */
@Component({
  selector: 'app-attendance-member-row',
  imports: [StatusBadgeComponent, DatePipe],
  template: `
    <div class="r21-board-row">
      <div>
        <div class="nombre">{{ item().nombreCompleto }}</div>
        <div class="meta">
          @if (item().fechaHoraEntrada) {
            Entrada {{ item().fechaHoraEntrada | date: 'HH:mm' }}
            @if (item().fechaHoraSalida) {
              · Salida {{ item().fechaHoraSalida | date: 'HH:mm' }}
            }
            @if (item().tipoRegistro === 'MANUAL') {
              · registro manual
            }
          } @else if (!item().estado || item().estado === 'PENDIENTE') {
            Sin registrar
          }
          @if (item().observacion) {
            · {{ item().observacion }}
          }
        </div>
      </div>

      <div class="acciones">
        <app-status-badge [estado]="item().estado ?? 'PENDIENTE'" />

        @if (accionPrincipal(); as ap) {
          <button
            type="button"
            class="btn btn-sm btn-r21"
            [disabled]="procesando()"
            (click)="emitir(ap.accion)"
          >
            <i class="bi" [class]="ap.icono"></i> {{ ap.texto }}
          </button>
        }

        @if (opcionesMenu().length > 0) {
          <div class="position-relative">
            <button
              type="button"
              class="btn btn-sm btn-r21-outline"
              (click)="menuAbierto.set(!menuAbierto())"
              aria-label="Más acciones"
            >
              <i class="bi bi-three-dots-vertical"></i>
            </button>
            @if (menuAbierto()) {
              <div
                class="position-absolute end-0 bg-white border rounded shadow-sm py-1"
                style="min-width: 190px; z-index: 30"
              >
                @for (op of opcionesMenu(); track op.accion) {
                  <button
                    type="button"
                    class="btn btn-sm w-100 text-start px-3"
                    (click)="emitir(op.accion)"
                  >
                    <i class="bi me-2" [class]="op.icono"></i>{{ op.texto }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AttendanceMemberRowComponent {
  readonly item = input.required<PizarraItem>();
  readonly procesando = input(false);
  readonly puedeAjustar = input(false);
  readonly puedeAnular = input(false);
  readonly accion = output<SolicitudAccion>();

  protected readonly menuAbierto = signal(false);

  readonly accionPrincipal = computed(() => {
    const estado = this.item().estado;
    if (!estado || estado === 'PENDIENTE') {
      return { accion: 'entrada' as AccionFila, texto: 'Registrar entrada', icono: 'bi-box-arrow-in-right' };
    }
    if (estado === 'PRESENTE') {
      return { accion: 'salida' as AccionFila, texto: 'Registrar salida', icono: 'bi-box-arrow-right' };
    }
    return null;
  });

  readonly opcionesMenu = computed(() => {
    const estado = this.item().estado;
    const ops: { accion: AccionFila; texto: string; icono: string }[] = [];

    if (!estado || estado === 'PENDIENTE') {
      ops.push(
        { accion: 'hora-manual', texto: 'Registrar hora manual', icono: 'bi-clock-history' },
        { accion: 'falta-justificada', texto: 'Falta justificada', icono: 'bi-journal-medical' },
      );
    }
    if (estado === 'PRESENTE') {
      ops.push({ accion: 'salida-anticipada', texto: 'Salida anticipada', icono: 'bi-door-open' });
    }
    if (estado && ['PRESENTE', 'FINALIZADO', 'FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA', 'SALIDA_ANTICIPADA'].includes(estado)) {
      ops.push({ accion: 'observacion', texto: 'Agregar observación', icono: 'bi-chat-left-text' });
      if (this.puedeAjustar() && estado !== 'FALTA_JUSTIFICADA' && estado !== 'FALTA_INJUSTIFICADA') {
        ops.push({ accion: 'ajustar', texto: 'Modificar horas', icono: 'bi-pencil-square' });
      }
      if (this.puedeAnular()) {
        ops.push({ accion: 'anular', texto: 'Anular registro', icono: 'bi-x-circle' });
      }
    }
    return ops;
  });

  emitir(accion: AccionFila): void {
    this.menuAbierto.set(false);
    this.accion.emit({ accion, item: this.item() });
  }
}
