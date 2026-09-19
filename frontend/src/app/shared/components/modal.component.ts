import { Component, input, output } from '@angular/core';

/** Envoltorio de diálogo modal institucional (sin JS de Bootstrap). */
@Component({
  selector: 'app-modal',
  template: `
    @if (visible()) {
      <div class="r21-modal-backdrop" (click)="cerrar.emit()"></div>
      <div class="r21-modal-wrap" role="dialog" aria-modal="true">
        <div class="r21-modal" (click)="$event.stopPropagation()">
          <div class="r21-modal-header">
            <h3>{{ titulo() }}</h3>
            <button type="button" class="btn-close" aria-label="Cerrar" (click)="cerrar.emit()"></button>
          </div>
          <div class="r21-modal-body">
            <ng-content />
          </div>
          <div class="r21-modal-footer">
            <ng-content select="[acciones]" />
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .r21-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 3000;
      background: rgba(15, 23, 42, .38);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .r21-modal-wrap {
      position: fixed;
      inset: 0;
      z-index: 3001;
      display: grid;
      place-items: center;
      padding: 24px;
      overflow-y: auto;
    }

    .r21-modal {
      width: min(560px, 100%);
      max-height: calc(100dvh - 48px);
      overflow: hidden;
      background: #fff;
      color: var(--r21-text-primary);
      border: 1px solid var(--r21-border);
      border-radius: 14px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
      animation: modal-in 150ms ease-out;
    }

    .r21-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 17px 20px;
      border-bottom: 1px solid var(--r21-border);
    }

    .r21-modal-header h3 { margin: 0; font-size: 17px; }
    .btn-close { width: 32px; height: 32px; border: 0; border-radius: 7px; background: #f2f4f7; cursor: pointer; }
    .btn-close::before { content: '×'; color: #475467; font-size: 21px; line-height: 1; }
    .r21-modal-body { max-height: calc(100dvh - 190px); padding: 20px; overflow-y: auto; }
    .r21-modal-footer:has(*) { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--r21-border); }
    .r21-modal-footer:not(:has(*)) { display: none; }

    @keyframes modal-in { from { opacity: 0; transform: translateY(8px) scale(.985); } }
    @media (max-width: 600px) {
      .r21-modal-wrap { align-items: end; padding: 12px; }
      .r21-modal { width: 100%; max-height: calc(100dvh - 24px); border-radius: 14px; }
    }
  `],
})
export class ModalComponent {
  readonly titulo = input.required<string>();
  readonly visible = input(false);
  readonly cerrar = output<void>();
}
