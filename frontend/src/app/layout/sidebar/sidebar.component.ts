import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MENU, MenuItem, ROL_SIDEBAR_NOMBRE } from '../menu.config';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="r21-sidebar" [class.desktop-sidebar]="isDesktop()">
      <!-- Cabecera Institucional -->
      <div class="r21-sidebar-brand">
        <img src="assets/brand/logo.svg" alt="Escudo Bomberos Rímac 21" class="brand-logo" />
        <div class="brand-info">
          <span class="org-name">Cía. de Bomberos<br />Rímac N.º 21</span>
          <span class="org-unit">Área de Instrucción</span>
        </div>
      </div>

      <!-- Navegación -->
      <nav class="r21-nav" aria-label="Navegación principal">
        @for (bloque of bloquesNavegacion(); track $index) {
          @if (bloque.seccion) {
            <div class="nav-section-title">{{ bloque.seccion }}</div>
          }
          @for (item of bloque.items; track item.ruta) {
            <a
              [routerLink]="item.ruta"
              routerLinkActive="active"
              class="r21-nav-link"
              (click)="cerrar.emit()"
            >
              <i [class]="item.icono"></i>
              <span>{{ item.etiqueta }}</span>
            </a>
          }
        }
      </nav>

      <!-- Pie: Usuario Activo y Salida -->
      @if (perfil(); as p) {
        <div class="r21-sidebar-footer">
          <div class="user-profile">
            <div class="user-name" [title]="p.persona.nombreCompleto">{{ p.persona.nombreCompleto }}</div>
            <div class="user-role">{{ cargoPrincipal() }}</div>
          </div>
          <button type="button" class="btn-logout" (click)="salir.emit()">
            <i class="pi pi-sign-out"></i>
            <span>Cerrar sesión</span>
          </button>
        </div>
      }
    </aside>
  `,
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);

  readonly isDesktop = input(true);
  readonly cerrar = output<void>();
  readonly salir = output<void>();

  readonly perfil = this.auth.perfil;

  readonly bloquesNavegacion = computed(() => {
    const visibles = MENU.filter((m) => !m.permiso || this.auth.tienePermiso(m.permiso));
    const bloques: { seccion: string; items: MenuItem[] }[] = [];
    for (const item of visibles) {
      const seccion = item.seccion ?? '';
      const ultimo = bloques[bloques.length - 1];
      if (ultimo && ultimo.seccion === seccion) {
        ultimo.items.push(item);
      } else {
        bloques.push({ seccion, items: [item] });
      }
    }
    return bloques;
  });

  cargoPrincipal(): string {
    const p = this.perfil();
    if (!p || p.roles.length === 0) return '';
    const prioridad = [
      'ADMIN_SISTEMA',
      'JEFE_INSTRUCCION',
      'SUBJEFE_INSTRUCCION',
      'ADJUNTO_INSTRUCCION',
      'ENCARGADO_GRUPO',
    ];
    const top = p.roles.map((r) => r.codigo).sort((a, b) => prioridad.indexOf(a) - prioridad.indexOf(b))[0];
    return ROL_SIDEBAR_NOMBRE[top] ?? top;
  }
}
