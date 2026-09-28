import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Namespace, Socket } from 'socket.io';
import { TokenService } from '../auth/services/token.service';
import { AuthzService } from '../roles/authz.service';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { RealtimeService, SALA_TODOS, salaGrupo } from './realtime.service';

/** Cada cuánto se revalidan cuentas y salas de los sockets abiertos */
const REVALIDAR_MS = 5 * 60 * 1000;

/**
 * Gateway WebSocket. Autentica con el mismo access token JWT (handshake.auth.token)
 * y ubica cada socket en salas según su alcance: quien ve todos los grupos entra a
 * SALA_TODOS; un encargado solo a la sala de los grupos que encarga. Así nadie
 * recibe eventos de un grupo que no puede consultar.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:4200').split(',').map((o) => o.trim()),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  server: Namespace;

  private temporizador: NodeJS.Timeout | null = null;

  constructor(
    private readonly tokenService: TokenService,
    private readonly authz: AuthzService,
    private readonly realtime: RealtimeService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  afterInit() {
    this.realtime.registrarServidor(this.server);
    this.temporizador = setInterval(() => void this.revalidarTodos(), REVALIDAR_MS);
  }

  onModuleDestroy() {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return void client.disconnect(true);
      const payload = this.tokenService.verificarAccessToken(token);
      client.data.usuarioId = payload.sub;
      await this.asignarSalas(client);
    } catch {
      client.disconnect(true);
    }
  }

  /** Recalcula las salas del socket; lo desconecta si la cuenta ya no está activa */
  private async asignarSalas(client: Socket): Promise<void> {
    const usuarioId = Number(client.data.usuarioId);
    const [cuenta] = await this.ds.query(
      `SELECT 1 AS ok FROM usuarios WHERE usuario_id = @0 AND estado_cuenta = 'ACTIVA'`,
      [usuarioId],
    );
    if (!cuenta) return void client.disconnect(true);

    const salas: string[] = [];
    if (await this.authz.tienePermiso(usuarioId, PermissionCode.ATTENDANCE_VIEW_ALL)) {
      salas.push(SALA_TODOS);
    } else {
      const grupos: { grupoId: number }[] = await this.ds.query(
        `SELECT grupo_id AS grupoId FROM grupo_encargados WHERE usuario_id = @0 AND estado = 'ACTIVO'`,
        [usuarioId],
      );
      salas.push(...grupos.map((g) => salaGrupo(g.grupoId)));
    }

    for (const sala of client.rooms) {
      if (sala !== client.id && !salas.includes(sala)) await client.leave(sala);
    }
    await client.join(salas);
  }

  /** Cambios de cargo o de encargado se reflejan sin esperar a que el cliente reconecte */
  private async revalidarTodos(): Promise<void> {
    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      const client = this.server.sockets.get(s.id);
      if (client) await this.asignarSalas(client).catch(() => client.disconnect(true));
    }
  }
}
