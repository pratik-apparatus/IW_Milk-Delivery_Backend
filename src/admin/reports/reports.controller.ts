import { Controller, Get, Query, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { SalesReportQueryDto } from './dto/sales-report.query.dto';
import { BaseReportQueryDto } from './dto/base-report.query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AdminProtected } from '../../auth/admin-protected.decorator';

@ApiTags('Admin Reports')
@AdminProtected()
@Controller('admin/reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('overview')
    @ApiOperation({ summary: 'Show dashboard summary numbers' })
    async getOverview() {
        return this.reportsService.getOverview();
    }

    @Get('sales')
    @ApiOperation({ summary: 'Used for daily / weekly / monthly sales graph' })
    async getSalesReport(@Query() query: SalesReportQueryDto) {
        return this.reportsService.getSalesReport(query);
    }

    @Get('products/best-selling')
    @ApiOperation({ summary: 'Identify top selling products' })
    async getBestSelling(@Query() query: PaginationQueryDto) {
        return this.reportsService.getBestSellingProducts(query);
    }

    @Get('products/least-selling')
    @ApiOperation({ summary: 'Identify low performing products' })
    async getLeastSelling(@Query() query: PaginationQueryDto) {
        return this.reportsService.getLeastSellingProducts(query);
    }

    @Get('subscriptions/trends')
    @ApiOperation({ summary: 'Graph showing new subscriptions over time' })
    async getSubscriptionTrends(@Query() query: BaseReportQueryDto) {
        return this.reportsService.getSubscriptionTrends(query);
    }

    @Get('payments')
    @ApiOperation({ summary: 'Fetch all payment transactions for audit' })
    async getPayments(@Query() query: PaginationQueryDto) {
        return this.reportsService.getPaymentTransactions(query);
    }

    @Delete('payments/:paymentId')
    @ApiOperation({ summary: 'Delete payment transaction' })
    async deletePayment(@Param('paymentId') paymentId: string) {
        return this.reportsService.deletePaymentTransactions(paymentId);
    }

    @Get('delivery-partners/performance')
    @ApiOperation({ summary: 'Track Partner Performance' })
    async getPartnerPerformance(@Query() query: PaginationQueryDto) {
        return this.reportsService.getDeliveryPartnerPerformance(query);
    }

    @Delete()
    @ApiOperation({ summary: 'Clear failed payment reports from history' })
    async clearReports() {
        return this.reportsService.clearReports();
    }
}
