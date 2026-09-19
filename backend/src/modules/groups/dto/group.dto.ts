import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ description: 'Id de etapa_formacion (1=Postulante, 2=Aspirante, 3=ESBAS)' })
  @Type(() => Number)
  @IsInt()
  etapaId: number;

  @ApiProperty({ example: 'ASP-2026-II' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  codigo: string;

  @ApiProperty({ example: 'Aspirantes 2026-II' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({ example: '2026-II' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  periodo: string;

  @ApiProperty({ example: '2026-08-03' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaInicio: string;

  @ApiPropertyOptional({ example: '2026-12-20' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaFin?: string;
}

export class AssignManagerDto {
  @ApiProperty({ description: 'Usuario que asume la jefatura del grupo' })
  @Type(() => Number)
  @IsInt()
  usuarioId: number;
}

export class AddMemberDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  personaId: number;
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Aspirantes de compañía 2026-II' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ example: '2026-II' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  periodo?: string;

  @ApiPropertyOptional({ example: '2026-08-03' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2026-12-20' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaFin?: string;
}

export class RemoveMemberDto {
  @ApiPropertyOptional({ example: 'Cambio de grupo' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
