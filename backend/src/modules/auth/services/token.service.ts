import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'argon2';
import { randomBytes, randomUUID } from 'crypto';

export interface AccessPayload {
  sub: number;
  username: string;
}

export interface RefreshPayload {
  sub: number;
  sid: string;
}

type Ttl = `${number}${'s' | 'm' | 'h' | 'd'}`;

/**
 * Emision y verificacion de tokens.
 * - Access token: JWT corto, solo identifica al usuario.
 * - Refresh token: opaco + firma JWT; en BD se guarda SOLO el hash (argon2).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  generarAccessToken(payload: AccessPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('app.jwt.accessSecret'),
      expiresIn: (this.config.get<string>('app.jwt.accessTtl') ?? '15m') as Ttl,
    });
  }

  verificarAccessToken(token: string): AccessPayload {
    return this.jwt.verify(token, {
      secret: this.config.getOrThrow<string>('app.jwt.accessSecret'),
    });
  }

  generarRefreshToken(usuarioId: number, sesionId: string): string {
    const payload: RefreshPayload = { sub: usuarioId, sid: sesionId };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('app.jwt.refreshSecret'),
      expiresIn: `${this.config.get<number>('app.jwt.refreshTtlDays') ?? 7}d`,
    });
  }

  verificarRefreshToken(token: string): RefreshPayload {
    return this.jwt.verify(token, {
      secret: this.config.getOrThrow<string>('app.jwt.refreshSecret'),
    });
  }

  nuevaSesionId(): string {
    return randomUUID();
  }

  async hashearRefreshToken(token: string): Promise<string> {
    return hash(token);
  }

  generarSecreto(): string {
    return randomBytes(48).toString('hex');
  }
}
