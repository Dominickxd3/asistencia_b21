import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PerfilUsuario } from '../models/api.models';
import { firstValueFrom } from 'rxjs';

/**
 * Auth state:
 * - El access token vive SOLO en memoria (nunca localStorage).
 * - El refresh token viaja en cookie HttpOnly (el navegador la envía solo).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth`;

  readonly perfil = signal<PerfilUsuario | null>(null);
  readonly autenticado = computed(() => this.perfil() !== null);
  readonly cargando = signal(true);

  private accessToken: string | null = null;

  get token(): string | null {
    return this.accessToken;
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ accessToken: string }>(`${this.base}/login`, { username, password }),
    );
    this.accessToken = res.accessToken;
    await this.cargarPerfil();
  }

  /** Restaura la sesión al recargar la página usando la cookie de refresh */
  async intentarRestaurar(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ accessToken: string }>(`${this.base}/refresh`, {}),
      );
      this.accessToken = res.accessToken;
      await this.cargarPerfil();
    } catch {
      this.accessToken = null;
      this.perfil.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.base}/logout`, {}));
    } finally {
      this.accessToken = null;
      this.perfil.set(null);
    }
  }

  tienePermiso(permiso: string): boolean {
    return this.perfil()?.permisos.includes(permiso) ?? false;
  }

  tieneRol(codigo: string): boolean {
    return this.perfil()?.roles.some((r) => r.codigo === codigo) ?? false;
  }

  private async cargarPerfil(): Promise<void> {
    const perfil = await firstValueFrom(this.http.get<PerfilUsuario>(`${this.base}/me`));
    this.perfil.set(perfil);
  }
}
