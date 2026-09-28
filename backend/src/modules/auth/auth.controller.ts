import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './services/auth.service';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { Public } from './decorators/auth.decorators';
import { CurrentUser, CurrentUserData } from './decorators/current-user.decorator';
import { REFRESH_COOKIE } from '../../common/constants/auth.constants';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Con «trust proxy» configurado, req.ip ya es la IP real; X-Forwarded-For solo lo decide el proxy
    const ip = req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    const { accessToken, refreshToken } = await this.authService.login(
      dto.username,
      dto.password,
      ip,
      userAgent,
    );

    this.setRefreshCookie(res, refreshToken);
    return { accessToken, tokenType: 'Bearer' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new UnauthorizedException('Sesión inválida o expirada');

    // Con «trust proxy» configurado, req.ip ya es la IP real; X-Forwarded-For solo lo decide el proxy
    const ip = req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    const { accessToken, refreshToken: nuevoRefresh } = await this.authService.refresh(
      refreshToken,
      ip,
      userAgent,
    );

    this.setRefreshCookie(res, nuevoRefresh);
    return { accessToken, tokenType: 'Bearer' };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    let sesionId: string | undefined;
    if (refreshToken) {
      try {
        const payload = JSON.parse(
          Buffer.from(refreshToken.split('.')[1], 'base64').toString(),
        );
        sesionId = payload?.sid;
      } catch {
        sesionId = undefined;
      }
    }
    await this.authService.logout(sesionId, (req as any).user?.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  /** Cualquier usuario autenticado cambia su propia contraseña */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cambiar-password')
  @HttpCode(204)
  async cambiarPassword(
    @Body() dto: CambiarPasswordDto,
    @Req() req: Request,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.authService.cambiarPassword(user.id, dto.actual, dto.nueva, req.cookies?.[REFRESH_COOKIE]);
  }

  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() user: CurrentUserData) {
    return this.authService.perfil(user.id);
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    // La cookie vive lo mismo que la sesión: inactividad + 1 minuto
    const minutos = (this.config.get<number>('app.sesionInactividadMin') ?? 5) + 1;
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.config.get<boolean>('app.cookieSecure') ?? false,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: minutos * 60 * 1000,
    });
  }
}
