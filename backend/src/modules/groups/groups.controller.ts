import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { AuthzService } from '../roles/authz.service';
import {
  AddMemberDto,
  AssignManagerDto,
  CambiarEstadoGrupoDto,
  CandidatosQueryDto,
  CreateGroupDto,
  FinalizarEncargadoDto,
  GruposQueryDto,
  ReactivarGrupoDto,
  RetirarIntegranteDto,
  UpdateGroupDto,
} from './dto/group.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

/**
 * Permisos (derivados de los roles del usuario):
 * - formation.view           → consultar grupos y su detalle
 * - formation.manage_groups  → crear, editar, cerrar/cancelar, eliminar, encargado e integrantes
 * - attendance.view_assigned_group → requisito para ser designado encargado
 */
@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly authz: AuthzService,
  ) {}

  @Get()
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  listar(@Query() query: GruposQueryDto) {
    return this.groups.listar(query.estado);
  }

  @Get('catalogos')
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  catalogos() {
    return this.groups.catalogos();
  }

  @Get('mi-grupo')
  @RequirePermissions(PermissionCode.ATTENDANCE_VIEW_GROUP)
  miGrupo(@CurrentUser() user: CurrentUserData) {
    return this.groups.grupoDelEncargado(user.id);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.groups.detalle(id);
  }

  @Get(':id/members')
  @RequirePermissions(PermissionCode.ATTENDANCE_VIEW)
  async miembros(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserData) {
    // Sin vista global, solo el encargado activo ve los integrantes de su grupo
    const vistaGlobal =
      (await this.authz.tienePermiso(user.id, PermissionCode.ATTENDANCE_VIEW_ALL)) ||
      (await this.authz.tienePermiso(user.id, PermissionCode.FORMATION_VIEW));
    if (!vistaGlobal) await this.groups.validarEncargadoActivo(user.id, id);
    return this.groups.integrantes(id);
  }

  /** Integrantes del grupo y usuarios habilitados que pueden ser su encargado */
  @Get(':id/candidatos-encargado')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  candidatosEncargado(@Param('id', ParseIntPipe) id: number) {
    return this.groups.candidatosEncargado(id);
  }

  @Get(':id/candidatos')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  candidatos(@Param('id', ParseIntPipe) id: number, @Query() query: CandidatosQueryDto) {
    return this.groups.candidatosIntegrante(id, query.q);
  }

  @Post()
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  crear(@Body() dto: CreateGroupDto, @CurrentUser() user: CurrentUserData) {
    return this.groups.crear(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.groups.actualizar(id, dto, user.id);
  }

  /** Cerrar (fin del periodo) o cancelar el grupo; conserva todo el historial */
  @Post(':id/estado')
  @HttpCode(200)
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoGrupoDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.groups.cambiarEstado(id, dto, user.id);
  }

  /** Vuelve a activar un grupo cerrado o cancelado */
  @Post(':id/reactivar')
  @HttpCode(200)
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  reactivar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReactivarGrupoDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.groups.reactivar(id, dto, user.id);
  }

  /** Solo grupos sin historia (creados por error) */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserData) {
    return this.groups.eliminar(id, user.id);
  }

  @Post(':id/managers')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  asignarEncargado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignManagerDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.groups.asignarEncargado(id, dto, user.id);
  }

  @Post(':id/managers/finalizar')
  @HttpCode(200)
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  finalizarEncargado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinalizarEncargadoDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.groups.finalizarEncargado(id, dto.motivo, user.id);
  }

  @Post(':id/members')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE, PermissionCode.FORMATION_MANAGE_GROUPS)
  agregarIntegrante(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.groups.agregarIntegrante(id, dto.personaId, user.id, dto.transferir ?? false);
  }

  @Post(':id/members/:personaId/retirar')
  @HttpCode(200)
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE, PermissionCode.FORMATION_MANAGE_GROUPS)
  retirarIntegrante(
    @Param('id', ParseIntPipe) id: number,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Body() dto: RetirarIntegranteDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.groups.retirarIntegrante(id, personaId, dto, user.id);
  }
}
