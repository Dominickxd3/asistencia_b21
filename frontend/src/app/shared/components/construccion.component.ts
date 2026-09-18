import { Component } from '@angular/core';
import { PageHeaderComponent } from './page-header.component';
import { TuiIcon } from '@taiga-ui/core';

/** Placeholder de módulo en construcción (Fase 2+). */
@Component({
  selector: 'app-construccion',
  imports: [PageHeaderComponent, TuiIcon],
  template: `
    <app-page-header titulo="Módulo en construcción" />
    <div class="r21-card r21-card-body p-5 text-center text-muted">
      <tui-icon icon="@tui.wrench" style="font-size: 28px" />
      <div class="mt-2">Este módulo se implementará en la siguiente fase.</div>
    </div>
  `,
})
export class ConstruccionComponent {}
