import { Controller, Post, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import {
    CreateRazorpayOrderDto,
    CreateRazorpayOrderResDto,
    VerifyRazorpayPaymentDto,
    VerifyPaymentResDto
} from '../../dto/payment.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Customer | Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments/razorpay')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Post('create-order')
    @ApiOperation({ summary: 'Create Razorpay order for adding money to wallet' })
    @ApiResponse({ status: 201, description: 'Order created successfully', type: CreateRazorpayOrderResDto })
    @ApiResponse({ status: 400, description: 'Invalid amount' })
    async createOrder(
        @CurrentUser() user: any,
        @Req() req: any,
        @Body() dto: CreateRazorpayOrderDto
    ) {
        return this.paymentService.createRazorpayOrder(
            user.id,
            dto.amount,
            req.tenantId || user.tenantId || null,
        );
    }

    @Post('verify')
    @ApiOperation({ summary: 'Verify Razorpay payment and credit wallet' })
    @ApiResponse({ status: 200, description: 'Payment verified and wallet credited', type: VerifyPaymentResDto })
    @ApiResponse({ status: 400, description: 'Invalid signature or order ID' })
    @ApiResponse({ status: 409, description: 'Payment already processed' })
    async verifyPayment(
        @CurrentUser() user: any,
        @Req() req: any,
        @Body() dto: VerifyRazorpayPaymentDto
    ) {
        return this.paymentService.verifyPayment(
            user.id,
            dto.razorpay_order_id,
            dto.razorpay_payment_id,
            dto.razorpay_signature,
            req.tenantId || user.tenantId || null,
        );
    }
}
