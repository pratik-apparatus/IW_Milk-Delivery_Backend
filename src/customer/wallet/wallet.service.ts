import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction, TransactionType } from '../../entities/wallet-transaction.entity';
import { Customer } from '../../entities/customer.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { applyPagination } from '../../common/utils/pagination.util';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { TenantDatabaseService } from '../../common/database/tenant-database.service';
import { applyTenantFilter, tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class WalletService {
    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly tenantDatabase: TenantDatabaseService,
        private readonly tenantContext: TenantContextService,
    ) { }

    private async createQueryRunner() {
        const tenantId = this.tenantContext.requireTenantId();
        if (this.tenantContext.usesDedicatedDatabase()) {
            const tenantDs = await this.tenantDatabase.getTenantDataSource(tenantId);
            return tenantDs.createQueryRunner();
        }
        return this.dataSource.createQueryRunner();
    }

    async getOrCreateWallet(customerId: string): Promise<Wallet> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const walletRepo = await this.tenantRepos.getRepository(Wallet);
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        let wallet = await walletRepo.findOne({
            where: tenantWhere(tenantId, { customerId }, dedicated),
        });

        if (!wallet) {
            const customer = await customerRepo.findOne({
                where: tenantWhere(tenantId, { id: customerId }, dedicated),
            });

            if (!customer) {
                throw new NotFoundException('Customer not found');
            }

            try {
                wallet = walletRepo.create({
                    customerId,
                    balance: 0,
                    tenantId: dedicated ? null : tenantId,
                });
                wallet = await walletRepo.save(wallet);
            } catch (error: any) {
                if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                    wallet = await walletRepo.findOne({
                        where: tenantWhere(tenantId, { customerId }, dedicated),
                    });
                    if (!wallet) {
                        throw new InternalServerErrorException('Failed to create or retrieve wallet');
                    }
                } else {
                    throw error;
                }
            }
        }

        return wallet;
    }

    async getBalance(customerId: string) {
        const wallet = await this.getOrCreateWallet(customerId);
        return {
            walletId: wallet.id,
            balance: Number(wallet.balance),
        };
    }

    async creditWallet(
        customerId: string,
        amount: number,
        referenceId: string,
        description: string,
    ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
        if (amount <= 0) {
            throw new BadRequestException('Amount must be greater than zero');
        }

        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const queryRunner = await this.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            let wallet = await queryRunner.manager.findOne(Wallet, {
                where: tenantWhere(tenantId, { customerId }, dedicated),
            });

            if (!wallet) {
                try {
                    wallet = queryRunner.manager.create(Wallet, {
                        customerId,
                        balance: 0,
                        tenantId: dedicated ? null : tenantId,
                    });
                    wallet = await queryRunner.manager.save(wallet);
                } catch (error: any) {
                    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                        wallet = await queryRunner.manager.findOne(Wallet, {
                            where: tenantWhere(tenantId, { customerId }, dedicated),
                        });
                        if (!wallet) {
                            throw new InternalServerErrorException('Failed to create or retrieve wallet');
                        }
                    } else {
                        throw error;
                    }
                }
            }

            wallet.balance = Number(wallet.balance) + amount;
            await queryRunner.manager.save(wallet);

            const transaction = queryRunner.manager.create(WalletTransaction, {
                walletId: wallet.id,
                amount,
                type: TransactionType.CREDIT,
                referenceId,
                description,
                tenantId: wallet.tenantId ?? (dedicated ? null : tenantId),
            });
            await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();

            return { wallet, transaction };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new InternalServerErrorException('Failed to credit wallet');
        } finally {
            await queryRunner.release();
        }
    }

    async debitWallet(
        customerId: string,
        amount: number,
        referenceId: string,
        description: string,
    ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
        if (amount <= 0) {
            throw new BadRequestException('Amount must be greater than zero');
        }

        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const queryRunner = await this.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const wallet = await queryRunner.manager.findOne(Wallet, {
                where: tenantWhere(tenantId, { customerId }, dedicated),
            });

            if (!wallet) {
                throw new NotFoundException('Wallet not found');
            }

            if (Number(wallet.balance) < amount) {
                throw new BadRequestException('Insufficient wallet balance');
            }

            wallet.balance = Number(wallet.balance) - amount;
            await queryRunner.manager.save(wallet);

            const transaction = queryRunner.manager.create(WalletTransaction, {
                walletId: wallet.id,
                amount,
                type: TransactionType.DEBIT,
                referenceId,
                description,
                tenantId: wallet.tenantId ?? (dedicated ? null : tenantId),
            });
            await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();

            return { wallet, transaction };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to debit wallet');
        } finally {
            await queryRunner.release();
        }
    }

    async getTransactions(customerId: string, query: PaginationQueryDto) {
        const wallet = await this.getOrCreateWallet(customerId);

        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const transactionRepo = await this.tenantRepos.getRepository(WalletTransaction);
        const queryBuilder = transactionRepo.createQueryBuilder('t')
            .where('t.walletId = :walletId', { walletId: wallet.id });
        applyTenantFilter(queryBuilder, tenantId, 't', dedicated);
        queryBuilder.orderBy('t.createdAt', 'DESC');

        return applyPagination(queryBuilder, query.page, query.limit);
    }

    async hasSufficientBalance(customerId: string, requiredAmount: number): Promise<boolean> {
        const wallet = await this.getOrCreateWallet(customerId);
        return Number(wallet.balance) >= requiredAmount;
    }
}
