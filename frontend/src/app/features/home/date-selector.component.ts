import { Component, computed, input, output } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-date-selector',
  imports: [FormsModule, TuiButton, TuiIcon],
  template: `
    <div class="r21-date-selector" aria-label="Control de fecha">
      <!-- Botón día anterior -->
      <button tuiIconButton appearance="flat" size="xs"
        type="button"
        class="nav-date-btn"
        (click)="cambiarDia(-1)"
        title="Día anterior"
        aria-label="Día anterior"
      >
        <tui-icon icon="@tui.chevron-left" />
      </button>

      <!-- Selector con p-calendar nativamente alineado -->
      <div class="calendar-picker-box">
        <tui-icon icon="@tui.calendar-days" class="date-lead-icon" />
        <input
          class="r21-calendar-text"
          type="date"
          [max]="hoyIso"
          [ngModel]="fechaIso()"
          (ngModelChange)="onIsoChange($event)"
          aria-label="Seleccionar fecha"
        />
      </div>

      <!-- Botón día siguiente -->
      <button tuiIconButton appearance="flat" size="xs"
        type="button"
        class="nav-date-btn"
        (click)="cambiarDia(1)"
        [disabled]="esHoy()"
        title="Día siguiente"
        aria-label="Día siguiente"
      >
        <tui-icon icon="@tui.chevron-right" />
      </button>

      <!-- Botón Hoy -->
      @if (!esHoy()) {
        <button tuiButton appearance="flat" size="xs"
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

      tui-icon {
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

    }

    .r21-calendar-text {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--r21-text-primary);
      background: transparent;
      border: 0;
      padding: 0;
      width: 112px;
      cursor: pointer;
      color-scheme: light;

      &:focus { outline: none; }
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
  readonly hoyIso = this.toIso(new Date());

  readonly esHoy = computed(() => {
    return this.fechaIso() === this.hoyIso;
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

  onIsoChange(iso: string): void {
    if (!iso) return;
    const [year, month, day] = iso.split('-').map(Number);
    this.emitirFecha(new Date(year, month - 1, day));
  }

  private emitirFecha(date: Date): void {
    const iso = this.toIso(date);
    if (iso > this.hoyIso) return;
    this.fechaSeleccionada.emit(iso);
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
