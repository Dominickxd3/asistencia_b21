import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerarReporteDto {
  @ApiPropertyOptional({ enum: ['PDF', 'EXCEL'], default: 'PDF' })
  @IsOptional()
  @IsIn(['PDF', 'EXCEL'])
  formato: 'PDF' | 'EXCEL' = 'PDF';

  @ApiProperty({ enum: ['ESTADO_GENERAL', 'DETALLE_INDIVIDUAL', 'JORNADA'] })
  @IsIn(['ESTADO_GENERAL', 'DETALLE_INDIVIDUAL', 'JORNADA'])
  tipo: string;

  @ApiProperty({ example: '2026-09-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desde: string;

  @ApiProperty({ example: '2026-09-30' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  hasta: string;

  @ApiPropertyOptional({ type: [Number], description: 'Grupos del consolidado (obligatorio en ESTADO_GENERAL)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  grupoIds: number[] = [];

  @ApiPropertyOptional({ description: 'Solo para DETALLE_INDIVIDUAL' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personaId?: number;

  @ApiPropertyOptional({ description: 'Solo para JORNADA' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  jornadaId?: number;
}
