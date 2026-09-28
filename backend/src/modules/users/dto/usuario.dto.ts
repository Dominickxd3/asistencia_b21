import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { RoleCode } from '../../../common/constants/roles.constants';

const ROLES = Object.values(RoleCode) as string[];

export class CandidatosCuentaQueryDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido o DNI' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CrearUsuarioDto {
  @ApiProperty({ description: 'Persona registrada que tendrá la cuenta' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personaId: number;

  @ApiProperty({ example: 'juan.perez' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9][a-z0-9._-]{2,79}$/, {
    message: 'El usuario debe tener de 3 a 80 caracteres: minúsculas, números, punto, guion o guion bajo',
  })
  username: string;

  @ApiProperty({ enum: ROLES, isArray: true })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elija al menos un cargo' })
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsIn(ROLES, { each: true, message: 'Cargo no válido' })
  roles: string[];
}

export class ActualizarRolesDto {
  @ApiProperty({ enum: ROLES, isArray: true })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elija al menos un cargo. Para quitar todo el acceso, desactive la cuenta.' })
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsIn(ROLES, { each: true, message: 'Cargo no válido' })
  roles: string[];
}

export class RestablecerPasswordDto {
  @ApiPropertyOptional({ description: 'Contraseña elegida; si se omite se genera una temporal' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100, { message: 'La contraseña no puede tener más de 100 caracteres' })
  password?: string;
}

export class CambiarEstadoCuentaDto {
  @ApiProperty({ enum: ['ACTIVA', 'INACTIVA'] })
  @IsIn(['ACTIVA', 'INACTIVA'])
  estado: 'ACTIVA' | 'INACTIVA';
}
