import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto, AssignManagerDto, AddMemberDto } from './dto/group.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  listar() {
    return this.groups.listar();
  }

  @Get('mi-grupo')
  @RequirePermissions(PermissionCode.ATTENDANCE_VIEW_GROUP)
  miGrupo(@CurrentUser() user: CurrentUserData) {
    return this.groups.grupoDelEncargado(user.id);
  }

  @Get(':id/members')
  @RequirePermissions(PermissionCode.ATTENDANCE_VIEW)
  miembros(@Param('id', ParseIntPipe) id: number) {
    return this.groups.integrantes(id);
  }

  @Post()
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  crear(@Body() dto: CreateGroupDto, @CurrentUser() user: CurrentUserData) {
    return this.groups.crear(dto, user.id);
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

  @Post(':id/members')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE, PermissionCode.FORMATION_MANAGE_GROUPS)
  agregarIntegrante(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.groups.agregarIntegrante(id, dto.personaId, user.id);
  }
}
