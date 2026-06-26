import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Admin } from '../../entities/admin.entity';
import { CreateAdminDto } from '../../dto/create-admin.dto';

@Injectable()
export class InternalAdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async createAdmin(dto: CreateAdminDto) {
    const { email, username, phone } = dto;

    // Check for existing user
    if (email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) throw new ConflictException('Email already exists');
    }
    if (username) {
      const existing = await this.userRepository.findOne({
        where: { username },
      });
      if (existing) throw new ConflictException('Username already exists');
    }
    if (phone) {
      const existing = await this.userRepository.findOne({ where: { phone } });
      if (existing) throw new ConflictException('Phone already exists');
    }

    // Create User
    const user = this.userRepository.create({
      ...dto,
      isActive: true,
    });
    const savedUser = await this.userRepository.save(user);

    // Create Admin Profile
    const admin = this.adminRepository.create({
      userId: savedUser.id,
    });
    await this.adminRepository.save(admin);

    return {
      id: savedUser.id, // Returning user ID as 'id' to match AuthService expectation (adminId: response.data.id)
      email: savedUser.email,
      username: savedUser.username,
      role: savedUser.role,
    };
  }
}
