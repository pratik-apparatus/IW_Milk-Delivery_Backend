import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Client } from 'pg';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import {
  resolveTenantDbConnection,
  TenantDbConnectionConfig,
} from '../../common/database/tenant-data-source.util';
import { TestDbConnectionDto } from './dto/test-db-connection.dto';
import { UpdateTenantDbDto } from './dto/update-tenant-db.dto';
import { TenantDatabaseService } from '../../common/database/tenant-database.service';

export type TenantDbTestResult = {
  tenantId: string | null;
  connected: boolean;
  latencyMs: number | null;
  checkedAt: string;
  connection: {
    host: string;
    port: number;
    database: string;
    user: string;
  } | null;
  error: string | null;
};

export type TenantDbHealthResult = {
  tenantId: string;
  status: 'healthy' | 'unhealthy' | 'not_configured';
  checkedAt: string;
  connection: {
    host: string;
    port: number;
    database: string;
    user: string;
  } | null;
  metrics: {
    latencyMs: number | null;
    postgresVersion: string | null;
    databaseExists: boolean | null;
    databaseSizeBytes: number | null;
    databaseSizeHuman: string | null;
    activeConnections: number | null;
    publicTableCount: number | null;
  };
  error: string | null;
};

export type TenantDbConfigResult = {
  tenantId: string;
  configured: boolean;
  connection: {
    host: string;
    port: number;
    database: string;
    user: string;
  } | null;
};

export type TenantDbMutationResult = {
  tenantId: string;
  success: boolean;
  message: string;
  database: string | null;
};

export type TenantDbAttachResult = {
  tenantId: string;
  message: string;
  config: TenantDbConfigResult;
  connectionTest: TenantDbTestResult;
  databaseCreated: boolean;
};

