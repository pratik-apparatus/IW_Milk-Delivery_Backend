import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsEmail,
  IsUUID,
} from 'class-validator';
import { Role } from '../entities/user.entity';

export class CreateAdminDto {
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUUID()
  @IsOptional()
  tenantId?: string;
}
