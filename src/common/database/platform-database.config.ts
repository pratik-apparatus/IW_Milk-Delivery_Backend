import { User } from '../../entities/user.entity';
import { Admin } from '../../entities/admin.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantProvisioningJob } from '../../entities/tenant-provisioning-job.entity';
import { TenantPlan } from '../../entities/tenant-plan.entity';
import { TenantSubscription } from '../../entities/tenant-subscription.entity';

/** Only these tables belong in the platform (control-plane) database. */
export const PLATFORM_ENTITIES = [
  Tenant,
  TenantProvisioningJob,
  TenantPlan,
  TenantSubscription,
  User,
  Admin,
  RefreshToken,
];
