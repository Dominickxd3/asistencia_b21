import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './services/auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/auth.decorators';
import { CurrentUser, CurrentUserData } from './decorators/current-user.decorator';
import { REFRESH_COOKIE } from '../../common/constants/auth.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadedImage } from './dto/uploaded-image.type';

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
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
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

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
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

  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() user: CurrentUserData) {
    return this.authService.perfil(user.id);
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Patch('me')
  @UseInterceptors(FileInterceptor('foto', {
    storage: memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  }))
  async actualizarPerfil(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() foto?: UploadedImage,
  ) {
    return this.authService.actualizarPerfil(user.id, dto, foto);
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const dias = this.config.get<number>('app.jwt.refreshTtlDays') ?? 7;
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.config.get<boolean>('app.cookieSecure') ?? false,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: dias * 24 * 60 * 60 * 1000,
    });
  }
}
