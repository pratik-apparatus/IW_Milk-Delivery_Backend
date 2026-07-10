import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ManagedDatabase,
  ManagedDatabaseStatus,
} from '../../entities/managed-database.entity';
import { applyPagination } from '../../common/utils/pagination.util';
import { TenantDbService } from '../tenants/tenant-db.service';
import { CreateManagedDatabaseDto } from './dto/create-managed-database.dto';
import { ManagedDatabaseQueryDto } from './dto/managed-database-query.dto';
import { UpdateManagedDatabaseDto } from './dto/update-managed-database.dto';

@Injectable()
export class ManagedDatabasesService {
  constructor(
    @InjectRepository(ManagedDatabase)
    private readonly managedDbRepo: Repository<ManagedDatabase>,
    private readonly configService: ConfigService,
    private readonly tenantDbService: TenantDbService,
  ) {}

  async create(payload: CreateManagedDatabaseDto) {
    const connection = this.resolveConnection(payload);
    const tenantLike = this.tenantDbService.toConnectionTenant(connection);

    await this.tenantDbService.prepareDatabaseForTenant(tenantLike);

    const existing = await this.managedDbRepo.findOne({
      where: { dbHost: connection.dbHost, dbName: connection.dbName },
    });
    if (existing) {
      throw new ConflictException(
        `Database "${connection.dbName}" already exists on ${connection.dbHost}`,
      );
    }

    const record = await this.managedDbRepo.save(
      this.managedDbRepo.create({
        displayName: payload.displayName?.trim() || null,
        dbHost: connection.dbHost,
        dbPort: connection.dbPort,
        dbName: connection.dbName,
        dbUser: connection.dbUser,
        dbPassword: connection.dbPassword,
        status: ManagedDatabaseStatus.AVAILABLE,
        tenantId: null,
      }),
    );

    return this.sanitize(record);
  }

  async findAll(query: ManagedDatabaseQueryDto) {
    const { page, limit, status, search } = query;
    const qb = this.managedDbRepo.createQueryBuilder('database');

    if (status) {
      qb.andWhere('database.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(database.displayName ILIKE :search OR database.dbName ILIKE :search OR database.dbHost ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('database.createdAt', 'DESC');
    const result = await applyPagination(qb, page, limit);

    return {
      ...result,
      data: result.data.map((item) => this.sanitize(item)),
    };
  }

  async findOne(id: string) {
    const record = await this.getByIdOrThrow(id);
    return this.sanitize(record);
  }

  async update(id: string, payload: UpdateManagedDatabaseDto) {
    const record = await this.getByIdOrThrow(id);
    if (record.status === ManagedDatabaseStatus.ASSIGNED) {
      throw new BadRequestException(
        'Cannot update a database that is assigned to a tenant',
      );
    }

    if (payload.displayName !== undefined) {
      record.displayName = payload.displayName?.trim() || null;
    }
    if (payload.dbHost !== undefined) record.dbHost = payload.dbHost;
    if (payload.dbPort !== undefined) record.dbPort = payload.dbPort;
    if (payload.dbName !== undefined) record.dbName = payload.dbName;
    if (payload.dbUser !== undefined) record.dbUser = payload.dbUser;
    if (payload.dbPassword !== undefined) {
      record.dbPassword = payload.dbPassword;
    }

    const updated = await this.managedDbRepo.save(record);
    return this.sanitize(updated);
  }

  async remove(id: string) {
    const record = await this.getByIdOrThrow(id);
    if (record.status === ManagedDatabaseStatus.ASSIGNED) {
      throw new BadRequestException(
        'Cannot delete a database that is assigned to a tenant. Unassign it first.',
      );
    }

    const tenantLike = this.tenantDbService.toConnectionTenant(record);
    await this.tenantDbService.dropTenantDatabase(tenantLike);
    await this.managedDbRepo.delete({ id });

    return {
      message: 'Managed database deleted',
      databaseId: id,
      databaseName: record.dbName,
    };
  }

  async testConnection(id: string) {
    const record = await this.getByIdOrThrow(id);
    return this.tenantDbService.testConnectionForManagedDatabase(id, record);
  }

  async getHealth(id: string) {
    const record = await this.getByIdOrThrow(id);
    return this.tenantDbService.getDbHealthForConnection(
      id,
      this.tenantDbService.toConnectionTenant(record),
    );
  }

  async getAvailableForTenant(databaseId: string): Promise<ManagedDatabase> {
    const record = await this.managedDbRepo.findOne({
      where: { id: databaseId },
    });
    if (!record) {
      throw new NotFoundException('Managed database not found');
    }
    if (record.status !== ManagedDatabaseStatus.AVAILABLE) {
      throw new BadRequestException(
        'Selected database is not available. It may already be assigned to another tenant.',
      );
    }
    return record;
  }

  async assignToTenant(databaseId: string, tenantId: string): Promise<void> {
    const record = await this.getAvailableForTenant(databaseId);
    record.status = ManagedDatabaseStatus.ASSIGNED;
    record.tenantId = tenantId;
    await this.managedDbRepo.save(record);
  }

  async releaseFromTenant(tenantId: string): Promise<void> {
    const record = await this.managedDbRepo.findOne({ where: { tenantId } });
    if (!record) {
      return;
    }

    record.status = ManagedDatabaseStatus.AVAILABLE;
    record.tenantId = null;
    await this.managedDbRepo.save(record);
  }

  applyConnectionToTenantDraft(
    record: ManagedDatabase,
    tenantDraft: {
      dbHost: string | null;
      dbPort: number | null;
      dbName: string | null;
      dbUser: string | null;
      dbPassword: string | null;
      managedDatabaseId: string | null;
    },
  ) {
    tenantDraft.dbHost = record.dbHost;
    tenantDraft.dbPort = record.dbPort;
    tenantDraft.dbName = record.dbName;
    tenantDraft.dbUser = record.dbUser;
    tenantDraft.dbPassword = record.dbPassword;
    tenantDraft.managedDatabaseId = record.id;
  }

  private async getByIdOrThrow(id: string): Promise<ManagedDatabase> {
    const record = await this.managedDbRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Managed database not found');
    }
    return record;
  }

  private resolveConnection(payload: CreateManagedDatabaseDto) {
    return {
      dbHost: payload.dbHost || this.configService.get<string>('DB_HOST') || 'localhost',
      dbPort: payload.dbPort || Number(this.configService.get<string>('DB_PORT') || 5432),
      dbName: payload.dbName.trim(),
      dbUser:
        payload.dbUser?.trim() ||
        this.configService.get<string>('DB_USER') ||
        'postgres',
      dbPassword:
        payload.dbPassword?.trim() ||
        this.configService.get<string>('DB_PASSWORD') ||
        '',
    };
  }

  private sanitize(record: ManagedDatabase) {
    const { dbPassword, ...safe } = record;
    return safe;
  }
}
