import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from '../../entities/refresh-token.entity';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getExpiryDate() {
    const days =
      Number(this.configService.get('REFRESH_TOKEN_EXPIRY_DAYS')) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  async issueToken(input: {
    userId: string;
    role: string;
    tenantId?: string | null;
  }) {
    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.getExpiryDate();

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: input.userId,
        role: input.role,
        tenantId: input.tenantId || null,
        tokenHash,
        expiresAt,
        revoked: false,
      }),
    );

    return { refreshToken: rawToken, expiresAt };
  }

  async validateAndRotate(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    stored.revoked = true;
    await this.refreshTokenRepo.save(stored);

    return {
      userId: stored.userId,
      role: stored.role,
      tenantId: stored.tenantId,
    };
  }

  async revokeAllForUser(userId: string) {
    await this.refreshTokenRepo.update(
      { userId, revoked: false },
      { revoked: true },
    );
  }

  async purgeExpired() {
    await this.refreshTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpiredCron() {
    await this.purgeExpired();
  }
}
