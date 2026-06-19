import { Injectable, NotFoundException, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Role } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CreateUserDto } from '../../dto/create-user.dto';
import { TenantSubscriptionService } from '../../super-admin/billing/tenant-subscription.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class InternalAuthService {
  private readonly logger = new Logger(InternalAuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantSubscriptionService: TenantSubscriptionService,
  ) { }

  async getLoginData(identifier: string, role: Role) {
    this.logger.log(`Getting login data for identifier: ${identifier}, role: ${role}`);
    
    // Find user by email or username
    const user = await this.userRepository.findOne({
      where: [
        { email: identifier, role, isActive: true },
        { username: identifier, role, isActive: true },
      ],
    });

    if (!user) {
      // Check if user exists but with different conditions
      const userWithoutRoleCheck = await this.userRepository.findOne({
        where: [
          { email: identifier },
          { username: identifier },
        ],
      });

      if (userWithoutRoleCheck) {
        if (userWithoutRoleCheck.role !== role) {
          this.logger.warn(`User found but role mismatch. Expected: ${role}, Found: ${userWithoutRoleCheck.role}`);
        }
        if (!userWithoutRoleCheck.isActive) {
          this.logger.warn(`User found but is not active: ${identifier}`);
        }
      } else {
        this.logger.warn(`User not found with identifier: ${identifier}`);
      }
      
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      this.logger.error(`User ${user.id} has no password set`);
      throw new UnauthorizedException('Password not set');
    }

    this.logger.log(`Login data retrieved successfully for user: ${user.id}`);
    return {
      userId: user.id,
      identifier: user.email || user.username,
      password: user.password,
      role: user.role,
      tenantId: user.tenantId || null,
    };
  }

  async getAdminLoginData(identifier: string) {
    this.logger.log(`Getting admin login data for identifier: ${identifier}`);

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.isActive = true')
      .andWhere('user.role IN (:...roles)', {
        roles: [Role.ADMIN, Role.SUPER_ADMIN],
      })
      .andWhere('(user.email = :identifier OR user.username = :identifier)', {
        identifier,
      })
      .getOne();

    if (!user) {
      const inactiveOrWrongRole = await this.userRepository.findOne({
        where: [{ email: identifier }, { username: identifier }],
      });

      if (inactiveOrWrongRole) {
        if (!inactiveOrWrongRole.isActive) {
          this.logger.warn(`Admin user is inactive: ${identifier}`);
        }
        if (![Role.ADMIN, Role.SUPER_ADMIN].includes(inactiveOrWrongRole.role)) {
          this.logger.warn(
            `User found but is not an admin: ${identifier}, role=${inactiveOrWrongRole.role}`,
          );
        }
      } else {
        this.logger.warn(`Admin user not found with identifier: ${identifier}`);
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      this.logger.error(`User ${user.id} has no password set`);
      throw new UnauthorizedException('Password not set');
    }

    let tenant: Record<string, unknown> | null = null;
    let billing: Record<string, unknown> | null = null;
    if (user.tenantId) {
      const tenantRecord = await this.tenantRepository.findOne({
        where: { id: user.tenantId },
      });

      if (tenantRecord) {
        const { dbPassword, dbUser, dbHost, dbPort, dbName, ...safeTenant } =
          tenantRecord;
        tenant = safeTenant;
      }

      if (user.role === Role.ADMIN) {
        billing = await this.tenantSubscriptionService.getAdminBillingStatus(
          user.tenantId,
        );
      }
    }

    this.logger.log(`Admin login data retrieved successfully for user: ${user.id}`);
    return {
      userId: user.id,
      identifier: user.email || user.username,
      password: user.password,
      role: user.role,
      tenantId: user.tenantId || null,
      tenant,
      billing,
    };
  }

  async validateEmail(email: string, role?: Role) {
    const normalizedEmail = email.trim().toLowerCase();

    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.isActive = true')
      .andWhere(
        '(LOWER(user.email) = :email OR LOWER(user.username) = :email)',
        { email: normalizedEmail },
      );

    if (role) {
      qb.andWhere('user.role = :role', { role });
    }

    const user = await qb.getOne();

    if (!user) {
      throw new NotFoundException('Email not found');
    }

    if (role && user.role !== role) {
      throw new NotFoundException('Email not found for the specified role');
    }

    return { exists: true, email: user.email };
  }

  async updatePassword(email: string, newPassword: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.isActive = true')
      .andWhere('LOWER(user.email) = :email', { email: normalizedEmail })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Password is already hashed from Auth Service
    user.password = newPassword;
    await this.userRepository.save(user);

    return { success: true };
  }

  async createUser(dto: CreateUserDto) {
    const { email, phone, username } = dto;

    if (email) {
      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    if (username) {
      const existingUser = await this.userRepository.findOne({ where: { username } });
      if (existingUser) {
        throw new ConflictException('Username already exists');
      }
    }

    if (phone) {
      const existingUser = await this.userRepository.findOne({ where: { phone } });
      if (existingUser) {
        throw new ConflictException('Phone already exists');
      }
    }

    
    const user = this.userRepository.create({
      ...dto,
      password: dto.password ? await bcrypt.hash(dto.password, 10) : null,
      isActive: true,
    });

    await this.userRepository.save(user);

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
  }
}

