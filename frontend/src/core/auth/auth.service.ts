import { useSyncExternalStore } from 'react';
import { environment } from '../../environments/environment';
import { http } from '../http/http';
import type { PerfilUsuario } from '../models/api.models';

interface EstadoAuth {
  perfil: PerfilUsuario | null;
  cargando: boolean;
}

/**
 * Auth state:
 * - El access token vive SOLO en memoria (nunca localStorage).
 * - El refresh token viaja en cookie HttpOnly (el navegador la envía solo).
 */
class AuthService {
  private readonly base = `${environment.apiUrl}/auth`;
  private estado: EstadoAuth = { perfil: null, cargando: true };
  private readonly oyentes = new Set<() => void>();
  private accessToken: string | null = null;

  get token(): string | null {
    return this.accessToken;
  }

  get perfil(): PerfilUsuario | null {
    return this.estado.perfil;
  }

  get autenticado(): boolean {
    return this.estado.perfil !== null;
  }

  readonly suscribir = (oyente: () => void): (() => void) => {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  };

  readonly instantanea = (): EstadoAuth => this.estado;

  async login(username: string, password: string): Promise<void> {
    const res = await http.post<{ accessToken: string }>(`${this.base}/login`, {
      username,
      password,
    });
    this.accessToken = res.accessToken;
    await this.cargarPerfil();
  }

  /** Restaura la sesión al recargar la página usando la cookie de refresh */
  async intentarRestaurar(): Promise<void> {
    try {
      const res = await http.post<{ accessToken: string }>(`${this.base}/refresh`, {});
      this.accessToken = res.accessToken;
      await this.cargarPerfil();
    } catch {
      this.accessToken = null;
      this.actualizar({ perfil: null });
    } finally {
      this.actualizar({ cargando: false });
    }
  }

  async logout(): Promise<void> {
    try {
      await http.post(`${this.base}/logout`, {});
    } finally {
      this.accessToken = null;
      this.actualizar({ perfil: null });
    }
  }

  tienePermiso(permiso: string): boolean {
    return this.estado.perfil?.permisos.includes(permiso) ?? false;
  }

  tieneRol(codigo: string): boolean {
    return this.estado.perfil?.roles.some((r) => r.codigo === codigo) ?? false;
  }

  private async cargarPerfil(): Promise<void> {
    const perfil = await http.get<PerfilUsuario>(`${this.base}/me`);
    this.actualizar({ perfil });
  }

  private actualizar(cambios: Partial<EstadoAuth>): void {
    this.estado = { ...this.estado, ...cambios };
    this.oyentes.forEach((o) => o());
  }
}

export const authService = new AuthService();

/** Estado de sesión reactivo para componentes. */
export function useAuth() {
  const { perfil, cargando } = useSyncExternalStore(authService.suscribir, authService.instantanea);
  return {
    perfil,
    cargando,
    autenticado: perfil !== null,
    tienePermiso: (permiso: string) => perfil?.permisos.includes(permiso) ?? false,
  };
}
