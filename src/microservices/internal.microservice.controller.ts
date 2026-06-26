import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthService } from '../internal/auth/internal-auth.service';
import { RefreshTokenService } from '../internal/auth/refresh-token.service';
import { InternalCustomerService } from '../internal/customer/internal-customer.service';
import { InternalAdminService } from '../internal/admin/internal-admin.service';
import { Role } from '../entities/user.entity';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { BackendPatterns } from './patterns';
import type { RpcEnvelope } from './rpc.types';
import { assertRpcAuth } from './rpc-auth.util';

@Controller()
export class InternalMicroserviceController {
  constructor(
    private readonly configService: ConfigService,
    private readonly internalAuthService: InternalAuthService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly internalCustomerService: InternalCustomerService,
    private readonly internalAdminService: InternalAdminService,
  ) {}

  private validate(
    envelope: RpcEnvelope,
    options?: { requireTenant?: boolean; allowMissingTenant?: boolean },
  ) {
    assertRpcAuth(
      envelope,
      this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || '',
      options,
    );
  }

  @MessagePattern(BackendPatterns.AUTH_GET_LOGIN_DATA)
  getLoginData(
    @Payload() payload: RpcEnvelope<{ identifier: string; role: string }>,
  ) {
    this.validate(payload, { allowMissingTenant: true });
    return this.internalAuthService.getLoginData(
      payload.data.identifier,
      payload.data.role as Role,
    );
  }

  @MessagePattern(BackendPatterns.AUTH_GET_ADMIN_LOGIN_DATA)
  getAdminLoginData(@Payload() payload: RpcEnvelope<{ identifier: string }>) {
    this.validate(payload, { allowMissingTenant: true });
    return this.internalAuthService.getAdminLoginData(payload.data.identifier);
  }

  @MessagePattern(BackendPatterns.AUTH_VALIDATE_EMAIL)
  validateEmail(
    @Payload() payload: RpcEnvelope<{ email: string; role?: string }>,
  ) {
    this.validate(payload, { allowMissingTenant: true });
    return this.internalAuthService.validateEmail(
      payload.data.email,
      payload.data.role as Role | undefined,
    );
  }

  @MessagePattern(BackendPatterns.AUTH_UPDATE_PASSWORD)
  updatePassword(
    @Payload() payload: RpcEnvelope<{ email: string; newPassword: string }>,
  ) {
    this.validate(payload, { allowMissingTenant: true });
    return this.internalAuthService.updatePassword(
      payload.data.email,
      payload.data.newPassword,
    );
  }

  @MessagePattern(BackendPatterns.AUTH_ISSUE_REFRESH_TOKEN)
  issueRefreshToken(
    @Payload()
    payload: RpcEnvelope<{
      userId: string;
      role: string;
      tenantId?: string | null;
    }>,
  ) {
    this.validate(payload, { allowMissingTenant: true });
    return this.refreshTokenService.issueToken({
      ...payload.data,
      role: payload.data.role as Role,
    });
  }

  @MessagePattern(BackendPatterns.AUTH_ROTATE_REFRESH_TOKEN)
  rotateRefreshToken(
    @Payload() payload: RpcEnvelope<{ refreshToken: string }>,
  ) {
    this.validate(payload, { allowMissingTenant: true });
    return this.refreshTokenService.validateAndRotate(
      payload.data.refreshToken,
    );
  }

  @MessagePattern(BackendPatterns.CUSTOMER_FIND_OR_CREATE)
  findOrCreateCustomer(@Payload() payload: RpcEnvelope<{ phone: string }>) {
    this.validate(payload);
    return this.internalCustomerService.findOrCreate(
      payload.data.phone,
      payload.tenantId || null,
    );
  }

  @MessagePattern(BackendPatterns.CUSTOMER_GET_AUTH_DATA)
  getCustomerAuthData(@Payload() payload: RpcEnvelope<{ phone: string }>) {
    this.validate(payload);
    return this.internalCustomerService.getAuthData(
      payload.data.phone,
      payload.tenantId || null,
    );
  }

  @MessagePattern(BackendPatterns.ADMIN_CREATE)
  createAdmin(@Payload() payload: RpcEnvelope<CreateAdminDto>) {
    this.validate(payload, { allowMissingTenant: true });
    return this.internalAdminService.createAdmin(payload.data);
  }
}
