import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';

class AuditQueryDto {
  @IsOptional() @IsString() modulo?: string;
  @IsOptional() @IsString() accion?: string;
  @IsOptional() @Type(() => Number) @IsInt() usuarioId?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) desde?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() pagina?: number;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  @RequirePermissions(PermissionCode.AUDIT_VIEW_FULL)
  async listar(@Query() filtros: AuditQueryDto) {
    const pagina = filtros.pagina ?? 1;
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtros.modulo) { condiciones.push('a.modulo = @' + params.length); params.push(filtros.modulo); }
    if (filtros.accion) { condiciones.push('a.accion = @' + params.length); params.push(filtros.accion); }
    if (filtros.usuarioId) { condiciones.push('a.usuario_id = @' + params.length); params.push(filtros.usuarioId); }
    if (filtros.desde) { condiciones.push('CAST(a.fecha_hora AS date) >= @' + params.length); params.push(filtros.desde); }
    if (filtros.hasta) { condiciones.push('CAST(a.fecha_hora AS date) <= @' + params.length); params.push(filtros.hasta); }

    const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
    const tamano = 25;
    const offset = (pagina - 1) * tamano;

    const [{ total }] = await this.ds.query(`SELECT COUNT(*) AS total FROM auditoria a ${where}`, params);
    const items = await this.ds.query(
      `SELECT a.auditoria_id AS id, a.usuario_id AS usuarioId,
              ISNULL(up.apellido_paterno + ' ' + up.nombres, 'Sistema') AS usuario,
              a.accion, a.modulo, a.entidad, a.entidad_id AS entidadId,
              a.valor_anterior_json AS valorAnterior, a.valor_nuevo_json AS valorNuevo,
              a.descripcion, a.ip_address AS ip, a.user_agent AS userAgent,
              a.fecha_hora AS fechaHora
       FROM auditoria a
       LEFT JOIN usuarios u ON u.usuario_id = a.usuario_id
       LEFT JOIN personas up ON up.persona_id = u.persona_id
       ${where}
       ORDER BY a.fecha_hora DESC
       OFFSET ${offset} ROWS FETCH NEXT ${tamano} ROWS ONLY`,
      params,
    );

    return { items, total, pagina, tamano };
  }
}
