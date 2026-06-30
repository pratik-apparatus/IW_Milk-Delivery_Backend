import { AddRemainingQuantityToProduct1713263000000 } from './1713263000000-AddRemainingQuantityToProduct';
import { CreateAdminAuditLogsTable1713264000000 } from './1713264000000-CreateAdminAuditLogsTable';
import { AddProfilePicToCustomer1768000000000 } from './1768000000000-AddProfilePicToCustomer';

/** Register tenant migration classes here (avoid runtime glob loading in Nest). */
export const TENANT_MIGRATIONS = [
  AddRemainingQuantityToProduct1713263000000,
  CreateAdminAuditLogsTable1713264000000,
  AddProfilePicToCustomer1768000000000,
];

export const TENANT_MIGRATIONS_TABLE = 'tenant_migrations';
