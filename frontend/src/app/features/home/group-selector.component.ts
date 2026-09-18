import { Component, input, output } from '@angular/core';

export interface GroupTabItem {
  id: string;
  nombre: string;
  dotColor: string;
  subtitulo: string;
}

@Component({
  selector: 'app-group-selector',
  template: `
    <div class="r21-group-selector-bar" role="tablist" aria-label="Selector de grupos de formación">
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="grupoActivo() === tab.id"
          class="group-tab-btn"
          [class.active]="grupoActivo() === tab.id"
          (click)="seleccionarGrupo(tab.id)"
        >
          <div class="tab-top-row">
            <span class="tab-name">{{ tab.nombre }}</span>
            <span class="status-dot" [style.background-color]="tab.dotColor"></span>
          </div>
          <span class="tab-sub">{{ tab.subtitulo }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .r21-group-selector-bar {
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border);
      border-radius: var(--r21-radius-md);
      padding: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: var(--r21-shadow-sm);
    }

    .group-tab-btn {
      flex: 1;
      min-width: 0;
      padding: 8px 14px;
      border-radius: var(--r21-radius-sm);
      text-align: left;
      border: 1px solid transparent;
      border-left: 3px solid transparent;
      background: transparent;
      color: var(--r21-text-secondary);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: background-color var(--r21-transition-fast), color var(--r21-transition-fast), border-color var(--r21-transition-fast);

      &:hover:not(.active) {
        background-color: #F8F9FA;
        color: var(--r21-text-primary);
      }

      &.active {
        background-color: var(--r21-sidebar);
        color: #FFFFFF;
        border-left-color: var(--r21-red);

        .tab-name {
          color: #FFFFFF;
          font-weight: 700;
        }

        .tab-sub {
          color: #9AA0A8;
        }
      }
    }

    .tab-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      width: 100%;
    }

    .tab-name {
      font-family: var(--r21-font);
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: inherit;
    }

    .tab-sub {
      font-size: 11px;
      color: var(--r21-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    @media (max-width: 576px) {
      .r21-group-selector-bar {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `]
})
export class GroupSelectorComponent {
  readonly grupoActivo = input.required<string>();
  readonly grupoCambiado = output<string>();

  readonly tabs: GroupTabItem[] = [
    { id: 'postulantes', nombre: 'Postulantes 2026-II', dotColor: '#14804A', subtitulo: 'Formación inicial' },
    { id: 'aspirantes', nombre: 'Aspirantes Compañía', dotColor: '#B76E00', subtitulo: 'Módulos en cuartel' },
    { id: 'esbas', nombre: 'Aspirantes ESBAS', dotColor: '#667085', subtitulo: 'Habilitación nacional' },
  ];

  seleccionarGrupo(id: string): void {
    if (this.grupoActivo() !== id) {
      this.grupoCambiado.emit(id);
    }
  }
}
