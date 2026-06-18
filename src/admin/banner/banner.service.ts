import { Injectable, NotFoundException } from '@nestjs/common';
import { Banner } from '../../entities/banner.entity';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { applyPagination } from '../../common/utils/pagination.util';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { applyTenantFilter, tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class BannerService {
    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        private readonly tenantContext: TenantContextService,
    ) { }

    async getAllBanners(query: PaginationQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const bannerRepo = await this.tenantRepos.getRepository(Banner);
        const queryBuilder = bannerRepo.createQueryBuilder('banner')
            .orderBy('banner.createdAt', 'DESC');
        applyTenantFilter(queryBuilder, tenantId, 'banner', dedicated);

        return applyPagination(queryBuilder, query.page, query.limit);
    }

    async getActiveBanners() {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const bannerRepo = await this.tenantRepos.getRepository(Banner);
        return bannerRepo.find({
            where: tenantWhere(tenantId, { isActive: true }, dedicated),
            order: { createdAt: 'DESC' }
        });
    }

    async getBannerById(id: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const bannerRepo = await this.tenantRepos.getRepository(Banner);
        const banner = await bannerRepo.findOne({ where: tenantWhere(tenantId, { id }, dedicated) });
        if (!banner) {
            throw new NotFoundException(`Banner with ID ${id} not found`);
        }
        return banner;
    }

    async createBanner(dto: CreateBannerDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const bannerRepo = await this.tenantRepos.getRepository(Banner);
        const newBanner = bannerRepo.create({ ...dto, tenantId: dedicated ? null : tenantId });
        await bannerRepo.save(newBanner);
        return { message: 'Banner created successfully', banner: newBanner };
    }

    async updateBanner(id: string, dto: UpdateBannerDto) {
        const bannerRepo = await this.tenantRepos.getRepository(Banner);
        const banner = await this.getBannerById(id);
        Object.assign(banner, dto);
        await bannerRepo.save(banner);
        return { message: 'Banner updated successfully', banner };
    }

    async toggleBannerStatus(id: string) {
        const bannerRepo = await this.tenantRepos.getRepository(Banner);
        const banner = await this.getBannerById(id);
        banner.isActive = !banner.isActive;
        await bannerRepo.save(banner);
        return { message: `Banner is now ${banner.isActive ? 'Active' : 'Inactive'}`, banner };
    }

    async deleteBanner(id: string) {
        const bannerRepo = await this.tenantRepos.getRepository(Banner);
        const banner = await this.getBannerById(id);
        await bannerRepo.remove(banner);
        return { message: 'Banner deleted successfully' };
    }
}
