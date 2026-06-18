import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { InternalAuthService } from './internal-auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { GetLoginDataDto } from '../../dto/login-data.dto';
import { ValidateEmailDto } from '../../dto/validate-email.dto';
import { UpdatePasswordDto } from '../../dto/update-password.dto';
import { CreateUserDto } from '../../dto/create-user.dto';
import {
  IssueRefreshTokenDto,
  RevokeUserTokensDto,
  RotateRefreshTokenDto,
} from '../../dto/refresh-token.dto';
import { InternalServiceGuard } from '../../auth/internal-service.guard';

@Controller('internal/auth')
@UseGuards(InternalServiceGuard)
export class InternalAuthController {
  constructor(
    private readonly internalAuthService: InternalAuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Post('get-login-data')
  async getLoginData(@Body() dto: GetLoginDataDto) {
    return this.internalAuthService.getLoginData(dto.identifier, dto.role);
  }

  @Post('validate-email')
  async validateEmail(@Body() dto: ValidateEmailDto) {
    return this.internalAuthService.validateEmail(dto.email, dto.role);
  }

  @Post('update-password')
  async updatePassword(@Body() dto: UpdatePasswordDto) {
    return this.internalAuthService.updatePassword(dto.email, dto.newPassword);
  }

  @Post('create-user')
  async createUser(@Body() dto: CreateUserDto) {
    return this.internalAuthService.createUser(dto);
  }

  @Post('issue-refresh-token')
  async issueRefreshToken(@Body() dto: IssueRefreshTokenDto) {
    return this.refreshTokenService.issueToken(dto);
  }

  @Post('rotate-refresh-token')
  async rotateRefreshToken(@Body() dto: RotateRefreshTokenDto) {
    return this.refreshTokenService.validateAndRotate(dto.refreshToken);
  }

  @Post('revoke-user-tokens')
  async revokeUserTokens(@Body() dto: RevokeUserTokensDto) {
    await this.refreshTokenService.revokeAllForUser(dto.userId);
    return { success: true };
  }
}

