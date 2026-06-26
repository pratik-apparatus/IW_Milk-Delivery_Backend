import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantPlan } from '../../entities/tenant-plan.entity';
import {
  TenantSubscription,
  TenantSubscriptionStatus,
} from '../../entities/tenant-subscription.entity';
import { CreateTenantPlanDto } from './dto/create-tenant-plan.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';

@Injectable()
export class TenantPlanService {
  constructor(
    @InjectRepository(TenantPlan)
    private readonly planRepo: Repository<TenantPlan>,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
  ) {}

  create(dto: CreateTenantPlanDto) {
    const plan = this.planRepo.create({
      name: dto.name,
      description: dto.description || null,
      amount: dto.amount,
      durationDays: dto.durationDays ?? 30,
      isActive: true,
    });
    return this.planRepo.save(plan);
  }

  findAll() {
    return this.planRepo.find({ order: { amount: 'ASC' } });
  }

  findActive() {
    return this.planRepo.find({
      where: { isActive: true },
      order: { amount: 'ASC' },
    });
  }

  async findOne(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  async update(id: string, dto: UpdateTenantPlanDto) {
    const plan = await this.findOne(id);
    Object.assign(plan, dto);
    return this.planRepo.save(plan);
  }

  async remove(id: string) {
    const plan = await this.findOne(id);
    const subscriptions = await this.subscriptionRepo.find({
      where: { planId: id },
    });

    const hasLiveSubscription = subscriptions.some(
      (subscription) =>
        subscription.status === TenantSubscriptionStatus.ACTIVE ||
        subscription.status === TenantSubscriptionStatus.PENDING_PAYMENT,
    );

    if (hasLiveSubscription) {
      plan.isActive = false;
      await this.planRepo.save(plan);
      return {
        message:
          'Plan deactivated (tenants with active or pending subscriptions still use this plan)',
        deleted: false,
        deactivated: true,
      };
    }

    if (subscriptions.length > 0) {
      await this.subscriptionRepo.remove(subscriptions);
    }

    await this.planRepo.remove(plan);
    return {
      message: 'Plan deleted successfully',
      deleted: true,
      deactivated: false,
    };
  }
}
