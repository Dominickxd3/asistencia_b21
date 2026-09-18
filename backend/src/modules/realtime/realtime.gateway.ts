import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/services/token.service';
import { RealtimeService } from './realtime.service';

/**
 * Gateway WebSocket. La autenticacion usa el mismo access token JWT
 * que el frontend envia en handshake.auth.token.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200', credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly tokenService: TokenService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit() {
    this.realtime.registrarServidor(this.server);
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = this.tokenService.verificarAccessToken(token);
      client.data.usuarioId = payload.sub;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    // Nada especial: los eventos son broadcast simples
  }
}
