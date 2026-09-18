import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'jefe.instruccion' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  username: string;

  @ApiProperty({ example: 'R21#Jefe2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  password: string;
}
