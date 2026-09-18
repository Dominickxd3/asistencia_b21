import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerarReporteDto {
  @ApiProperty({ enum: ['ESTADO_GENERAL', 'DETALLE_INDIVIDUAL', 'JORNADA'] })
  @IsIn(['ESTADO_GENERAL', 'DETALLE_INDIVIDUAL', 'JORNADA'])
  tipo: string;

  @ApiProperty({ example: '2026-09-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desde: string;

  @ApiProperty({ example: '2026-09-30' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  hasta: string;

  @ApiProperty({ type: [Number], description: 'Grupos incluidos en el consolidado' })
  @IsInt({ each: true })
  grupoIds: number[];

  @ApiPropertyOptional({ description: 'Solo para DETALLE_INDIVIDUAL' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  personaId?: number;

  @ApiPropertyOptional({ description: 'Solo para JORNADA' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  jornadaId?: number;
}
