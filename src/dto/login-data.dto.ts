import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Role } from '../entities/user.entity';

export class GetLoginDataDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
