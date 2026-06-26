import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class UpdatePasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
