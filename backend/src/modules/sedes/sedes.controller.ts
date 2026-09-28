import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SedesService } from "./sedes.service";
import {
  BuscarDireccionQueryDto,
  ConfigSedeDto,
  CrearSedeDto,
  GeocercaDto,
  RegistrosGeograficosQueryDto,
} from "./dto/sede.dto";
import { GeoDto } from "../attendance/dto/asistencia.dto";
import { RequirePermissions } from "../auth/decorators/auth.decorators";
import { PermissionCode } from "../../common/constants/permissions.constants";
import {
  CurrentUser,
  CurrentUserData,
} from "../auth/decorators/current-user.decorator";

@ApiTags("sedes")
@ApiBearerAuth()
@Controller("sedes")
export class SedesController {
  constructor(private readonly sedes: SedesService) {}

  /** Movimientos fuera de la sede o con precisión insuficiente (auditoría) */
  @Get("registros-geograficos")
  @RequirePermissions(PermissionCode.AUDIT_VIEW_FULL)
  registrosGeograficos(@Query() query: RegistrosGeograficosQueryDto) {
    return this.sedes.registrosGeograficos(query);
  }

  /** Búsqueda explícita del usuario mediante Nominatim / OpenStreetMap. */
  @Get("buscar-direcciones")
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  buscarDirecciones(@Query() query: BuscarDireccionQueryDto) {
    return this.sedes.buscarDirecciones(query.q);
  }

  @Get()
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  listar() {
    return this.sedes.listar();
  }

  @Get(":id")
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  obtener(@Param("id", ParseIntPipe) id: number) {
    return this.sedes.obtener(id);
  }

  @Post()
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  crear(@Body() dto: CrearSedeDto, @CurrentUser() user: CurrentUserData) {
    return this.sedes.crear(dto, user.id);
  }

  @Patch(":id")
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  actualizar(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ConfigSedeDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.sedes.actualizar(id, dto, user.id);
  }

  @Put(":id/geocerca")
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  guardarGeocerca(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: GeocercaDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.sedes.guardarGeocerca(id, dto.vertices, user.id);
  }

  /** Prueba una ubicación contra la geocerca sin registrar asistencia */
  @Post(":id/evaluar")
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  evaluar(@Param("id", ParseIntPipe) id: number, @Body() geo: GeoDto) {
    return this.sedes.evaluarPunto(id, geo);
  }
}
