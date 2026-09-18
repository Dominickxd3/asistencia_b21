import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PizarraItem, AccionFila, SolicitudAccion } from './attendance.models';

@Component({
  selector: 'app-attendance-member-row',
  imports: [DatePipe],
  template: `
    <div
      class="r21-attendance-row"
      [class.row-present]="item().estado === 'PRESENTE'"
      [class.row-pending]="!item().estado || item().estado === 'PENDIENTE'"
      [class.row-finished]="item().estado === 'FINALIZADO'"
      [class.row-incident]="esIncidencia()"
    >
      <!-- Columna 1: Avatar de Iniciales + Nombre + Metadatos de Hora -->
      <div class="member-identity-col">
        <div class="member-avatar" [class.avatar-present]="item().estado === 'PRESENTE'">
          {{ iniciales() }}
        </div>
        <div class="member-info-wrap">
          <div class="member-name-row">
            <span class="member-fullname">{{ item().nombreCompleto }}</span>
            <span class="mobile-tag-wrap">
              <span class="status-tag" [class]="'status-tag ' + tagConfig().cssClass">{{ tagConfig().label }}</span>
            </span>
          </div>

          <!-- Metadatos de Horarios y Registro -->
          <div class="member-meta-line">
            @if (item().fechaHoraEntrada) {
              <span class="time-stamp">
                <i class="pi pi-clock"></i>
                Entrada {{ item().fechaHoraEntrada | date: 'HH:mm' }}
              </span>
              @if (item().fechaHoraSalida) {
                <span class="meta-sep">·</span>
                <span class="time-stamp">Salida {{ item().fechaHoraSalida | date: 'HH:mm' }}</span>
              }
              @if (item().tipoRegistro === 'MANUAL') {
                <span class="meta-sep">·</span>
                <span class="meta-pill">Manual</span>
              }
            } @else if (!item().estado || item().estado === 'PENDIENTE') {
              <span class="meta-pending">Sin registro</span>
            }

            @if (item().observacion) {
              <span class="meta-sep">·</span>
              <span class="meta-obs" [title]="item().observacion">{{ item().observacion }}</span>
            }
          </div>
        </div>
      </div>

      <!-- Columna 2: Tag de Estado (Visible en Desktop) -->
      <div class="desktop-tag-col">
        <span class="status-tag" [class]="'status-tag ' + tagConfig().cssClass">{{ tagConfig().label }}</span>
      </div>

      <!-- Columna 3: Acción Principal Visible + Menú Contextual -->
      <div class="member-actions-col">
        @if (accionPrincipal(); as ap) {
          <button
            type="button"
            [class]="'btn-main-action ' + ap.clase"
            [disabled]="procesando()"
            (click)="emitir(ap.accion)"
          >{{ procesando() ? 'Procesando…' : ap.texto }}</button>
        }

        <!-- Botón de Acciones Secundarias (Menú Contextual) -->
        @if (menuItems().length > 0) {
          <button
            type="button"
            class="btn-context-menu"
            (click)="menuAbierto.set(!menuAbierto())"
            [disabled]="procesando()"
            title="Más acciones"
            aria-label="Más acciones"
          >⋮</button>
          @if (menuAbierto()) {<div class="context-menu">@for (opcion of menuItems(); track opcion.label) {@if (opcion.separator) {<hr>} @else {<button type="button" [class.danger]="opcion.danger" (click)="ejecutarMenu(opcion)">{{ opcion.label }}</button>}}</div>}
        }
      </div>
    </div>
  `,
  styles: [`
    .r21-attendance-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 16px;
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border-subtle);
      border-radius: var(--r21-radius-sm);
      transition: background-color var(--r21-transition-fast), border-color var(--r21-transition-fast);

      &:hover {
        background-color: #FAFAFA;
        border-color: #D0D5DD;
      }

      &.row-present {
        border-left: 3px solid var(--r21-green);
      }

      &.row-pending {
        border-left: 3px solid #D0D5DD;
      }

      &.row-finished {
        border-left: 3px solid #667085;
      }

      &.row-incident {
        border-left: 3px solid var(--r21-amber);
      }
    }

    .member-identity-col {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    .member-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background-color: #F2F4F7;
      color: var(--r21-text-secondary);
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid var(--r21-border);

      &.avatar-present {
        background-color: #ECFDF3;
        color: var(--r21-green);
        border-color: #A6F4C5;
      }
    }

    .member-info-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .member-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .member-fullname {
      font-size: 14px;
      font-weight: 650;
      color: var(--r21-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mobile-tag-wrap {
      display: none;
    }

    .desktop-tag-col {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      min-width: 110px;
    }

    .member-meta-line {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 12px;
      color: var(--r21-text-secondary);
    }

    .time-stamp {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      color: var(--r21-text-primary);
      font-variant-numeric: tabular-nums;

      i {
        font-size: 11px;
        color: var(--r21-text-muted);
      }
    }

    .meta-pending {
      color: var(--r21-text-muted);
      font-size: 11.5px;
    }

    .meta-pill {
      background-color: #F2F4F7;
      color: var(--r21-text-secondary);
      font-size: 10.5px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
    }

    .meta-obs {
      color: var(--r21-amber);
      font-style: italic;
      font-size: 11.5px;
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta-sep {
      color: #D0D5DD;
    }

    .member-actions-col {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn-main-action {
      min-width: 145px;
      font-weight: 600;
      font-size: 12.5px;
    }

    .btn-context-menu {
      color: var(--r21-text-secondary);
      width: 32px;
      height: 32px;

      &:hover {
        background-color: #F2F4F7;
        color: var(--r21-text-primary);
      }
    }

    .status-tag{display:inline-flex;padding:4px 8px;border-radius:99px;font-size:11px;font-weight:700}
      .r21-tag-success {
        background-color: #ECFDF3;
        color: var(--r21-green);
        border: 1px solid #A6F4C5;
      }

      .r21-tag-warning {
        background-color: #FEF0C7;
        color: #B76E00;
        border: 1px solid #FEDF89;
      }

      .r21-tag-neutral {
        background-color: #F2F4F7;
        color: #475467;
        border: 1px solid #EAECF0;
      }

      .r21-tag-danger {
        background-color: #FEF3F2;
        color: #B42318;
        border: 1px solid #FECDCA;
      }
    .btn-main-action{min-height:34px;border:1px solid #d0d5dd;border-radius:8px;padding:0 12px;background:#fff;font-weight:650}.btn-success{background:#087443;color:#fff;border-color:#087443}.member-actions-col{position:relative}.context-menu{position:absolute;z-index:20;right:0;top:38px;width:190px;padding:5px;background:#fff;border:1px solid #e4e7ec;border-radius:9px;box-shadow:0 10px 24px #10182824}.context-menu button{width:100%;border:0;background:transparent;padding:8px 10px;text-align:left;border-radius:6px}.context-menu button:hover{background:#f2f4f7}.context-menu button.danger{color:#b42318}.context-menu hr{border:0;border-top:1px solid #eaecf0}

    /* Móvil: Adaptación a Card Compacta */
    @media (max-width: 767.98px) {
      .r21-attendance-row {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding: 14px;
      }

      .desktop-tag-col {
        display: none;
      }

      .mobile-tag-wrap {
        display: inline-flex;
      }

      .member-actions-col {
        justify-content: flex-end;
        padding-top: 8px;
        border-top: 1px solid var(--r21-border-subtle);

        .btn-main-action {
          flex: 1;
        }
      }
    }
  `]
})
export class AttendanceMemberRowComponent {
  readonly menuAbierto = signal(false);
  readonly item = input.required<PizarraItem>();
  readonly procesando = input(false);
  readonly puedeAjustar = input(false);
  readonly puedeAnular = input(false);
  readonly accion = output<SolicitudAccion>();

