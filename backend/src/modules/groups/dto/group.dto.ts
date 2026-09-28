import {
  IsBoolean,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  Max,
  Min,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { HORA_REGEX } from '../../../common/utils/fecha.util';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class HorarioObligatorioDto {
  @ApiProperty({ minimum: 1, maximum: 7, description: '1=lunes, ..., 7=domingo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  diaSemana: number;

  @ApiProperty({ example: '19:30' })
  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio: string;
}

export class CreateGroupDto {
  @ApiProperty({ description: 'Id de etapa_formacion (1=Postulante, 2=Aspirante, 3=ESBAS)' })
  @Type(() => Number)
  @IsInt()
  etapaId: number;

  @ApiProperty({ example: 'ASP-2026-II' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/, {
    message: 'El código solo admite letras, números, punto, guion y guion bajo (sin espacios)',
  })
  codigo: string;

  @ApiProperty({ example: 'Aspirantes 2026-II' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({ example: '2026-II' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  periodo: string;

  @ApiProperty({ example: '2026-08-03' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaInicio debe tener formato AAAA-MM-DD' })
  fechaInicio: string;

  @ApiPropertyOptional({ example: '2026-12-20', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaFin debe tener formato AAAA-MM-DD' })
  fechaFin?: string | null;

  @ApiPropertyOptional({
    type: [HorarioObligatorioDto],
    description: 'Días y horas obligatorias. Solo aplica a Postulantes y Aspirantes de compañía.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique((item: HorarioObligatorioDto) => item.diaSemana, {
    message: 'No se puede repetir un día obligatorio',
  })
  @ValidateNested({ each: true })
  @Type(() => HorarioObligatorioDto)
  programacionObligatoria?: HorarioObligatorioDto[];
}

/** Todos los campos son opcionales; la etapa solo cambia si el grupo aún no tiene historia */
export class UpdateGroupDto extends PartialType(CreateGroupDto) {}

export class CambiarEstadoGrupoDto {
  @ApiProperty({ enum: ['CERRADO', 'CANCELADO'] })
  @IsIn(['CERRADO', 'CANCELADO'])
  estado: 'CERRADO' | 'CANCELADO';

  @ApiProperty({ example: 'Fin del periodo de instrucción' })
  @Transform(recortar)
  @IsString()
  @MinLength(5, { message: 'Indique un motivo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo: string;
}

export class ReactivarGrupoDto {
  @ApiProperty({ example: 'Se retoma la instrucción del grupo' })
  @Transform(recortar)
  @IsString()
  @MinLength(5, { message: 'Indique un motivo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo: string;

  @ApiPropertyOptional({ description: 'Reincorporar a quienes salieron por el último cierre (por defecto sí)' })
  @IsOptional()
  @IsBoolean()
  restaurarIntegrantes?: boolean;
}

/** Se indica el usuario (ya habilitado) o la persona integrante del grupo */
export class AssignManagerDto {
  @ApiPropertyOptional({ description: 'Usuario ya habilitado como encargado' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  usuarioId?: number;

  @ApiPropertyOptional({ description: 'Integrante del grupo: se usa su cuenta, se le otorga el rol o se le crea la cuenta' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  personaId?: number;

  @ApiPropertyOptional({ description: 'Usuario para la cuenta nueva (solo si la persona no tiene cuenta)', example: 'aldair.escobar' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9][a-z0-9._-]{2,79}$/, {
    message: 'El usuario debe tener de 3 a 80 caracteres: minúsculas, números, punto, guion o guion bajo',
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'Si el usuario ya encarga otro grupo, finaliza esa asignación y lo mueve a este',
  })
  @IsOptional()
  @IsBoolean()
  reasignar?: boolean;
}

export class FinalizarEncargadoDto {
  @ApiProperty()
  @Transform(recortar)
  @IsString()
  @MinLength(5, { message: 'Indique un motivo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo: string;
}

export class AddMemberDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  personaId: number;

  @ApiPropertyOptional({
    description: 'Si la persona ya integra otro grupo activo de la misma etapa, la transfiere a este',
  })
  @IsOptional()
  @IsBoolean()
  transferir?: boolean;
}

export class RetirarIntegranteDto {
  /**
   * QUITAR: sale del grupo pero sigue en su etapa (error de carga, reubicación).
   * RETIRO: abandona la formación; también se cierra su etapa activa.
   */
  @ApiProperty({ enum: ['QUITAR', 'RETIRO'] })
  @IsIn(['QUITAR', 'RETIRO'])
  tipo: 'QUITAR' | 'RETIRO';

  @ApiProperty()
  @Transform(recortar)
  @IsString()
  @MinLength(5, { message: 'Indique un motivo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo: string;
}

export class GruposQueryDto {
  @ApiPropertyOptional({ enum: ['ACTIVO', 'CERRADO', 'CANCELADO', 'TODOS'] })
  @IsOptional()
  @IsIn(['ACTIVO', 'CERRADO', 'CANCELADO', 'TODOS'])
  estado?: string;
}

export class CandidatosQueryDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido o DNI' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(80)
  q?: string;
}
