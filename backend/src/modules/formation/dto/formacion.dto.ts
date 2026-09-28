import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { FECHA_REGEX } from '../../../common/utils/fecha.util';

const ETAPAS = ['POSTULANTE', 'ASPIRANTE_COMPANIA', 'ASPIRANTE_ESBAS'];
const ESTADOS_ETAPA = ['ACTIVO', 'FINALIZADO', 'RETIRADO', 'SUSPENDIDO'];
const MSJ_FECHA = { message: 'La fecha debe tener el formato AAAA-MM-DD' };
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromoverDto {
  @ApiProperty({ description: 'Persona a promover' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personaId: number;

  @ApiProperty({ example: 'ASPIRANTE_COMPANIA', description: 'Código de la etapa destino' })
  @IsIn(ETAPAS, { message: 'Etapa destino no válida' })
  etapaDestino: string;

  @ApiPropertyOptional({ description: 'Grupo destino (si aplica)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grupoDestinoId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class CrearHistorialDto {
  @ApiProperty({ description: 'ID de la persona' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personaId: number;

  @ApiProperty({ description: 'ID de la etapa de formación' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  etapaId: number;

  @ApiPropertyOptional({ description: 'ID del grupo de formación' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grupoId?: number | null;

  @ApiProperty({ example: '2026-09-01', description: 'Fecha de inicio (YYYY-MM-DD)' })
  @Matches(FECHA_REGEX, MSJ_FECHA)
  fechaInicio: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha de fin (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(FECHA_REGEX, MSJ_FECHA)
  fechaFin?: string | null;

  @ApiProperty({ example: 'ACTIVO', description: 'Estado: ACTIVO | FINALIZADO | RETIRADO | SUSPENDIDO' })
  @IsIn(ESTADOS_ETAPA, { message: 'Estado no válido' })
  estado: string;

  @ApiPropertyOptional({ description: 'Observación o motivo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class ActualizarHistorialDto {
  @ApiPropertyOptional({ description: 'ID de la persona' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personaId?: number;

  @ApiPropertyOptional({ description: 'ID de la etapa' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  etapaId?: number;

  @ApiPropertyOptional({ description: 'ID del grupo' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grupoId?: number | null;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @Matches(FECHA_REGEX, MSJ_FECHA)
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(FECHA_REGEX, MSJ_FECHA)
  fechaFin?: string | null;

  @ApiPropertyOptional({ example: 'ACTIVO' })
  @IsOptional()
  @IsIn(ESTADOS_ETAPA, { message: 'Estado no válido' })
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

