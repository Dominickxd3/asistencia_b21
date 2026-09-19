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
      [class.row-pending]="!voluntaria() && (!item().estado || item().estado === 'PENDIENTE')"
      [class.row-finished]="item().estado === 'FINALIZADO'"
      [class.row-incident]="esIncidencia()"
    >
      <!-- Columna 1: Avatar de Iniciales + Nombre + Metadatos de Hora -->
      <div class="member-identity-col col-member">
        <div
          class="member-avatar"
          [class.avatar-present]="item().estado === 'PRESENTE'"
          (click)="emitir('ver-qr')"
          title="Ver carnet con código QR de {{ item().nombreCompleto }}"
          role="button"
          tabindex="0"
        >
          {{ iniciales() }}
        </div>
        <div class="member-info-wrap">
          <div class="member-name-row">
            <span class="member-fullname">{{ item().nombreCompleto }}</span>
            <span class="mobile-tag-wrap">
              <span class="status-tag" [class]="'status-tag ' + tagConfig().cssClass">{{ tagConfig().label }}</span>
            </span>
          </div>

          <!-- Observación operativa -->
          <div class="member-meta-line">
            @if (item().observacion) {
              <span class="meta-obs" [title]="item().observacion">{{ item().observacion }}</span>
            } @else if (item().tipoRegistro === 'MANUAL') {
              <span class="meta-pill">Registro manual</span>
            }
          </div>
        </div>
      </div>

      <div class="attendance-data-col col-time" data-label="Entrada">{{ item().fechaHoraEntrada ? (item().fechaHoraEntrada | date: 'HH:mm') : '—' }}</div>
      <div class="attendance-data-col col-time" data-label="Salida">{{ item().fechaHoraSalida ? (item().fechaHoraSalida | date: 'HH:mm') : '—' }}</div>
      <div class="attendance-data-col duration-col col-duration" data-label="Duración">{{ duracion() }}</div>

      <!-- Columna 2: Tag de Estado (Visible en Desktop) -->
      <div class="desktop-tag-col col-status">
        <span class="status-tag" [class]="'status-tag ' + tagConfig().cssClass">{{ tagConfig().label }}</span>
      </div>

      <!-- Columna 3: Acción Principal Visible + Menú Contextual -->
      <div class="member-actions-col col-actions">
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
      display: grid;
      grid-template-columns: var(--attendance-grid-cols, minmax(260px, 1fr) 100px 100px 105px 145px 160px);
      align-items: center;
      gap: var(--attendance-grid-gap, 16px);
      padding: var(--attendance-grid-padding, 12px 20px);
      background-color: var(--r21-surface);
      border: 0;
      border-right: 1px solid var(--r21-border);
      border-bottom: 1px solid var(--r21-border);
      border-left: 1px solid var(--r21-border);
      border-radius: 0;
      transition: background-color var(--r21-transition-fast), border-color var(--r21-transition-fast);

      &:hover {
        background-color: #FAFAFA;
        border-color: #D0D5DD;
      }

      &.row-present {
        border-left: 1px solid var(--r21-border);
      }

      &.row-pending {
        border-left: 1px solid var(--r21-border);
      }

      &.row-finished {
        border-left: 1px solid var(--r21-border);
      }

      &.row-incident {
        border-left: 1px solid var(--r21-border);
      }
    }

    :host { display: block; }
    :host:last-child .r21-attendance-row { border-radius: 0 0 10px 10px; }

    .attendance-data-col {
      color: var(--r21-text-primary);
      font-size: 13px;
      font-weight: 550;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }

    .duration-col {
      color: var(--r21-text-secondary);
      font-size: 12px;
      text-align: center;
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
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

      &:hover {
        transform: scale(1.08);
        border-color: #C8102E;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.15);
      }

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
      width: 100%;
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
      justify-content: flex-end;
      position: relative;
    }

    .btn-main-action {
      min-width: 92px;
      height: 32px;
      padding: 0 12px;
      font-weight: 600;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
    }

    .btn-context-menu {
      color: var(--r21-text-secondary);
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid var(--r21-border);
      background: #FFFFFF;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      flex-shrink: 0;
      transition: background-color var(--r21-transition-fast), border-color var(--r21-transition-fast);

      &:hover {
        background-color: #F2F4F7;
        color: var(--r21-text-primary);
        border-color: #D0D5DD;
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
    @media (max-width: 1050px) {
      .r21-attendance-row {
        grid-template-columns: repeat(3, 1fr);
        align-items: stretch;
        gap: 12px;
        padding: 14px;
        margin-bottom: 8px;
        border: 1px solid var(--r21-border);
        border-radius: 9px;
      }

      .desktop-tag-col {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-start;
      }

      .member-identity-col { grid-column: 1 / -1; }
      .attendance-data-col { display: flex; flex-direction: column; gap: 2px; }
      .attendance-data-col::before { content: attr(data-label); color: var(--r21-text-muted); font-size: 9px; font-weight: 700; text-transform: uppercase; }

      .mobile-tag-wrap {
        display: none;
      }

      .member-actions-col {
        grid-column: 1 / -1;
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
  readonly voluntaria = input(false);
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

  protected readonly duracion = computed(() => {
    const entrada = this.item().fechaHoraEntrada;
    if (!entrada) return '—';
    const fin = this.item().fechaHoraSalida ? new Date(this.item().fechaHoraSalida!) : new Date();
    const minutos = Math.max(0, Math.floor((fin.getTime() - new Date(entrada).getTime()) / 60000));
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return horas > 0 ? `${horas}h ${resto}m` : `${resto} min`;
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
        return this.voluntaria()
          ? { label: 'Sin participación', severity: 'secondary', cssClass: 'r21-tag-neutral' }
          : { label: 'Pendiente', severity: 'warning', cssClass: 'r21-tag-warning' };
    }
  });

  protected readonly accionPrincipal = computed(() => {
    const estado = this.item().estado;
    if (!estado || estado === 'PENDIENTE') {
      return {
        accion: 'entrada' as AccionFila,
        texto: 'Entrada',
        icono: 'pi pi-sign-in',
        clase: 'btn-success',
      };
    }
    if (estado === 'PRESENTE') {
      return {
        accion: 'salida' as AccionFila,
        texto: 'Salida',
        icono: 'pi pi-sign-out',
        clase: 'btn-secondary',
      };
    }
    return null;
  });

  protected readonly menuItems = computed<Array<{label?:string; separator?:boolean; danger?:boolean; command?:()=>void}>>(() => {
    const estado = this.item().estado;
    const items: Array<{ label?: string; separator?: boolean; danger?: boolean; command?: () => void }> = [];

    // 1. FINALIZADO: Agregar observación, Corregir horario, Ver carnet / QR, [separador], Anular asistencia
    if (estado === 'FINALIZADO') {
      items.push({
        label: 'Agregar observación',
        command: () => this.emitir('observacion'),
      });
      if (this.puedeAjustar()) {
        items.push({
          label: 'Corregir horario',
          command: () => this.emitir('ajustar'),
        });
      }
      items.push({
        label: 'Ver carnet / QR',
        command: () => this.emitir('ver-qr'),
      });
      if (this.puedeAnular()) {
        items.push({ separator: true });
        items.push({
          label: 'Anular asistencia',
          danger: true,
          command: () => this.emitir('anular'),
        });
      }
      return items;
    }

    // 2. PRESENTE: Agregar observación, Registrar salida anticipada, Corregir hora de entrada, Ver carnet / QR, [separador], Anular asistencia
    if (estado === 'PRESENTE') {
      items.push({
        label: 'Agregar observación',
        command: () => this.emitir('observacion'),
      });
      items.push({
        label: 'Registrar salida anticipada',
        command: () => this.emitir('salida-anticipada'),
      });
      if (this.puedeAjustar()) {
        items.push({
          label: 'Corregir hora de entrada',
          command: () => this.emitir('ajustar'),
        });
      }
      items.push({
        label: 'Ver carnet / QR',
        command: () => this.emitir('ver-qr'),
      });
      if (this.puedeAnular()) {
        items.push({ separator: true });
        items.push({
          label: 'Anular asistencia',
          danger: true,
          command: () => this.emitir('anular'),
        });
      }
      return items;
    }

    // 3. SIN REGISTRO EN JORNADA OBLIGATORIA: Registrar hora manual, Falta justificada, Agregar observación, Ver carnet / QR
    if ((!estado || estado === 'PENDIENTE') && !this.voluntaria()) {
      items.push({
        label: 'Registrar hora manual',
        command: () => this.emitir('hora-manual'),
      });
      items.push({
        label: 'Falta justificada',
        command: () => this.emitir('falta-justificada'),
      });
      items.push({
        label: 'Agregar observación',
        command: () => this.emitir('observacion'),
      });
      items.push({
        label: 'Ver carnet / QR',
        command: () => this.emitir('ver-qr'),
      });
      return items;
    }

    // 4. SIN REGISTRO EN JORNADA VOLUNTARIA: Registrar hora manual, Agregar observación, Ver carnet / QR
    if ((!estado || estado === 'PENDIENTE') && this.voluntaria()) {
      items.push({
        label: 'Registrar hora manual',
        command: () => this.emitir('hora-manual'),
      });
      items.push({
        label: 'Agregar observación',
        command: () => this.emitir('observacion'),
      });
      items.push({
        label: 'Ver carnet / QR',
        command: () => this.emitir('ver-qr'),
      });
      return items;
    }

    // 5. INCIDENCIAS REGISTRADAS
    if (estado && ['FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA', 'SALIDA_ANTICIPADA'].includes(estado)) {
      items.push({
        label: 'Agregar observación',
        command: () => this.emitir('observacion'),
      });
      items.push({
        label: 'Ver carnet / QR',
        command: () => this.emitir('ver-qr'),
      });
      if (this.puedeAnular()) {
        items.push({ separator: true });
        items.push({
          label: 'Anular asistencia',
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
