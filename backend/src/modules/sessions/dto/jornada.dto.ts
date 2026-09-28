import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HORA_REGEX } from '../../../common/utils/fecha.util';

export class CreateJornadaDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grupoId: number;

  @ApiProperty({ example: '2026-09-18' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha: string;

  @ApiProperty({ enum: ['OBLIGATORIA', 'VOLUNTARIA'] })
  @IsIn(['OBLIGATORIA', 'VOLUNTARIA'])
  tipoJornada: string;

  @ApiPropertyOptional({ enum: ['PROGRAMADA', 'EXTRAORDINARIA'], default: 'PROGRAMADA' })
  @IsOptional()
  @IsIn(['PROGRAMADA', 'EXTRAORDINARIA'])
  origen?: string;

  @ApiPropertyOptional({ example: '19:00' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'Hora inválida (formato HH:mm)' })
  horaInicio?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'Hora inválida (formato HH:mm)' })
  horaFin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
