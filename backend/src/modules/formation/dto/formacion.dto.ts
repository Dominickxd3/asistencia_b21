import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromoverDto {
  @ApiProperty({ description: 'Persona a promover' })
  @Type(() => Number)
  @IsInt()
  personaId: number;

  @ApiProperty({ example: 'ASPIRANTE_COMPANIA', description: 'Código de la etapa destino' })
  @IsString()
  @IsNotEmpty()
  etapaDestino: string;

  @ApiPropertyOptional({ description: 'Grupo destino (si aplica)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  grupoDestinoId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
