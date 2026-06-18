import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client } from 'pg';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';

export type TenantDbConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
};

export type TenantDbTestResult = {
  tenantId: string;
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

@Injectable()
export class TenantDbService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly configService: ConfigService,
  ) {}

  async testConnection(tenantId: string): Promise<TenantDbTestResult> {
    const tenant = await this.getTenantOrThrow(tenantId);
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

  async getDbHealth(tenantId: string): Promise<TenantDbHealthResult> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const config = this.resolveDbConfig(tenant);
    const checkedAt = new Date().toISOString();

    if (!config) {
      return {
        tenantId,
        status: 'not_configured',
        checkedAt,
        connection: null,
        metrics: this.emptyMetrics(),
        error: 'Tenant database is not configured (dbName is required)',
      };
    }

    const startedAt = Date.now();
    try {
      const databaseExists = await this.databaseExists(config);
      if (!databaseExists) {
        return {
          tenantId,
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
        tenantId,
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
        tenantId,
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

  async verifyConnection(tenant: Tenant): Promise<void> {
    const config = this.resolveDbConfig(tenant);
    if (!config) {
      return;
    }
    await this.runQuery(config, 'SELECT 1');
  }

  private async getTenantOrThrow(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  private resolveDbConfig(tenant: Tenant): TenantDbConnectionConfig | null {
    if (!tenant.dbName) {
      return null;
    }

    return {
      host: tenant.dbHost || this.configService.get<string>('DB_HOST') || 'localhost',
      port: tenant.dbPort || Number(this.configService.get<string>('DB_PORT') || 5432),
      user: tenant.dbUser || this.configService.get<string>('DB_USER') || 'postgres',
      password: tenant.dbPassword || this.configService.get<string>('DB_PASSWORD') || undefined,
      database: tenant.dbName,
    };
  }

  private toSafeConnection(config: TenantDbConnectionConfig) {
    return {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
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

  private async databaseExists(config: TenantDbConnectionConfig): Promise<boolean> {
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
      user: config.user,
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
