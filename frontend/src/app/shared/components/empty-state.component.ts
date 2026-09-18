import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  imports: [RouterLink],
  template: `
    <div class="r21-empty-state" [class.compact]="compacto()">
      <div class="empty-icon-wrap">
        <i [class]="icono()"></i>
      </div>
      <div class="empty-content">
        <span class="empty-title">{{ mensaje() }}</span>
        @if (descripcion()) {
          <span class="empty-desc">{{ descripcion() }}</span>
        }
      </div>
      @if (accionTexto() && accionRuta()) {
        <a [routerLink]="accionRuta()" class="empty-action">
          {{ accionTexto() }} <i class="pi pi-arrow-right"></i>
        </a>
      }
    </div>
  `,
  styles: [`
    .r21-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px 16px;
      min-height: 120px;
      gap: 8px;
      color: var(--r21-text-secondary);
      background-color: #FAFAFA;
      border: 1px dashed var(--r21-border);
      border-radius: var(--r21-radius-md);
      transition: background-color var(--r21-transition-fast);

      &.compact {
        padding: 16px 12px;
        min-height: 90px;
        flex-direction: row;
        gap: 12px;
        text-align: left;
        justify-content: flex-start;

        .empty-icon-wrap {
          margin-bottom: 0;
        }

        .empty-content {
          display: flex;
          flex-direction: column;
        }
      }
    }

    .empty-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: var(--r21-surface);
      border: 1px solid var(--r21-border);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      i {
        font-size: 16px;
        color: var(--r21-text-muted);
      }
    }

    .empty-title {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--r21-text-primary);
      display: block;
    }

    .empty-desc {
      font-size: 12px;
      color: var(--r21-text-secondary);
      margin-top: 2px;
      display: block;
    }

    .empty-action {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--r21-red);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;

      &:hover {
        color: var(--r21-red-dark);
        text-decoration: underline;
      }
    }
  `]
})
export class EmptyStateComponent {
  readonly mensaje = input.required<string>();
  readonly descripcion = input<string>('');
  readonly icono = input<string>('pi pi-inbox');
  readonly compacto = input<boolean>(false);
  readonly accionTexto = input<string>('');
  readonly accionRuta = input<string>('');
}
