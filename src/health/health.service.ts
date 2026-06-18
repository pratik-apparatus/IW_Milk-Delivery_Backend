import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async getHealth() {
    const checks: Record<string, string> = {
      service: 'ok',
    };

    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    const healthy = Object.values(checks).every((value) => value === 'ok');

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      service: 'backend',
      version: this.configService.get('npm_package_version') || '1.0.0',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
