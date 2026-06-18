import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException, Injectable } from '@nestjs/common';

type TenantStore = {
  tenantId: string | null;
  /** When true, business data is read from tenant.dbName (no tenantId column filter needed). */
  usesDedicatedDatabase: boolean;
};

const tenantStorage = new AsyncLocalStorage<TenantStore>();

@Injectable()
export class TenantContextService {
  runWithTenant<T>(
    tenantId: string | null | undefined,
    fn: () => T,
    usesDedicatedDatabase = false,
  ): T {
    return tenantStorage.run(
      { tenantId: tenantId || null, usesDedicatedDatabase },
      fn,
    );
  }

  setTenantId(tenantId: string | null | undefined) {
    const store = tenantStorage.getStore();
    if (store) {
      store.tenantId = tenantId || null;
    }
  }

  setUsesDedicatedDatabase(value: boolean) {
    const store = tenantStorage.getStore();
    if (store) {
      store.usesDedicatedDatabase = value;
    }
  }

  getTenantId(): string | null {
    return tenantStorage.getStore()?.tenantId ?? null;
  }

  usesDedicatedDatabase(): boolean {
    return tenantStorage.getStore()?.usesDedicatedDatabase ?? false;
  }

  requireTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }
}