  protected readonly iniciales = computed(() => {
    const partes = (this.item().nombreCompleto || '').trim().split(/\s+/);
    if (partes.length === 0 || !partes[0]) return '—';
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  });

  protected readonly esIncidencia = computed(() => {
    const e = this.item().estado;
    return e === 'FALTA_JUSTIFICADA' || e === 'SALIDA_ANTICIPADA' || e === 'FALTA_INJUSTIFICADA';
  });

  protected readonly tagConfig = computed<{
    label: string;
    severity: 'success' | 'info' | 'warning' | 'danger' | 'secondary';
    cssClass: string;
  }>(() => {
    const e = this.item().estado;
    switch (e) {
      case 'PRESENTE':
        return { label: 'Presente', severity: 'success', cssClass: 'r21-tag-success' };
      case 'FINALIZADO':
        return { label: 'Finalizado', severity: 'info', cssClass: 'r21-tag-neutral' };
      case 'FALTA_JUSTIFICADA':
        return { label: 'Falta justificada', severity: 'warning', cssClass: 'r21-tag-warning' };
      case 'SALIDA_ANTICIPADA':
        return { label: 'Salida anticipada', severity: 'warning', cssClass: 'r21-tag-warning' };
      case 'FALTA_INJUSTIFICADA':
        return { label: 'Falta', severity: 'danger', cssClass: 'r21-tag-danger' };
      case 'ANULADO':
        return { label: 'Anulado', severity: 'secondary', cssClass: 'r21-tag-neutral' };
      case 'PENDIENTE':
      default:
        return { label: 'Pendiente', severity: 'warning', cssClass: 'r21-tag-warning' };
    }
  });

