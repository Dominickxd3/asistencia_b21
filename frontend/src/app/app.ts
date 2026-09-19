import { TuiRoot } from '@taiga-ui/core';
import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, TuiRoot],
  selector: 'app-root',
  template: '<tui-root tuiTheme="light"><router-outlet /></tui-root>',
})
export class App implements AfterViewInit, OnDestroy {
  private observer?: MutationObserver;
  private readonly hoy = this.fechaLocal(new Date());

  ngAfterViewInit(): void {
    this.aplicarLimite(document);
    this.observer = new MutationObserver((cambios) => cambios.forEach((cambio) =>
      cambio.addedNodes.forEach((nodo) => {
        if (nodo instanceof Element) this.aplicarLimite(nodo);
      }),
    ));
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  ngOnDestroy(): void { this.observer?.disconnect(); }

  private aplicarLimite(raiz: ParentNode): void {
    const inputs = raiz instanceof HTMLInputElement && raiz.type === 'date'
      ? [raiz]
      : Array.from(raiz.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    inputs.forEach((input) => {
      input.max = this.hoy;
      if (input.value > this.hoy) {
        input.value = this.hoy;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  private fechaLocal(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }
}
