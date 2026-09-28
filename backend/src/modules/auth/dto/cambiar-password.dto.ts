import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CambiarPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Escriba su contraseña actual' })
  @MaxLength(100)
  actual: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'La contraseña nueva debe tener al menos 8 caracteres' })
  @MaxLength(100, { message: 'La contraseña nueva no puede tener más de 100 caracteres' })
  nueva: string;
}
