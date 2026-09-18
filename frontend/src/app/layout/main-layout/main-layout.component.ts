import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarModule } from 'primeng/sidebar';
import { AuthService } from '../../core/auth/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, SidebarModule],
  template: `
    <!-- Barra superior compacta (exclusiva para móvil y tablet) -->
    <header class="r21-mobile-bar" aria-label="Cabecera móvil">
      <div class="mobile-brand">
        <img src="assets/brand/logo.svg" alt="Escudo Rímac 21" />
        <span>Rímac 21 · Instrucción</span>
      </div>
      <button
        type="button"
        class="btn-toggle-menu"
        (click)="drawerVisible.set(true)"
        aria-label="Abrir menú de navegación"
      >
        <i class="pi pi-bars"></i>
      </button>
    </header>

    <!-- Drawer móvil con p-sidebar de PrimeNG -->
    <p-sidebar
      [visible]="drawerVisible()"
      (visibleChange)="drawerVisible.set($event)"
      [baseZIndex]="1050"
      [showCloseIcon]="true"
      styleClass="r21-mobile-drawer"
    >
      <app-sidebar
        [isDesktop]="false"
        (cerrar)="drawerVisible.set(false)"
        (salir)="cerrarSesion()"
      />
    </p-sidebar>

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
