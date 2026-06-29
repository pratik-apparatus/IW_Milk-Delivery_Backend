import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../../entities/admin.entity';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { UpdateAdminProfileDto } from '../../dto/admin-profile.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '../../entities/user.entity';

function sanitizeTenantForAdmin(tenant: Tenant) {
  const { dbPassword, dbUser, dbHost, dbPort, dbName, ...safeTenant } = tenant;
  return safeTenant;
}

@Injectable()
export class AdminProfileService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Get admin profile by user ID
   */
  async getProfile(userId: string, tenant?: Tenant) {
    // Find admin by userId and role
    const admin = await this.adminRepo.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!admin) {
      throw new NotFoundException('Admin profile not found');
    }

    const safeTenant = tenant ? sanitizeTenantForAdmin(tenant) : null;

    return {
      id: admin.id,
      userId: admin.userId,
      username: admin.user.username,
      email: admin.user.email,
      phone: admin.user.phone,
      role: admin.user.role,
      isActive: admin.user.isActive,
      address: admin.user.address,
      latitude: admin.user.latitude ? Number(admin.user.latitude) : null,
      longitude: admin.user.longitude ? Number(admin.user.longitude) : null,
      createdAt: admin.user.createdAt,
      tenantId: admin.user.tenantId || safeTenant?.id || null,
      enabledApps: safeTenant?.enabledApps,
      appSettings: safeTenant?.appSettings,
      tenant: safeTenant,
    };
  }

  /**
   * Update admin profile
   */
  async updateProfile(userId: string, dto: UpdateAdminProfileDto) {
    // Find admin by userId
    const admin = await this.adminRepo.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!admin) {
      throw new NotFoundException('Admin profile not found');
    }

    const user = admin.user;

    // Check email uniqueness if changing
    if (dto.email && dto.email !== user.email) {
      const existingByEmail = await this.userRepo.findOne({
        where: { email: dto.email },
      });

      if (existingByEmail) {
        throw new ConflictException('Email already in use');
      }
    }

    // Check phone uniqueness if changing
    if (dto.phone && dto.phone !== user.phone) {
      const existingByPhone = await this.userRepo.findOne({
        where: { phone: dto.phone },
      });

      if (existingByPhone) {
        throw new ConflictException('Phone number already in use');
      }
    }

    // Check username uniqueness if changing
    if (dto.username && dto.username !== user.username) {
      const existingByUsername = await this.userRepo.findOne({
        where: { username: dto.username },
      });

      if (existingByUsername) {
        throw new ConflictException('Username already in use');
      }
    }

    // Update user fields
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.latitude !== undefined) user.latitude = dto.latitude;
    if (dto.longitude !== undefined) user.longitude = dto.longitude;

    // Hash password if provided
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }

    await this.userRepo.save(user);

    // Return updated profile without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      id: admin.id,
      userId: admin.userId,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      address: user.address,
      latitude: user.latitude ? Number(user.latitude) : null,
      longitude: user.longitude ? Number(user.longitude) : null,
      createdAt: user.createdAt,
    };
  }
}
