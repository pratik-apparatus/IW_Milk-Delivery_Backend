import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RpcEnvelope } from './rpc.types';

export function assertRpcAuth(
  envelope: RpcEnvelope,
  expectedToken: string,
  options?: { requireTenant?: boolean; allowMissingTenant?: boolean },
) {
  if (!envelope?.token || !expectedToken || envelope.token !== expectedToken) {
    throw new UnauthorizedException('Invalid internal service token');
  }

  const tenantId = envelope.tenantId?.trim() || '';
  const requireTenant = options?.requireTenant ?? true;
  const allowMissingTenant = options?.allowMissingTenant ?? false;

  if (requireTenant && !allowMissingTenant && !tenantId) {
    throw new ForbiddenException('tenantId is required');
  }
}
