import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromoverDto {
  @ApiProperty({ description: 'Persona a promover' })
  @Type(() => Number)
  @IsInt()
  personaId: number;

  @ApiProperty({ example: 'ASPIRANTE_COMPANIA', description: 'Código de la etapa destino' })
  @IsString()
  @IsNotEmpty()
  etapaDestino: string;

  @ApiPropertyOptional({ description: 'Grupo destino (si aplica)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
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
  personaId: number;

  @ApiProperty({ description: 'ID de la etapa de formación' })
  @Type(() => Number)
  @IsInt()
  etapaId: number;

  @ApiPropertyOptional({ description: 'ID del grupo de formación' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  grupoId?: number | null;

  @ApiProperty({ example: '2026-09-01', description: 'Fecha de inicio (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  fechaInicio: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha de fin (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaFin?: string | null;

  @ApiProperty({ example: 'ACTIVO', description: 'Estado: ACTIVO | FINALIZADO | RETIRADO | SUSPENDIDO' })
  @IsString()
  @IsNotEmpty()
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
  personaId?: number;

  @ApiPropertyOptional({ description: 'ID de la etapa' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  etapaId?: number;

  @ApiPropertyOptional({ description: 'ID del grupo' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  grupoId?: number | null;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  fechaFin?: string | null;

  @ApiPropertyOptional({ example: 'ACTIVO' })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

