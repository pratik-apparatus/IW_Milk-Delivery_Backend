import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Query,
  UseGuards,
  Param,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import {
  WalletBalanceResDto,
  WalletTransactionResDto,
  AddMoneyDto,
} from '../../dto/wallet.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Customer | Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('add-money')
  @ApiOperation({ summary: 'Add money to wallet' })
  @ApiResponse({ status: 201, description: 'Money added successfully' })
  async addMoney(@CurrentUser() user: any, @Body() dto: AddMoneyDto) {
    return this.walletService.creditWallet(
      user.id,
      dto.amount,
      'MANUAL_RECHARGE',
      'Added money via manual recharge',
    );
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: WalletBalanceResDto,
  })
  async getBalance(@CurrentUser() user: any) {
    return this.walletService.getBalance(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved with pagination',
  })
  async getTransactions(
    @CurrentUser() user: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.walletService.getTransactions(user.id, query);
  }
}
