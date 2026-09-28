import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FECHA_REGEX } from "../../../common/utils/fecha.util";

export const POLITICAS_FUERA_ZONA = [
  "ADVERTIR",
  "JUSTIFICAR",
  "BLOQUEAR",
] as const;
export const ESTADOS_GEOGRAFICOS = [
  "DENTRO_ZONA",
  "FUERA_ZONA",
  "PRECISION_INSUFICIENTE",
  "NO_DISPONIBLE",
  "SIN_GEOCERCA",
] as const;

export class ConfigSedeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string;

  @ApiPropertyOptional({
    description: "Activa o desactiva la validación geográfica",
  })
  @IsOptional()
  @IsBoolean()
  validacionActiva?: boolean;

  @ApiPropertyOptional({
    description: "Metros fuera del borde que aún cuentan como dentro",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  toleranciaMetros?: number;

  @ApiPropertyOptional({
    description: "Precisión GPS peor que este valor se marca como insuficiente",
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(5000)
  precisionMaximaMetros?: number;

  @ApiPropertyOptional({ enum: POLITICAS_FUERA_ZONA })
  @IsOptional()
  @IsIn(POLITICAS_FUERA_ZONA as unknown as string[])
  politicaFueraZona?: string;

  @ApiPropertyOptional({ enum: ["ACTIVO", "INACTIVO"] })
  @IsOptional()
  @IsIn(["ACTIVO", "INACTIVO"])
  estado?: string;

  @ApiPropertyOptional({
    description: "Marca la sede como principal de la compañía",
  })
  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;
}

export class CrearSedeDto extends ConfigSedeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  declare nombre: string;
}

export class VerticeDto {
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
}

export class GeocercaDto {
  @ApiProperty({
    type: [VerticeDto],
    description: "Vértices del perímetro en orden (el polígono se cierra solo)",
  })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => VerticeDto)
  vertices: VerticeDto[];
}

export class RegistrosGeograficosQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sedeId?: number;

  @ApiPropertyOptional({
    enum: ESTADOS_GEOGRAFICOS,
    description: "Por defecto: fuera de la sede y precisión insuficiente",
  })
  @IsOptional()
  @IsIn(ESTADOS_GEOGRAFICOS as unknown as string[])
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(FECHA_REGEX)
  desde?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(FECHA_REGEX)
  hasta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}

export class BuscarDireccionQueryDto {
  @ApiProperty({
    description:
      "Dirección o lugar que el usuario desea ubicar en OpenStreetMap",
  })
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  q: string;
}
