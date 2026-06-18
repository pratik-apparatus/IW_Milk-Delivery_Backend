import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { AdminAuditLog } from '../../entities/admin-audit-log.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantDatabaseService } from '../../common/database/tenant-database.service';

export interface CreateAdminAuditLogInput {
  tenantId: string;
  adminId: string;
  method: string;
  path: string;
  action?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AdminAuditLogService {
  private readonly logger = new Logger(AdminAuditLogService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantDatabase: TenantDatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async log(input: CreateAdminAuditLogInput) {
    const auditRepo = await this.tenantDatabase.getRepositoryForTenant(
      input.tenantId,
      AdminAuditLog,
    );
    const entry = auditRepo.create({
      tenantId: input.tenantId,
      adminId: input.adminId,
      method: input.method,
      path: input.path,
      action: input.action || null,
      statusCode: input.statusCode ?? null,
      ipAddress: typeof input.ipAddress === 'string' ? input.ipAddress : null,
      metadata: input.metadata || {},
    });
    await auditRepo.save(entry);
  }

  async findByTenant(tenantId: string, limit = 100) {
    const auditRepo = await this.tenantDatabase.getRepositoryForTenant(
      tenantId,
      AdminAuditLog,
    );
    return auditRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredLogs() {
    const retentionDays =
      Number(this.configService.get('ADMIN_AUDIT_LOG_RETENTION_DAYS')) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const tenants = await this.tenantRepo.find({
      where: {},
      select: ['id', 'dbName', 'deletedAt'],
    });

    let totalPurged = 0;
    for (const tenant of tenants) {
      if (!tenant.dbName || tenant.deletedAt) {
        continue;
      }
      try {
        const auditRepo = await this.tenantDatabase.getRepositoryForTenant(
          tenant.id,
          AdminAuditLog,
        );
        const result = await auditRepo.delete({
          createdAt: LessThan(cutoff),
        });
        totalPurged += result.affected || 0;
      } catch (error: any) {
        this.logger.warn(
          `Failed to purge audit logs for tenant ${tenant.id}: ${error?.message}`,
        );
      }
    }

    this.logger.log(
      `Purged ${totalPurged} admin audit logs older than ${retentionDays} days`,
    );
  }
}
