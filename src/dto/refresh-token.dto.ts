import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class IssueRefreshTokenDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string | null;
}

export class RotateRefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class RevokeUserTokensDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
