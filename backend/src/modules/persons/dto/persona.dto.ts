import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePersonaDto {
  @ApiPropertyOptional({ example: '45612378' })
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  apellidoPaterno: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoMaterno?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  correo?: string;

  @ApiPropertyOptional({ example: '2001-05-14' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Formato de fecha inválido (YYYY-MM-DD)' })
  fechaNacimiento?: string;
}

export class UpdatePersonaDto {
  @IsOptional() @IsString() @MaxLength(100) nombres?: string;
  @IsOptional() @IsString() @MaxLength(80) apellidoPaterno?: string;
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsString() @MaxLength(150) correo?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fechaNacimiento?: string;
  @IsOptional() @IsString() estado?: string;
}