  protected readonly accionPrincipal = computed(() => {
    const estado = this.item().estado;
    if (!estado || estado === 'PENDIENTE') {
      return {
        accion: 'entrada' as AccionFila,
        texto: 'Registrar entrada',
        icono: 'pi pi-sign-in',
        clase: 'btn-success',
      };
    }
    if (estado === 'PRESENTE') {
      return {
        accion: 'salida' as AccionFila,
        texto: 'Registrar salida',
        icono: 'pi pi-sign-out',
        clase: 'btn-secondary',
      };
    }
    return null;
  });

  protected readonly menuItems = computed<Array<{label?:string; separator?:boolean; danger?:boolean; command?:()=>void}>>(() => {
    const estado = this.item().estado;
    const items: Array<{ label?: string; separator?: boolean; danger?: boolean; command?: () => void }> = [];

    if (!estado || estado === 'PENDIENTE') {
      items.push(
        {
          label: 'Registrar hora manual',
          command: () => this.emitir('hora-manual'),
        },
        {
          label: 'Falta justificada',
          command: () => this.emitir('falta-justificada'),
        },
      );
    }

    if (estado === 'PRESENTE') {
      items.push({
        label: 'Salida anticipada',
        command: () => this.emitir('salida-anticipada'),
      });
    }

    if (
      estado &&
      ['PRESENTE', 'FINALIZADO', 'FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA', 'SALIDA_ANTICIPADA'].includes(estado)
    ) {
      items.push({
        label: 'Agregar observación',
        command: () => this.emitir('observacion'),
      });

      if (this.puedeAjustar() && estado !== 'FALTA_JUSTIFICADA' && estado !== 'FALTA_INJUSTIFICADA') {
        items.push({
          label: 'Modificar horas',
          command: () => this.emitir('ajustar'),
        });
      }

      if (this.puedeAnular()) {
        items.push({
          separator: true,
        });
        items.push({
          label: 'Anular registro',
          danger: true,
          command: () => this.emitir('anular'),
        });
      }
    }

    return items;
  });

  emitir(accion: AccionFila): void {
    this.menuAbierto.set(false);
    this.accion.emit({ accion, item: this.item() });
  }

  ejecutarMenu(item: {command?:()=>void}): void { this.menuAbierto.set(false); item.command?.(); }
}
