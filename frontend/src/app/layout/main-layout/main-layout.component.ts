import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiDrawer } from '@taiga-ui/kit';
import { AuthService } from '../../core/auth/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, TuiButton, TuiDrawer, TuiIcon],
  template: `
    <!-- Barra superior compacta (exclusiva para móvil y tablet) -->
    <header class="r21-mobile-bar" aria-label="Cabecera móvil">
      <div class="mobile-brand">
        <img src="assets/brand/logo.svg" alt="Escudo Rímac 21" />
        <span>Rímac 21 · Instrucción</span>
      </div>
      <button tuiIconButton appearance="flat"
        type="button"
        class="btn-toggle-menu"
        (click)="drawerVisible.set(true)"
        aria-label="Abrir menú de navegación"
      >
        <tui-icon icon="@tui.menu" />
      </button>
    </header>

    <!-- Drawer móvil con p-sidebar de PrimeNG -->
    @if (drawerVisible()) {
      <button class="drawer-backdrop" aria-label="Cerrar menú" (click)="drawerVisible.set(false)"></button>
      <tui-drawer direction="start" class="r21-mobile-drawer">
        <app-sidebar
          [isDesktop]="false"
          (cerrar)="drawerVisible.set(false)"
          (salir)="cerrarSesion()"
        />
      </tui-drawer>
    }

    <!-- Layout principal -->
    <div class="r21-layout">
      <!-- Sidebar Desktop estático (240px) -->
      <app-sidebar
        [isDesktop]="true"
        (cerrar)="drawerVisible.set(false)"
        (salir)="cerrarSesion()"
      />

      <!-- Área de Contenido Principal (Fluida) -->
      <div class="r21-main-area">
        <main class="r21-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .drawer-backdrop { position: fixed; inset: 0; z-index: 1040; border: 0; background: rgba(10, 14, 20, .56); }
    .r21-mobile-drawer { z-index: 1050; padding: 0; }
  `],
})
export class MainLayoutComponent {
  protected readonly drawerVisible = signal(false);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async cerrarSesion(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
