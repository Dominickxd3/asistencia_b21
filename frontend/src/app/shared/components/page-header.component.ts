import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <header class="r21-page-header">
      <div class="header-main">
        <div class="title-row">
          <h1 class="r21-page-title">{{ titulo() }}</h1>
          @if (subtitulo()) {
            <span class="header-subtitulo">{{ subtitulo() }}</span>
          }
        </div>
        @if (descripcion()) {
          <p class="header-descripcion">{{ descripcion() }}</p>
        }
      </div>
      <div class="header-actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: [`
    .r21-page-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      padding-bottom: 4px;
    }

    .title-row {
      display: flex;
      align-items: baseline;
      gap: 14px;
      flex-wrap: wrap;
    }

    .header-subtitulo {
      font-size: 14px;
      font-weight: 500;
      color: var(--r21-text-secondary);
      text-transform: capitalize;
    }

    .header-descripcion {
      margin: 4px 0 0;
      font-size: 13.5px;
      color: var(--r21-text-secondary);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  `]
})
export class PageHeaderComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>('');
  readonly descripcion = input<string>('');
}
