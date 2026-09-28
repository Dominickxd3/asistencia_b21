import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { verify } from 'argon2';
import { Sesion } from '../entities/sesion.entity';

@Injectable()
export class SesionesService implements OnModuleInit, OnModuleDestroy {
  private limpieza: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Sesion)
    private readonly sesionRepo: Repository<Sesion>,
    private readonly config: ConfigService,
  ) {}

  /** Minutos que vive una sesión sin renovarse: inactividad + 1 de margen */
  vidaMinutos(): number {
    return (this.config.get<number>('app.sesionInactividadMin') ?? 5) + 1;
  }

  onModuleInit(): void {
    void this.expirarVencidas().catch(() => undefined);
    this.limpieza = setInterval(() => void this.expirarVencidas().catch(() => undefined), 5 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.limpieza) clearInterval(this.limpieza);
  }

  async crear(params: {
    id: string;
    usuarioId: number;
    refreshTokenHash: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    const minutos = this.vidaMinutos();
    // REGLA: los timestamps los pone SQL Server (GETDATE).
    // El driver msnodesqlv8 desfasa los Date de JavaScript en la escritura.
    await this.sesionRepo.query(
      `INSERT INTO sesiones
         (sesion_id, usuario_id, refresh_token_hash, ip_address, user_agent,
          fecha_creacion, fecha_expiracion, fecha_revocacion, estado)
       VALUES (@0, @1, @2, @3, @4, GETDATE(), DATEADD(minute, @5, GETDATE()), NULL, 'ACTIVA')`,
      [
        params.id,
        params.usuarioId,
        params.refreshTokenHash,
        params.ip ?? null,
        params.userAgent ?? null,
        minutos,
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

  /**
   * Tras renovar, la sesión anterior no muere de inmediato: sigue valiendo unos
   * segundos. Si el navegador descarta la respuesta (el usuario recarga la página
   * mientras se renovaba), vuelve a enviar la cookie anterior y no pierde la sesión.
   * Cerrar sesión sí la revoca al instante (`revocar`).
   */
  async reemplazar(sesionId: string, graciaSegundos = 30): Promise<void> {
    await this.sesionRepo.query(
      `UPDATE sesiones
       SET fecha_expiracion = DATEADD(second, @1, GETDATE())
       WHERE sesion_id = @0 AND estado = 'ACTIVA'
         AND fecha_expiracion > DATEADD(second, @1, GETDATE())`,
      [sesionId, graciaSegundos],
    );
  }

  async revocar(sesionId: string): Promise<void> {
    await this.sesionRepo.query(
      `UPDATE sesiones
       SET estado = 'REVOCADA', fecha_revocacion = GETDATE()
       WHERE sesion_id = @0 AND estado = 'ACTIVA'`,
      [sesionId],
    );
  }

  /** Cierra la sesión en los demás equipos y conserva la actual */
  async revocarOtras(usuarioId: number, sesionActual: string | null): Promise<void> {
    await this.sesionRepo.query(
      `UPDATE sesiones
       SET estado = 'REVOCADA', fecha_revocacion = GETDATE()
       WHERE usuario_id = @0 AND estado = 'ACTIVA' AND (@1 IS NULL OR sesion_id <> @1)`,
      [usuarioId, sesionActual],
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
