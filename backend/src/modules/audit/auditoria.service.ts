import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from './entities/auditoria.entity';

export interface AuditContexto {
  usuarioId?: number | null;
  accion: string;
  modulo: string;
  entidad?: string;
  entidadId?: string | number | null;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  descripcion?: string;
  ip?: string | null;
  userAgent?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

/** Bitacora append-only. Los errores de auditoria no rompen la operacion. */
@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepo: Repository<Auditoria>,
  ) {}

  async registrar(ctx: AuditContexto): Promise<void> {
    try {
      await this.auditoriaRepo.save(
        this.auditoriaRepo.create({
          usuarioId: ctx.usuarioId ?? null,
          accion: ctx.accion,
          modulo: ctx.modulo,
          entidad: ctx.entidad ?? null,
          entidadId: ctx.entidadId != null ? String(ctx.entidadId) : null,
          valorAnteriorJson: ctx.valorAnterior !== undefined ? JSON.stringify(ctx.valorAnterior) : null,
          valorNuevoJson: ctx.valorNuevo !== undefined ? JSON.stringify(ctx.valorNuevo) : null,
          descripcion: ctx.descripcion ?? null,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          latitud: ctx.latitud ?? null,
          longitud: ctx.longitud ?? null,
        }),
      );
    } catch (err) {
      console.error('Error al registrar auditoria:', (err as Error).message);
    }
  }
}
