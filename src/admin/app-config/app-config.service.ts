import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfig } from '../../entities/app-config.entity';
import { TenantDatabaseService } from '../../common/database/tenant-database.service';
import { CreateAppConfigDto, UpdateAppConfigDto } from './dto/app-config.dto';

@Injectable()
export class AppConfigService {
  constructor(private readonly tenantDatabase: TenantDatabaseService) {}

  private async repo(tenantId: string) {
    return this.tenantDatabase.getRepositoryForTenant(tenantId, AppConfig);
  }

  async getByTenantId(tenantId: string) {
    const appConfigRepo = await this.repo(tenantId);
    const config = await appConfigRepo.findOne({ where: {} });
    if (!config) {
      throw new NotFoundException('App config not found for this tenant');
    }
    return this.toPublicResponse(config, tenantId);
  }

  async create(tenantId: string, dto: CreateAppConfigDto, logoUrl?: string) {
    const appConfigRepo = await this.repo(tenantId);
    const existing = await appConfigRepo.findOne({ where: {} });
    if (existing) {
      throw new ConflictException(
        'App config already exists for this tenant. Use PUT to update.',
      );
    }

    const config = appConfigRepo.create({
      tenantId,
      logoUrl: logoUrl || null,
      theme: dto.theme || null,
      primaryColor: dto.primaryColor || null,
      secondaryColor: dto.secondaryColor || null,
      styleVariables: dto.styleVariables || {},
      fontFamily: dto.fontFamily || null,
    });

    const saved = await appConfigRepo.save(config);
    return {
      message: 'App config created successfully',
      config: this.toPublicResponse(saved, tenantId),
    };
  }

  async update(
    tenantId: string,
    dto: UpdateAppConfigDto,
    logoUrl?: string,
  ) {
    const appConfigRepo = await this.repo(tenantId);
    const config = await appConfigRepo.findOne({ where: {} });
    if (!config) {
      throw new NotFoundException('App config not found for this tenant');
    }

    if (logoUrl) {
      config.logoUrl = logoUrl;
    }
    if (dto.theme !== undefined) {
      config.theme = dto.theme;
    }
    if (dto.primaryColor !== undefined) {
      config.primaryColor = dto.primaryColor;
    }
    if (dto.secondaryColor !== undefined) {
      config.secondaryColor = dto.secondaryColor;
    }
    if (dto.styleVariables !== undefined) {
      config.styleVariables = dto.styleVariables;
    }
    if (dto.fontFamily !== undefined) {
      config.fontFamily = dto.fontFamily;
    }

    const saved = await appConfigRepo.save(config);
    return {
      message: 'App config updated successfully',
      config: this.toPublicResponse(saved, tenantId),
    };
  }

  async upsert(
    tenantId: string,
    dto: UpdateAppConfigDto,
    logoUrl?: string,
  ) {
    const appConfigRepo = await this.repo(tenantId);
    const existing = await appConfigRepo.findOne({ where: {} });
    if (existing) {
      return this.update(tenantId, dto, logoUrl);
    }
    return this.create(tenantId, dto, logoUrl);
  }

  async remove(tenantId: string) {
    const appConfigRepo = await this.repo(tenantId);
    const config = await appConfigRepo.findOne({ where: {} });
    if (!config) {
      throw new NotFoundException('App config not found for this tenant');
    }

    await appConfigRepo.remove(config);
    return { message: 'App config deleted successfully' };
  }

  private toPublicResponse(config: AppConfig, tenantId: string) {
    return {
      tenantId: config.tenantId || tenantId,
      logoUrl: config.logoUrl,
      theme: config.theme,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      styleVariables: config.styleVariables,
      fontFamily: config.fontFamily,
      styleTag: this.buildStyleTag(config),
      updatedAt: config.updatedAt,
    };
  }

  private buildStyleTag(config: AppConfig) {
    if (!config.fontFamily) {
      return null;
    }

    return `:root { --app-font-family: ${config.fontFamily}; } body { font-family: var(--app-font-family); }`;
  }
}
