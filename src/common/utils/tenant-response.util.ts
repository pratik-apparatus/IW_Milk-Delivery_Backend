const SKIP_RECURSE_KEYS = new Set(['meta', 'pagination', 'tokens', 'billing']);

/** Fill null tenantId on API payloads when data lives in a dedicated tenant database. */
export function enrichWithTenantId<T>(value: T, tenantId: string, depth = 0): T {
  if (!tenantId || value === null || value === undefined || depth > 6) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      enrichWithTenantId(item, tenantId, depth + 1),
    ) as T;
  }

  if (typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  const record = { ...(value as Record<string, unknown>) };

  if ('tenantId' in record && record.tenantId == null) {
    record.tenantId = tenantId;
  }

  for (const [key, child] of Object.entries(record)) {
    if (SKIP_RECURSE_KEYS.has(key)) {
      continue;
    }
    if (child && typeof child === 'object') {
      record[key] = enrichWithTenantId(child, tenantId, depth + 1);
    }
  }

  return record as T;
}
