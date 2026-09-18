import { IsIn, IsInt, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TRACKING_ORDER = [
  'faltas_injustificadas',
  'menor_asistencia',
  'salidas_anticipadas',
  'horas',
] as const;

export type TrackingOrder = (typeof TRACKING_ORDER)[number];

export class TrackingQueryDto {
  @ApiProperty({ description: 'Grupo de formación' })
  @Type(() => Number)
  @IsInt()
  grupoId: number;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'YYYY-MM-DD, por defecto inicio de mes' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  hasta?: string;

  @ApiPropertyOptional({ enum: TRACKING_ORDER, default: 'faltas_injustificadas' })
  @IsOptional()
  @IsIn(TRACKING_ORDER as unknown as string[])
  orden?: TrackingOrder;
}
