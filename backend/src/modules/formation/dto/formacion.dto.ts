import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
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

export class CorregirPromocionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  personaId: number;

  @ApiProperty({ description: 'Motivo obligatorio de la corrección' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}

export class ActualizarHistorialDto {
  @ApiPropertyOptional({ example: '2026-09-19' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2026-12-20', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaFin?: string | null;

  @ApiProperty({ description: 'Motivo u observación de la edición' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  observacion: string;
}
