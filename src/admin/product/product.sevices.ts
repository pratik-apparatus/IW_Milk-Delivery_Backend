import { Injectable, NotFoundException } from '@nestjs/common';
import { Product } from '../../entities/product.entity';
import { CreateProductDto } from '../../dto/product.dto';
import { ProductQueryDto } from '../../common/dto/pagination-query.dto';
import { applyPagination } from '../../common/utils/pagination.util';
import { applySearch } from '../../common/utils/search.util';
import { NoRecordsFoundException } from '../../common/exceptions/no-records-found.exception';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import {
  applyTenantFilter,
  tenantWhere,
} from '../../common/utils/tenant-scope.util';

@Injectable()
export class ProductService {
  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(dto: CreateProductDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const productRepo = await this.tenantRepos.getRepository(Product);
    const product = productRepo.create({
      ...dto,
      images: dto.images ? dto.images : [],
      remainingQuantity: dto.quantity,
      tenantId: dedicated ? null : tenantId,
    });
    return productRepo.save(product);
  }

  async findAll(query: ProductQueryDto) {
    try {
      const tenantId = this.tenantContext.requireTenantId();
      const dedicated = this.tenantContext.usesDedicatedDatabase();
      const productRepo = await this.tenantRepos.getRepository(Product);
      const { categoryId, minPrice, maxPrice, search, page, limit } = query;

      const qb = productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category');
      applyTenantFilter(qb, tenantId, 'product', dedicated);

      if (categoryId) {
        qb.andWhere('product.categoryId = :categoryId', { categoryId });
      }

      if (minPrice !== undefined) {
        qb.andWhere('product.price >= :minPrice', { minPrice });
      }

      if (maxPrice !== undefined) {
        qb.andWhere('product.price <= :maxPrice', { maxPrice });
      }

      if (search) {
        applySearch(qb, search, ['product.name', 'category.name']);
      }

      qb.orderBy('product.createdAt', 'DESC');

      const result = await applyPagination(qb, page, limit);

      if (search && result.meta.total === 0) {
        throw new NoRecordsFoundException();
      }

      return result;
    } catch (error) {
      throw error;
    }
  }
  async findById(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const productRepo = await this.tenantRepos.getRepository(Product);
    const product = await productRepo.findOne({
      where: tenantWhere(tenantId, { id }, dedicated),
      relations: ['category'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findByCategory(categoryId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const productRepo = await this.tenantRepos.getRepository(Product);
    const product = await productRepo.find({
      where: tenantWhere(tenantId, { categoryId }, dedicated),
      relations: ['category'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    const existing = await this.findById(id);

    const updateData: Partial<Product> = { ...dto };
    if (dto.images !== undefined) {
      updateData.images = dto.images;
    }

    if (dto.quantity !== undefined && dto.quantity !== existing.quantity) {
      const delta = dto.quantity - existing.quantity;
      updateData.remainingQuantity = Math.max(
        0,
        existing.remainingQuantity + delta,
      );
    }

    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const productRepo = await this.tenantRepos.getRepository(Product);
    await productRepo.update(
      tenantWhere(tenantId, { id }, dedicated),
      updateData,
    );

    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const productRepo = await this.tenantRepos.getRepository(Product);
    await productRepo.delete(tenantWhere(tenantId, { id }, dedicated));
    return { message: 'Product deleted successfully' };
  }
}
