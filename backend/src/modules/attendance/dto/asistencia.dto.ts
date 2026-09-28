import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HORA_REGEX } from '../../../common/utils/fecha.util';

/** Ubicación del dispositivo al ejecutar la acción (Geolocation API del navegador) */
export class GeoDto {
  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud: number;

  @ApiPropertyOptional({ description: 'Precisión reportada (radio de confianza en metros)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precisionMetros?: number;

  @ApiPropertyOptional({ description: 'Hora de captura del dispositivo (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  capturadoEn?: string;
}

export class RegistrarEntradaDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  jornadaId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  personaId: number;

  @ApiPropertyOptional({ description: 'Geolocalización del dispositivo que registra' })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

export class RegistrarQrDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  jornadaId: number;

  @ApiProperty({ description: 'Contenido completo leído desde la credencial QR' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  codigoQr: string;

  @ApiPropertyOptional({ enum: ['ENTRADA', 'SALIDA', 'AUTO'], default: 'AUTO' })
  @IsOptional()
  @IsString()
  accion?: 'ENTRADA' | 'SALIDA' | 'AUTO';

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

export class RotarQrDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  grupoId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  personaId: number;
}

export class RegistrarSalidaDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  asistenciaId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

export class RegistrarManualDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  jornadaId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  personaId: number;

  @ApiProperty({ example: '19:15', description: 'Hora manual de entrada (requiere motivo)' })
  @Matches(HORA_REGEX, { message: 'Hora inválida (formato HH:mm)' })
  horaEntrada: string;

  @ApiProperty({ description: 'Motivo obligatorio del registro manual' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

export class AjustarManualDto {
  @ApiPropertyOptional({ example: '19:10' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'Hora inválida (formato HH:mm)' })
  horaEntrada?: string;

  @ApiPropertyOptional({ example: '21:30' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'Hora inválida (formato HH:mm)' })
  horaSalida?: string;

  @ApiProperty({ description: 'Motivo obligatorio de la modificación' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

export class ObservacionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  observacion: string;
}

export class FaltaJustificadaDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  jornadaId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  personaId: number;

  @ApiProperty({ example: 'Cita médica' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

export class SalidaAnticipadaDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  asistenciaId: number;

  @ApiProperty({ example: 'Emergencia familiar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

export class AnularDto {
  @ApiProperty({ description: 'Motivo obligatorio de la anulación' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}
