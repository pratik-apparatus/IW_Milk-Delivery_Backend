/** Always enabled for every tenant — not configurable via API. */
export const DEFAULT_TENANT_APPS = ['CUSTOMER_APP', 'ADMIN_APP'] as const;

/** Optional modules super-admin can enable per tenant. */
export const OPTIONAL_TENANT_APPS = ['DELIVERY_APP', 'SUBSCRIPTIONS_MODULE'] as const;

export const ALL_TENANT_APPS = [
  ...DEFAULT_TENANT_APPS,
  ...OPTIONAL_TENANT_APPS,
] as const;

export type TenantAppKey = (typeof ALL_TENANT_APPS)[number];

export function resolveEnabledApps(requested?: string[]): string[] {
  const apps = new Set<string>(DEFAULT_TENANT_APPS);

  if (!requested?.length) {
    return [...apps];
  }

  for (const app of requested) {
    if ((DEFAULT_TENANT_APPS as readonly string[]).includes(app)) {
      continue;
    }
    if (!(OPTIONAL_TENANT_APPS as readonly string[]).includes(app)) {
      throw new Error(`Invalid enabled app: ${app}`);
    }
    apps.add(app);
  }

  return [...apps];
}
