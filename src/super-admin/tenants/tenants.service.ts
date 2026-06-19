import {
  ConflictException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { MailClientService } from '../../microservices/mail-client.service';
import { applyPagination } from '../../common/utils/pagination.util';
import { Tenant, TenantStatus } from '../../entities/tenant.entity';
import {
  ProvisioningJobStatus,
  TenantProvisioningJob,
} from '../../entities/tenant-provisioning-job.entity';
import { User, Role } from '../../entities/user.entity';
import { Admin } from '../../entities/admin.entity';
import { RefreshTokenService } from '../../internal/auth/refresh-token.service';
import { TenantDbService } from './tenant-db.service';
import { TenantDatabaseService } from '../../common/database/tenant-database.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import { UpdateTenantAppsDto } from './dto/update-tenant-apps.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantLifecycleEventType } from './tenant.events';
import {
  normalizeIntegrationConfig,
  parseEnabledApps,
} from './tenant-config.util';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantProvisioningJob)
    private readonly provisioningRepo: Repository<TenantProvisioningJob>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tenantDbService: TenantDbService,
    private readonly mailClient: MailClientService,
    private readonly tenantDatabaseService: TenantDatabaseService,
  ) {}

  async create(payload: CreateTenantDto) {
    const exists = await this.tenantRepo.findOne({
      where: { subdomain: payload.subdomain },
    });
    if (exists) {
      throw new ConflictException('Subdomain already exists');
    }

    const tenant = this.tenantRepo.create({
      businessName: payload.businessName,
      subdomain: payload.subdomain,
      status: TenantStatus.INACTIVE,
      enabledApps: parseEnabledApps(payload.enabledApps),
      appSettings: payload.appSettings || {},
      integrationConfig: normalizeIntegrationConfig(payload.integrationConfig),
      adminAddress: payload.adminAddress,
      adminLatitude: payload.adminLatitude,
      adminLongitude: payload.adminLongitude,
      deliveryRadiusKm: payload.deliveryRadiusKm,
      suspensionReason: null,
      logoUrl: payload.logoUrl || null,
      adminEmail: payload.adminEmail,
      supportEmail: payload.supportEmail || null,
      supportPhone: payload.supportPhone || null,
      dbHost: payload.dbHost || this.configService.get('DB_HOST') || null,
      dbPort: payload.dbPort || Number(this.configService.get('DB_PORT') || 5432),
      dbName: payload.dbName || this.buildDefaultDbName(payload.subdomain),
      dbUser: payload.dbUser || this.configService.get('DB_USER') || null,
      dbPassword: payload.dbPassword || this.configService.get('DB_PASSWORD') || null,
    });
    const created = await this.tenantRepo.save(tenant);
    this.emitTenantEvent(TenantLifecycleEventType.TENANT_CREATED, created.id, {
      subdomain: created.subdomain,
    });

    const provisioningJob = await this.provisionTenant(created.id);
    const provisionedTenant = await this.tenantRepo.findOne({
      where: { id: created.id },
    });

    return {
      tenant: this.sanitizeTenant(provisionedTenant!),
      provisioningJob,
    };
  }

  async findAll(query: TenantQueryDto) {
    const { page, limit, search, status } = query;

    const qb = this.tenantRepo.createQueryBuilder('tenant');

    if (status) {
      qb.andWhere('tenant.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(tenant.businessName ILIKE :search OR tenant.subdomain ILIKE :search OR tenant.adminEmail ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('tenant.createdAt', 'DESC');

    const result = await applyPagination(qb, page, limit);
    return {
      ...result,
      data: result.data.map((tenant) => this.sanitizeTenant(tenant)),
    };
  }

  async findOne(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return this.sanitizeTenant(tenant);
  }

  async update(id: string, payload: UpdateTenantDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (payload.subdomain && payload.subdomain !== tenant.subdomain) {
      const subdomainExists = await this.tenantRepo.findOne({
        where: { subdomain: payload.subdomain },
      });
      if (subdomainExists) {
        throw new ConflictException('Subdomain already exists');
      }
    }

    const { enabledApps, integrationConfig, ...rest } = payload;

    Object.assign(tenant, rest);

    if (enabledApps !== undefined) {
      tenant.enabledApps = parseEnabledApps(enabledApps);
    }

    if (integrationConfig !== undefined) {
      const existing = (tenant.integrationConfig || {}) as Record<string, unknown>;
      const existingRazorpay = (existing.razorpay || {}) as Record<string, unknown>;
      tenant.integrationConfig = normalizeIntegrationConfig({
        razorpay: {
          ...existingRazorpay,
          ...integrationConfig.razorpay,
        },
      });
    }

    const updated = await this.tenantRepo.save(tenant);
    this.emitTenantEvent(TenantLifecycleEventType.TENANT_UPDATED, updated.id);
    return this.sanitizeTenant(updated);
  }

  async updateStatus(id: string, payload: UpdateTenantStatusDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    tenant.status = payload.status;
    tenant.suspensionReason =
      payload.status === TenantStatus.SUSPENDED ? payload.reason || null : null;

    const updated = await this.tenantRepo.save(tenant);
    this.emitTenantEvent(TenantLifecycleEventType.TENANT_STATUS_UPDATED, updated.id, {
      status: updated.status,
    });
    return this.sanitizeTenant(updated);
  }

  async updateApps(id: string, payload: UpdateTenantAppsDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    tenant.enabledApps = parseEnabledApps(payload.enabledApps);
    if (payload.appSettings) {
      tenant.appSettings = payload.appSettings;
    }

    const updated = await this.tenantRepo.save(tenant);
    this.emitTenantEvent(TenantLifecycleEventType.TENANT_APPS_UPDATED, updated.id, {
      enabledApps: updated.enabledApps,
    });
    return this.sanitizeTenant(updated);
  }

  async remove(id: string) {
    return this.decommissionTenant(id);
  }

  async decommissionTenant(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const tenantUsers = await this.userRepo.find({ where: { tenantId: id } });
    for (const user of tenantUsers) {
      user.isActive = false;
      await this.userRepo.save(user);
      await this.refreshTokenService.revokeAllForUser(user.id);
    }

    tenant.status = TenantStatus.INACTIVE;
    tenant.deletedAt = new Date();
    tenant.suspensionReason = tenant.suspensionReason || 'Tenant decommissioned';
    await this.tenantRepo.save(tenant);

    this.emitTenantEvent(TenantLifecycleEventType.TENANT_DECOMMISSIONED, id, {
      deactivatedUsers: tenantUsers.length,
    });

    return {
      message: 'Tenant decommissioned successfully',
      tenantId: id,
      deactivatedUsers: tenantUsers.length,
    };
  }

  async restoreTenant(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (!tenant.deletedAt) {
      throw new BadRequestException('Tenant is not decommissioned');
    }

    tenant.deletedAt = null;
    tenant.suspensionReason = null;
    if (tenant.status === TenantStatus.INACTIVE) {
      tenant.status = TenantStatus.ACTIVE;
    }

    const tenantUsers = await this.userRepo.find({ where: { tenantId: id } });
    for (const user of tenantUsers) {
      user.isActive = true;
      await this.userRepo.save(user);
    }

    const restored = await this.tenantRepo.save(tenant);
    this.emitTenantEvent(TenantLifecycleEventType.TENANT_UPDATED, restored.id, {
      restored: true,
      reactivatedUsers: tenantUsers.length,
    });

    return {
      message: 'Tenant restored successfully',
      tenant: this.sanitizeTenant(restored),
      reactivatedUsers: tenantUsers.length,
    };
  }

  async provisionTenant(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const existingInFlight = await this.provisioningRepo.findOne({
      where: { tenantId: tenant.id, status: ProvisioningJobStatus.RUNNING },
      order: { createdAt: 'DESC' },
    });
    if (existingInFlight) {
      return existingInFlight;
    }

    const job = await this.provisioningRepo.save(
      this.provisioningRepo.create({
        tenantId: tenant.id,
        status: ProvisioningJobStatus.PENDING,
        steps: [],
      }),
    );

    try {
      job.status = ProvisioningJobStatus.RUNNING;
      job.steps = [...job.steps, 'CREATE_DATABASE'];
      await this.provisioningRepo.save(job);

      if (tenant.dbName) {
        await this.createTenantDatabaseIfMissing(tenant);
        job.steps = [...job.steps, 'INIT_SCHEMA'];
        await this.tenantDatabaseService.initializeTenantSchema(tenant);
        job.steps = [...job.steps, 'VERIFY_HEALTH'];
        await this.tenantDbService.verifyConnection(tenant);
      }

      const temporaryPassword = this.generateTemporaryPassword();
      job.steps = [...job.steps, 'CREATE_ADMIN_USER'];
      await this.createTenantAdminUser(tenant, temporaryPassword);

      job.steps = [...job.steps, 'SEND_CREDENTIALS_EMAIL'];
      await this.sendTenantCredentialsEmail(tenant, temporaryPassword);

      tenant.status = TenantStatus.ACTIVE;
      await this.tenantRepo.save(tenant);

      job.steps = [...job.steps, 'MARK_ACTIVE'];
      job.status = ProvisioningJobStatus.DONE;
      job.lastError = null;
      this.emitTenantEvent(TenantLifecycleEventType.TENANT_PROVISIONED, tenant.id, {
        jobId: job.id,
      });
      return await this.provisioningRepo.save(job);
    } catch (error: any) {
      job.status = ProvisioningJobStatus.FAILED;
      job.lastError = error?.message || 'Provisioning failed';
      await this.provisioningRepo.save(job);
      throw error;
    }
  }

  async getProvisioningJob(tenantId: string, jobId: string) {
    const job = await this.provisioningRepo.findOne({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException('Provisioning job not found');
    }
    return job;
  }

  async getOverview(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      tenant: this.sanitizeTenant(tenant),
      management: {
        totalEnabledApps: tenant.enabledApps.length,
        appKeys: Object.keys(tenant.appSettings || {}),
        deliveryZone: {
          adminAddress: tenant.adminAddress,
          adminLatitude: tenant.adminLatitude,
          adminLongitude: tenant.adminLongitude,
          deliveryRadiusKm: tenant.deliveryRadiusKm,
        },
        hasDbConfig: Boolean(
          tenant.dbHost && tenant.dbPort && tenant.dbName && tenant.dbUser,
        ),
      },
    };
  }

  private sanitizeTenant(tenant: Tenant) {
    const { dbPassword, ...safeTenant } = tenant;
    return safeTenant;
  }

  private emitTenantEvent(
    eventType: TenantLifecycleEventType,
    tenantId: string,
    payload: Record<string, unknown> = {},
  ) {
    // Extraction seam: keep lifecycle events centralized so they can be published
    // to a queue/event bus when control-plane becomes a separate service.
    this.logger.log(
      JSON.stringify({
        eventType,
        tenantId,
        payload,
        occurredAt: new Date().toISOString(),
      }),
    );
  }

  private buildDefaultDbName(subdomain: string) {
    const safe = subdomain.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    return `milk_${safe}`;
  }

  private async createTenantDatabaseIfMissing(tenant: Tenant) {
    if (!tenant.dbName) {
      return;
    }

    const adminClient = new Client({
      host: this.configService.get<string>('DB_HOST'),
      port: Number(this.configService.get<string>('DB_PORT') || 5432),
      user: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: 'postgres',
    });

    await adminClient.connect();
    try {
      const exists = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [tenant.dbName],
      );

      if (exists.rowCount === 0) {
        await adminClient.query(`CREATE DATABASE "${tenant.dbName}"`);
      }
    } finally {
      await adminClient.end();
    }
  }

  private generateTemporaryPassword() {
    return randomBytes(9).toString('base64url');
  }

  private async createTenantAdminUser(tenant: Tenant, plainPassword: string) {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const existing = await this.userRepo.findOne({
      where: { email: tenant.adminEmail, role: Role.ADMIN },
    });

    if (existing) {
      existing.tenantId = tenant.id;
      existing.password = hashedPassword;
      existing.isActive = true;
      existing.username = existing.username || `${tenant.subdomain}_admin`;
      if (tenant.supportPhone) {
        existing.phone = tenant.supportPhone;
      }

      const savedUser = await this.userRepo.save(existing);
      const adminRecord = await this.adminRepo.findOne({
        where: { userId: savedUser.id },
      });
      if (!adminRecord) {
        await this.adminRepo.save(
          this.adminRepo.create({ userId: savedUser.id }),
        );
      }
      return savedUser;
    }

    const user = this.userRepo.create({
      email: tenant.adminEmail,
      username: `${tenant.subdomain}_admin`,
      phone: tenant.supportPhone || `tenant-${tenant.id.slice(0, 8)}`,
      password: hashedPassword,
      role: Role.ADMIN,
      tenantId: tenant.id,
      isActive: true,
    });
    const savedUser = await this.userRepo.save(user);
    await this.adminRepo.save(this.adminRepo.create({ userId: savedUser.id }));
    return savedUser;
  }

  private async sendTenantCredentialsEmail(
    tenant: Tenant,
    temporaryPassword: string,
  ) {
    await this.mailClient.sendTenantCredentials({
      to: tenant.adminEmail,
      businessName: tenant.businessName,
      adminEmail: tenant.adminEmail,
      temporaryPassword,
      subdomain: tenant.subdomain,
      adminPanelUrl: this.configService.get<string>('ADMIN_PANEL_URL'),
    });
  }
}

