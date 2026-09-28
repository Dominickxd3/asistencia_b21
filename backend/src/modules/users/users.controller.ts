import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  ActualizarRolesDto,
  CambiarEstadoCuentaDto,
  CandidatosCuentaQueryDto,
  CrearUsuarioDto,
  RestablecerPasswordDto,
} from './dto/usuario.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

/** Cuentas y cargos del personal. Solo con users.manage (Administrador del sistema). */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@RequirePermissions(PermissionCode.USERS_MANAGE)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  listar() {
    return this.users.listar();
  }

  @Get('roles')
  roles() {
    return this.users.roles();
  }

  @Get('candidatos')
  candidatos(@Query() query: CandidatosCuentaQueryDto) {
    return this.users.candidatos(query.q);
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto, @CurrentUser() user: CurrentUserData) {
    return this.users.crear(dto, user.id);
  }

  @Put(':id/roles')
  actualizarRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarRolesDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.users.actualizarRoles(id, dto, user.id);
  }

  @Post(':id/restablecer-password')
  restablecerPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RestablecerPasswordDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.users.restablecerPassword(id, user.id, dto.password);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoCuentaDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.users.cambiarEstado(id, dto.estado, user.id);
  }
}
