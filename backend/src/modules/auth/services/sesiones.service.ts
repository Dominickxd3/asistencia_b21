import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { verify } from 'argon2';
import { Sesion } from '../entities/sesion.entity';

@Injectable()
export class SesionesService {
  constructor(
    @InjectRepository(Sesion)
    private readonly sesionRepo: Repository<Sesion>,
    private readonly config: ConfigService,
  ) {}

  async crear(params: {
    id: string;
    usuarioId: number;
    refreshTokenHash: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    const dias = this.config.get<number>('app.jwt.refreshTtlDays') ?? 7;
    // REGLA: los timestamps los pone SQL Server (GETDATE).
    // El driver msnodesqlv8 desfasa los Date de JavaScript en la escritura.
    await this.sesionRepo.query(
      `INSERT INTO sesiones
         (sesion_id, usuario_id, refresh_token_hash, ip_address, user_agent,
          fecha_creacion, fecha_expiracion, fecha_revocacion, estado)
       VALUES (@0, @1, @2, @3, @4, GETDATE(), DATEADD(day, @5, GETDATE()), NULL, 'ACTIVA')`,
      [
        params.id,
        params.usuarioId,
        params.refreshTokenHash,
        params.ip ?? null,
        params.userAgent ?? null,
        dias,
      ],
    );
  }

  async validar(sesionId: string, refreshToken: string): Promise<Sesion | null> {
    const rows: Sesion[] = await this.sesionRepo.query(
      `SELECT sesion_id AS id, usuario_id AS usuarioId, refresh_token_hash AS refreshTokenHash
       FROM sesiones
       WHERE sesion_id = @0 AND estado = 'ACTIVA' AND fecha_expiracion > GETDATE()`,
      [sesionId],
    );
    const sesion = rows[0];
    if (!sesion) return null;
    const coincide = await verify(sesion.refreshTokenHash, refreshToken);
    return coincide ? sesion : null;
  }

  async revocar(sesionId: string): Promise<void> {
    await this.sesionRepo.query(
      `UPDATE sesiones
       SET estado = 'REVOCADA', fecha_revocacion = GETDATE()
       WHERE sesion_id = @0 AND estado = 'ACTIVA'`,
      [sesionId],
    );
  }

  async revocarTodas(usuarioId: number): Promise<void> {
    await this.sesionRepo.query(
      `UPDATE sesiones
       SET estado = 'REVOCADA', fecha_revocacion = GETDATE()
       WHERE usuario_id = @0 AND estado = 'ACTIVA'`,
      [usuarioId],
    );
  }

  /** Marca como EXPIRADA las sesiones vencidas no revocadas (limpieza periodica) */
  async expirarVencidas(): Promise<void> {
    await this.sesionRepo.query(
      `UPDATE sesiones SET estado = 'EXPIRADA'
       WHERE estado = 'ACTIVA' AND fecha_expiracion <= GETDATE()`,
    );
  }
}
