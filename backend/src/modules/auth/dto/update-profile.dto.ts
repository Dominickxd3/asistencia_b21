import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  apellidoPaterno: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoMaterno?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  correo?: string;
}
