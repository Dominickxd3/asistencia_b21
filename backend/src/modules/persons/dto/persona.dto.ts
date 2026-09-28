import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Opcional: '' o null borran el valor */
const vacioANull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;
const conValor = (_: unknown, v: unknown) => v !== null && v !== undefined;

export class CreatePersonaDto {
  @ApiPropertyOptional({ example: '45612378', nullable: true })
  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf(conValor)
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string | null;

  @ApiProperty()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Indique los nombres' })
  @MaxLength(100)
  nombres: string;

  @ApiProperty()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Indique el apellido paterno' })
  @MaxLength(80)
  apellidoPaterno: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf(conValor)
  @IsString()
  @MaxLength(80)
  apellidoMaterno?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '987654321' })
  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf(conValor)
  @Matches(/^[+\d][\d\s-]{5,29}$/, { message: 'Teléfono inválido' })
  telefono?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf(conValor)
  @IsEmail({}, { message: 'Correo inválido' })
  @MaxLength(150)
  correo?: string | null;

  @ApiPropertyOptional({ example: '2001-05-14', nullable: true })
  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf(conValor)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Formato de fecha inválido (AAAA-MM-DD)' })
  fechaNacimiento?: string | null;
}

/** Todos opcionales; el estado se cambia con POST /persons/:id/estado */
export class UpdatePersonaDto extends PartialType(CreatePersonaDto) {}

export class CambiarEstadoPersonaDto {
  @ApiProperty({ enum: ['ACTIVO', 'INACTIVO'] })
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado: 'ACTIVO' | 'INACTIVO';

  @ApiProperty({ example: 'Renuncia a la compañía' })
  @Transform(recortar)
  @IsString()
  @MinLength(5, { message: 'Indique un motivo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo: string;
}

export const TAMANOS_PAGINA = [10, 25, 50, 100];

export class ListarPersonasQueryDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido o DNI' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ enum: TAMANOS_PAGINA, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(TAMANOS_PAGINA)
  tamano?: number;

  @ApiPropertyOptional({ description: 'Grupo actual; 0 = sin grupo (alumnos); -1 = personal' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  grupoId?: number;

  @ApiPropertyOptional({ description: 'Código de etapa vigente; INSTRUCCION = personal; SIN_ETAPA = alumnos sin etapa' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  etapa?: string;

  @ApiPropertyOptional({ enum: ['ACTIVO', 'INACTIVO', 'TODOS'], default: 'TODOS' })
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO', 'TODOS'])
  estado?: string;
}
