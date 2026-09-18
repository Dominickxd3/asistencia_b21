import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { CreatePersonaDto, UpdatePersonaDto } from './dto/persona.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('persons')
@ApiBearerAuth()
@Controller('persons')
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  @Get()
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  listar(
    @Query('q') q?: string,
    @Query('pagina', new DefaultValuePipe(1), ParseIntPipe) pagina?: number,
  ) {
    return this.persons.listar(q, pagina);
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
}
