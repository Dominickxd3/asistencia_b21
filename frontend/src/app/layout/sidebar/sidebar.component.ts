import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TuiButton, TuiDropdown, TuiIcon } from '@taiga-ui/core';
import { AuthService } from '../../core/auth/auth.service';
import { MENU, MenuItem, ROL_SIDEBAR_NOMBRE } from '../menu.config';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TuiButton, TuiDropdown, TuiIcon],
  template: `
    <aside class="r21-sidebar" [class.desktop-sidebar]="isDesktop()" [class.collapsed]="isDesktop() && colapsado()">
      <!-- Cabecera Institucional -->
      <div class="r21-sidebar-brand">
        <img src="assets/brand/logo.svg" alt="Escudo Bomberos Rímac 21" class="brand-logo" />
        <div class="brand-info">
          <span class="org-name">Cía. de Bomberos<br />Rímac N.º 21</span>
          <span class="org-unit">Área de Instrucción</span>
        </div>
        @if (isDesktop()) {
          <button
            tuiIconButton
            appearance="flat"
            size="xs"
            type="button"
            class="sidebar-toggle"
            [attr.aria-label]="colapsado() ? 'Expandir menú' : 'Contraer menú'"
            (click)="colapsado.update(value => !value)"
          >
            <tui-icon [icon]="colapsado() ? '@tui.chevron-right' : '@tui.chevron-left'" />
          </button>
        }
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
              [attr.title]="colapsado() ? item.etiqueta : null"
              (click)="cerrar.emit()"
            >
              <tui-icon [icon]="item.icono" />
              <span>{{ item.etiqueta }}</span>
            </a>
          }
        }
      </nav>

      <!-- Pie: Usuario Activo y Salida -->
      @if (perfil(); as p) {
        <div class="r21-sidebar-footer">
          <button
            type="button"
            class="user-summary"
            [tuiDropdown]="profileMenu"
            [tuiDropdownOpen]="perfilAbierto()"
            (tuiDropdownOpenChange)="perfilAbierto.set($event)"
            [attr.title]="colapsado() ? p.persona.nombreCompleto : null"
            aria-label="Abrir opciones de usuario"
          >
            <span class="user-avatar" aria-hidden="true">
              @if (fotoUsuarioUrl()) {
                <img [src]="fotoUsuarioUrl()" alt="" />
              } @else {
                {{ inicialesUsuario() }}
              }
            </span>
            <div class="user-profile">
              <div class="user-name" [title]="p.persona.nombreCompleto">{{ p.persona.nombreCompleto }}</div>
              <div class="user-role">{{ cargoPrincipal() }}</div>
            </div>
            <tui-icon class="user-menu-chevron" [icon]="perfilAbierto() ? '@tui.chevron-down' : '@tui.chevron-up'" />
          </button>
          <ng-template #profileMenu>
            <div class="profile-menu">
              <a
                tuiButton
                appearance="flat"
                size="s"
                class="profile-menu-action profile-menu-settings"
                routerLink="/perfil"
                (click)="perfilAbierto.set(false)"
              >
                <tui-icon icon="@tui.settings" />
                Configuración
              </a>
              <button tuiButton appearance="flat" size="s" type="button" class="profile-menu-action" (click)="cerrarSesionDesdeMenu()">
                <tui-icon icon="@tui.log-out" />
                Cerrar sesión
              </button>
            </div>
          </ng-template>
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
  readonly colapsado = signal(false);
  readonly perfilAbierto = signal(false);
  readonly fotoUsuarioUrl = computed(() => {
    const ruta = this.perfil()?.persona.fotoUrl;
    return ruta ? `${environment.apiUrl.replace(/\/api\/?$/, '')}${ruta}` : null;
  });

  readonly inicialesUsuario = computed(() => {
    const persona = this.perfil()?.persona;
    if (!persona) return 'U';
    return `${persona.nombres?.[0] ?? ''}${persona.apellidoPaterno?.[0] ?? ''}`.toUpperCase();
  });

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

  cerrarSesionDesdeMenu(): void {
    this.perfilAbierto.set(false);
    this.salir.emit();
  }

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
