import { Component, computed, input, output } from '@angular/core';
import { CalendarModule } from 'primeng/calendar';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-date-selector',
  imports: [CalendarModule, FormsModule],
  template: `
    <div class="r21-date-selector" aria-label="Control de fecha">
      <!-- Botón día anterior -->
      <button
        type="button"
        class="nav-date-btn"
        (click)="cambiarDia(-1)"
        title="Día anterior"
        aria-label="Día anterior"
      >
        <i class="pi pi-chevron-left"></i>
      </button>

      <!-- Selector con p-calendar nativamente alineado -->
      <div class="calendar-picker-box">
        <i class="pi pi-calendar date-lead-icon"></i>
        <p-calendar
          [(ngModel)]="fechaModel"
          (ngModelChange)="onCalendarChange($event)"
          dateFormat="dd M yy"
          [showIcon]="false"
          styleClass="r21-calendar-control"
          inputStyleClass="r21-calendar-text"
        />
        <i class="pi pi-chevron-down date-trail-icon"></i>
      </div>

      <!-- Botón día siguiente -->
      <button
        type="button"
        class="nav-date-btn"
        (click)="cambiarDia(1)"
        title="Día siguiente"
        aria-label="Día siguiente"
      >
        <i class="pi pi-chevron-right"></i>
      </button>

      <!-- Botón Hoy -->
      @if (!esHoy()) {
        <button
          type="button"
          class="btn-today-pill"
          (click)="irAHoy()"
        >
          Hoy
        </button>
      }
    </div>
  `,
  styles: [`
    .r21-date-selector {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 3px 6px;
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-md);
      box-shadow: var(--r21-shadow-sm);
    }

    .nav-date-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: var(--r21-radius-sm);
      color: var(--r21-text-secondary);
      cursor: pointer;
      transition: background-color var(--r21-transition-fast), color var(--r21-transition-fast);

      i {
        font-size: 11px;
      }

      &:hover {
        background-color: #F3F4F6;
        color: var(--r21-text-primary);
      }
    }

    .calendar-picker-box {
      position: relative;
      display: inline-flex;
      align-items: center;
      background-color: #FAFAFA;
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-sm);
      padding: 0 8px;
      height: 30px;
      transition: border-color var(--r21-transition-fast), background-color var(--r21-transition-fast);

      &:hover {
        background-color: #FFFFFF;
        border-color: #D0D5DD;
      }

      .date-lead-icon {
        font-size: 12px;
        color: var(--r21-red);
        margin-right: 6px;
        flex-shrink: 0;
      }

      .date-trail-icon {
        font-size: 10px;
        color: var(--r21-text-muted);
        margin-left: 6px;
        flex-shrink: 0;
      }
    }

    :host ::ng-deep .r21-calendar-control {
      display: inline-flex;
      align-items: center;

      .r21-calendar-text {
        font-family: var(--r21-font);
        font-size: 12.5px;
        font-weight: 600;
        color: var(--r21-text-primary);
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        width: 105px !important;
        text-align: center;
        cursor: pointer;
        font-variant-numeric: tabular-nums;
        box-shadow: none !important;

        &:focus {
          outline: none !important;
        }
      }
    }

    .btn-today-pill {
      font-family: var(--r21-font);
      font-size: 11.5px;
      font-weight: 600;
      color: var(--r21-red);
      background-color: var(--r21-red-light);
      border: none;
      border-radius: var(--r21-radius-sm);
      padding: 4px 10px;
      cursor: pointer;
      margin-left: 4px;
      transition: background-color var(--r21-transition-fast);

      &:hover {
        background-color: #F8D7DA;
      }
    }
  `]
})
export class DateSelectorComponent {
  readonly fechaIso = input.required<string>();
  readonly fechaSeleccionada = output<string>();

  fechaModel: Date = new Date();

  readonly esHoy = computed(() => {
    const hoyStr = new Date().toISOString().slice(0, 10);
    return this.fechaIso() === hoyStr;
  });

  ngOnChanges(): void {
    const iso = this.fechaIso();
    if (iso) {
      const parts = iso.split('-');
      if (parts.length === 3) {
        this.fechaModel = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
  }

  cambiarDia(delta: number): void {
    const d = new Date(this.fechaModel);
    d.setDate(d.getDate() + delta);
    this.emitirFecha(d);
  }

  irAHoy(): void {
    const hoy = new Date();
    this.emitirFecha(hoy);
  }

  onCalendarChange(date: Date): void {
    if (date) {
      this.emitirFecha(date);
    }
  }

  private emitirFecha(date: Date): void {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${day}`;
    this.fechaSeleccionada.emit(iso);
  }
}
