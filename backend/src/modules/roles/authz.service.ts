import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../users/entities/usuario.entity';
import { PERMISSIONS_CACHE_TTL_MS } from '../../common/constants/auth.constants';

interface PermisosCacheEntry {
  permisos: Set<string>;
  expira: number;
}

/**
 * Resuelve permisos reales de un usuario desde la BD.
 * El JWT solo identifica; la autorizacion se valida aqui.
 * Cache en memoria de 30s por usuario (invalidable al cambiar roles/permisos).
 */
@Injectable()
export class AuthzService implements OnModuleDestroy {
  private cache = new Map<number, PermisosCacheEntry>();

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async obtenerPermisos(usuarioId: number): Promise<Set<string>> {
    const hit = this.cache.get(usuarioId);
    if (hit && hit.expira > Date.now()) {
      return hit.permisos;
    }

    const rows: { codigo: string }[] = await this.usuarioRepo.query(
      `SELECT DISTINCT p.codigo
       FROM usuario_roles ur
       JOIN roles r ON r.rol_id = ur.rol_id AND r.estado = 'ACTIVO'
       JOIN rol_permisos rp ON rp.rol_id = r.rol_id
       JOIN permisos p ON p.permiso_id = rp.permiso_id AND p.estado = 'ACTIVO'
       WHERE ur.usuario_id = @0
         AND ur.estado = 'ACTIVO'
         AND (ur.fecha_fin IS NULL OR ur.fecha_fin >= CAST(GETDATE() AS date))`,
      [usuarioId],
    );

    const permisos = new Set(rows.map((r) => r.codigo));
    this.cache.set(usuarioId, { permisos, expira: Date.now() + PERMISSIONS_CACHE_TTL_MS });
    return permisos;
  }

  async tienePermiso(usuarioId: number, permiso: string): Promise<boolean> {
    const permisos = await this.obtenerPermisos(usuarioId);
    return permisos.has(permiso);
  }

  /** Invalida la cache cuando cambian roles/permisos de un usuario */
  invalidar(usuarioId: number): void {
    this.cache.delete(usuarioId);
  }

  invalidarTodo(): void {
    this.cache.clear();
  }

  onModuleDestroy() {
    this.cache.clear();
  }
}
