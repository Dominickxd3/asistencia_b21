import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeoDto {
  @ApiProperty()
  @IsNumber()
  latitud: number;

  @ApiProperty()
  @IsNumber()
  longitud: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  precisionMetros?: number;
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
  @Matches(/^\d{2}:\d{2}$/)
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
  @Matches(/^\d{2}:\d{2}$/)
  horaEntrada?: string;

  @ApiPropertyOptional({ example: '21:30' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
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

export class ScanQrDto {
  @ApiProperty({ description: 'Código QR, DNI o identificador de la persona' })
  @IsString()
  @IsNotEmpty()
  qrCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

