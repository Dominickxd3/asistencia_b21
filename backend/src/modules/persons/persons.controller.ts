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
import { PersonsService } from './persons.service';
import {
  CambiarEstadoPersonaDto,
  CreatePersonaDto,
  ListarPersonasQueryDto,
  UpdatePersonaDto,
} from './dto/persona.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

/**
 * - formation.view          → listar, filtrar por grupo/etapa y ver fichas
 * - formation.manage_people → registrar, editar, desactivar/reactivar y eliminar
 */
@ApiTags('persons')
@ApiBearerAuth()
@Controller('persons')
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  @Get()
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  listar(@Query() query: ListarPersonasQueryDto) {
    return this.persons.listar(query);
  }

  /** Conteos por etapa e «Instrucción» (según el estado filtrado) y grupos activos */
  @Get('resumen')
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  resumen(@Query('estado') estado?: string) {
    return this.persons.resumen(estado);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.persons.obtener(id);
  }

  @Post()
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE)
  crear(@Body() dto: CreatePersonaDto, @CurrentUser() user: CurrentUserData) {
    return this.persons.crear(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonaDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.persons.actualizar(id, dto, user.id);
  }

  @Post(':id/estado')
  @HttpCode(200)
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPersonaDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.persons.cambiarEstado(id, dto, user.id);
  }

  /** Solo personas sin historia (registradas por error) */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE)
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserData) {
    return this.persons.eliminar(id, user.id);
  }
}