@Injectable()
export class TenantDbService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantDatabaseService: TenantDatabaseService,
  ) {}

  async getDbConfig(tenantId: string): Promise<TenantDbConfigResult> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const config = this.resolveDbConfig(tenant);

    return {
      tenantId,
      configured: Boolean(config),
      connection: config ? this.toSafeConnection(config) : null,
    };
  }

  async createDatabase(tenantId: string): Promise<TenantDbMutationResult> {
    const tenant = await this.getTenantOrThrow(tenantId);
    if (!tenant.dbName) {
      throw new BadRequestException(
        'Tenant database name (dbName) must be configured before creating a database',
      );
    }

    const created = await this.createDatabaseIfMissing(tenant);
    return {
      tenantId,
      success: true,
      message: created
        ? `Database "${tenant.dbName}" created successfully`
        : `Database "${tenant.dbName}" already exists`,
      database: tenant.dbName,
    };
  }

  async updateDbConfig(
    tenantId: string,
    payload: UpdateTenantDbDto,
  ): Promise<TenantDbConfigResult> {
    const tenant = await this.getTenantOrThrow(tenantId);

    if (payload.dbHost !== undefined) tenant.dbHost = payload.dbHost;
    if (payload.dbPort !== undefined) tenant.dbPort = payload.dbPort;
    if (payload.dbName !== undefined) tenant.dbName = payload.dbName;
    if (payload.dbUser !== undefined) tenant.dbUser = payload.dbUser;
    if (payload.dbPassword !== undefined) {
      tenant.dbPassword = payload.dbPassword;
    }

    await this.tenantRepo.save(tenant);

    const config = this.resolveDbConfig(tenant);
    return {
      tenantId,
      configured: Boolean(config),
      connection: config ? this.toSafeConnection(config) : null,
    };
  }

  async deleteDatabase(tenantId: string): Promise<TenantDbMutationResult> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const dropResult = await this.dropTenantDatabase(tenant);

    return {
      tenantId,
      success: dropResult.dropped,
      message: dropResult.dropped
        ? `Database "${dropResult.database}" dropped successfully`
        : dropResult.database
          ? `Database "${dropResult.database}" does not exist`
          : 'Tenant has no database configured',
      database: dropResult.database,
    };
  }

  async attachDatabaseToTenant(
    tenantId: string,
    payload: UpdateTenantDbDto,
  ): Promise<TenantDbAttachResult> {
    const config = await this.updateDbConfig(tenantId, payload);
    const tenant = await this.getTenantOrThrow(tenantId);

    const databaseCreated = await this.createDatabaseIfMissing(tenant);
    await this.verifyConnection(tenant);
    await this.tenantDatabaseService.initializeTenantSchema(tenant);
    const connectionTest = await this.testConnectionForTenant(tenant, tenantId);

    if (!connectionTest.connected) {
      throw new BadRequestException(
        connectionTest.error || 'Database connection failed after attach',
      );
    }

    return {
      tenantId,
      message: databaseCreated
        ? 'Database attached, created, and schema initialized'
        : 'Database attached and schema verified',
      config,
      connectionTest,
      databaseCreated,
    };
  }

  async testConnection(tenantId: string): Promise<TenantDbTestResult> {
    const tenant = await this.getTenantOrThrow(tenantId);
    return this.testConnectionForTenant(tenant, tenantId);
  }

  async testConnectionWithConfig(
    payload: TestDbConnectionDto,
  ): Promise<TenantDbTestResult> {
    return this.testConnectionForTenant(this.toConnectionTenant(payload), null);
  }

  async testConnectionForManagedDatabase(
    databaseId: string,
    connection: {
      dbHost: string;
      dbPort: number;
      dbName: string;
      dbUser: string;
      dbPassword: string;
    },
  ): Promise<TenantDbTestResult> {
    return this.testConnectionForTenant(this.toConnectionTenant(connection), databaseId);
  }

  toConnectionTenant(connection: {
    dbHost?: string | null;
    dbPort?: number | null;
    dbName: string;
    dbUser?: string | null;
    dbPassword?: string | null;
  }): Tenant {
    return {
      dbHost: connection.dbHost || null,
      dbPort: connection.dbPort || null,
      dbName: connection.dbName,
      dbUser: connection.dbUser || null,
      dbPassword: connection.dbPassword || null,
    } as Tenant;
  }

  async getDbHealthForConnection(
    databaseId: string,
    connection: Tenant,
  ): Promise<TenantDbHealthResult> {
    const config = this.resolveDbConfig(connection);
    const checkedAt = new Date().toISOString();

    if (!config) {
      return {
        tenantId: databaseId,
        status: 'not_configured',
        checkedAt,
        connection: null,
        metrics: this.emptyMetrics(),
        error: 'Database is not configured (dbName is required)',
      };
    }

    const startedAt = Date.now();
    try {
      const databaseExists = await this.databaseExists(config);
      if (!databaseExists) {
        return {
          tenantId: databaseId,
          status: 'unhealthy',
          checkedAt,
          connection: this.toSafeConnection(config),
          metrics: {
            ...this.emptyMetrics(),
            databaseExists: false,
          },
          error: `Database "${config.database}" does not exist on ${config.host}:${config.port}`,
        };
      }

      const [versionRow, sizeRow, connectionsRow, tablesRow] =
        await this.runQueries(config, [
          'SELECT version() AS version',
          'SELECT pg_database_size(current_database()) AS size_bytes',
          `SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()`,
          `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`,
        ]);

      const latencyMs = Date.now() - startedAt;
      const databaseSizeBytes = Number(sizeRow?.size_bytes ?? 0);

      return {
        tenantId: databaseId,
        status: 'healthy',
        checkedAt,
        connection: this.toSafeConnection(config),
        metrics: {
          latencyMs,
          postgresVersion: this.parsePostgresVersion(versionRow?.version),
          databaseExists: true,
          databaseSizeBytes,
          databaseSizeHuman: this.formatBytes(databaseSizeBytes),
          activeConnections: Number(connectionsRow?.count ?? 0),
          publicTableCount: Number(tablesRow?.count ?? 0),
        },
        error: null,
      };
    } catch (error: any) {
      return {
        tenantId: databaseId,
        status: 'unhealthy',
        checkedAt,
        connection: this.toSafeConnection(config),
        metrics: {
          ...this.emptyMetrics(),
          latencyMs: Date.now() - startedAt,
        },
        error: error?.message || 'Database health check failed',
      };
    }
  }

  async getDbHealth(tenantId: string): Promise<TenantDbHealthResult> {
    const tenant = await this.getTenantOrThrow(tenantId);
    return this.getDbHealthForConnection(tenantId, tenant);
  }

  async verifyConnection(tenant: Tenant): Promise<void> {
    const result = await this.testConnectionForTenant(tenant, tenant.id);
    if (!result.connected) {
      throw new BadRequestException(
        result.error || 'Tenant database connection failed',
      );
    }
  }

  async prepareDatabaseForTenant(tenant: Tenant): Promise<void> {
    if (!tenant.dbName) {
      throw new BadRequestException(
        'Tenant database name (dbName) is required before provisioning',
      );
    }

    await this.verifyPostgresAdminConnection(tenant);
    await this.createDatabaseIfMissing(tenant);
    await this.verifyConnection(tenant);
  }

  async createDatabaseIfMissing(tenant: Tenant): Promise<boolean> {
    if (!tenant.dbName) {
      return false;
    }

    const adminConfig = this.resolveAdminDbConfig(tenant);
    const adminClient = new Client({
      host: adminConfig.host,
      port: adminConfig.port,
      user: adminConfig.username,
      password: adminConfig.password,
      database: 'postgres',
      connectionTimeoutMillis: 10000,
    });

    await adminClient.connect();
    try {
      const exists = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [tenant.dbName],
      );

      if ((exists.rowCount ?? 0) > 0) {
        return false;
      }

      await adminClient.query(`CREATE DATABASE "${tenant.dbName}"`);
      return true;
    } finally {
      await adminClient.end();
    }
  }

  async dropTenantDatabase(tenant: Tenant): Promise<{
    dropped: boolean;
    database: string | null;
  }> {
    if (!tenant.dbName) {
      return { dropped: false, database: null };
    }

    const adminConfig = this.resolveAdminDbConfig(tenant);
    const adminClient = new Client({
      host: adminConfig.host,
      port: adminConfig.port,
      user: adminConfig.username,
      password: adminConfig.password,
      database: 'postgres',
      connectionTimeoutMillis: 10000,
    });

    await adminClient.connect();
    try {
      const exists = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [tenant.dbName],
      );

      if ((exists.rowCount ?? 0) === 0) {
        return { dropped: false, database: tenant.dbName };
      }

      await adminClient.query(
        `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `,
        [tenant.dbName],
      );

      await adminClient.query(`DROP DATABASE "${tenant.dbName}"`);
      return { dropped: true, database: tenant.dbName };
    } finally {
      await adminClient.end();
    }
  }

  private async testConnectionForTenant(
    tenant: Tenant,
    tenantId: string | null,
  ): Promise<TenantDbTestResult> {
    const config = this.resolveDbConfig(tenant);
    const checkedAt = new Date().toISOString();

    if (!config) {
      return {
        tenantId,
        connected: false,
        latencyMs: null,
        checkedAt,
        connection: null,
        error: 'Tenant database is not configured (dbName is required)',
      };
    }

    const startedAt = Date.now();
    try {
      await this.runQuery(config, 'SELECT 1');
      return {
        tenantId,
        connected: true,
        latencyMs: Date.now() - startedAt,
        checkedAt,
        connection: this.toSafeConnection(config),
        error: null,
      };
    } catch (error: any) {
      return {
        tenantId,
        connected: false,
        latencyMs: Date.now() - startedAt,
        checkedAt,
        connection: this.toSafeConnection(config),
        error: error?.message || 'Database connection failed',
      };
    }
  }

  private async verifyPostgresAdminConnection(tenant: Tenant): Promise<void> {
    const adminConfig = this.resolveAdminDbConfig(tenant);
    const client = new Client({
      host: adminConfig.host,
      port: adminConfig.port,
      user: adminConfig.username,
      password: adminConfig.password,
      database: 'postgres',
      connectionTimeoutMillis: 10000,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
    } catch (error: any) {
      throw new BadRequestException(
        `Cannot connect to PostgreSQL server at ${adminConfig.host}:${adminConfig.port}: ${error?.message || 'connection failed'}`,
      );
    } finally {
      await client.end();
    }
  }

  private async getTenantOrThrow(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  private resolveDbConfig(
    tenant: Tenant,
  ): TenantDbConnectionConfig | null {
    if (!tenant.dbName) {
      return null;
    }

    return resolveTenantDbConnection(tenant);
  }

  private resolveAdminDbConfig(tenant: Tenant): TenantDbConnectionConfig {
    return resolveTenantDbConnection(tenant);
  }

  private toSafeConnection(config: TenantDbConnectionConfig) {
    return {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
    };
  }

  private emptyMetrics(): TenantDbHealthResult['metrics'] {
    return {
      latencyMs: null,
      postgresVersion: null,
      databaseExists: null,
      databaseSizeBytes: null,
      databaseSizeHuman: null,
      activeConnections: null,
      publicTableCount: null,
    };
  }

  private parsePostgresVersion(version: unknown): string | null {
    if (typeof version !== 'string') {
      return null;
    }
    const match = version.match(/PostgreSQL\s+([^\s,]+)/i);
    return match?.[1] || version;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private async databaseExists(
    config: TenantDbConnectionConfig,
  ): Promise<boolean> {
    const adminConfig: TenantDbConnectionConfig = {
      ...config,
      database: 'postgres',
    };

    const result = await this.runQuery(
      adminConfig,
      'SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1',
      [config.database],
    );
    return Boolean(result);
  }

  private async runQuery(
    config: TenantDbConnectionConfig,
    query: string,
    params: unknown[] = [],
  ): Promise<Record<string, unknown> | null> {
    const rows = await this.runQueries(config, [query], params);
    return rows[0] ?? null;
  }

  private async runQueries(
    config: TenantDbConnectionConfig,
    queries: string[],
    params: unknown[] = [],
  ): Promise<Array<Record<string, unknown> | null>> {
    const client = new Client({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      connectionTimeoutMillis: 10000,
    });

    await client.connect();
    try {
      const results: Array<Record<string, unknown> | null> = [];
      for (const query of queries) {
        const result = await client.query(query, params);
        results.push(result.rows[0] ?? null);
      }
      return results;
    } finally {
      await client.end();
    }
  }
}
