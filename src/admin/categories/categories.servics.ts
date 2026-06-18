import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Category } from '../../entities/categories.entity';
import { CreateCategoryDto } from '../../dto/categories.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { applyPagination } from 'src/common/utils/pagination.util';
import { applySearch } from 'src/common/utils/search.util';
import { NoRecordsFoundException } from 'src/common/exceptions/no-records-found.exception';
import { TenantContextService } from 'src/common/services/tenant-context.service';
import { TenantRepositoryService } from 'src/common/database/tenant-repository.service';
import { applyTenantFilter, tenantWhere } from 'src/common/utils/tenant-scope.util';

@Injectable()
export class CategoryService {
  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const categoryRepo = await this.tenantRepos.getRepository(Category);

    const exists = await categoryRepo.findOne({
      where: tenantWhere(tenantId, { name: dto.name }, dedicated),
    });

    if (exists) {
      throw new ConflictException('Category already exists');
    }

    const category = categoryRepo.create({ ...dto, tenantId: dedicated ? null : tenantId });
    return categoryRepo.save(category);
  }

  async findById(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const categoryRepo = await this.tenantRepos.getRepository(Category);
    const category = await categoryRepo.findOne({
      where: tenantWhere(tenantId, { id }, dedicated),
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async findAll(queryDto: PaginationQueryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const categoryRepo = await this.tenantRepos.getRepository(Category);
    const { page, limit, search } = queryDto;
    const qb = categoryRepo.createQueryBuilder('category');
    applyTenantFilter(qb, tenantId, 'category', dedicated);

    if (search) {
      applySearch(qb, search, ['category.name']);
    }

    qb.orderBy('category.createdAt', 'DESC');

    const result = await applyPagination(qb, page, limit);

    if (search && result.meta.total === 0) {
      throw new NoRecordsFoundException();
    }

    return result;
  }

  async update(id: string, dto: CreateCategoryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const categoryRepo = await this.tenantRepos.getRepository(Category);
    const category = await categoryRepo.findOne({
      where: tenantWhere(tenantId, { id }, dedicated),
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    Object.assign(category, dto);
    return categoryRepo.save(category);
  }

  async delete(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const categoryRepo = await this.tenantRepos.getRepository(Category);
    const category = await categoryRepo.findOne({
      where: tenantWhere(tenantId, { id }, dedicated),
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await categoryRepo.delete(tenantWhere(tenantId, { id }, dedicated));
    return { message: 'Category deleted successfully' };
  }
}
