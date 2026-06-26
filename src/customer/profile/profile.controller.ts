import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Req,
  Query,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CustomerProfileService } from './profile.service';
import {
  CreateCustomerProfileDto,
  UpdateCustomerProfileDto,
} from '../../dto/customer-profile.dto';
import { CustomerProtected } from '../../auth/customer-protected.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Customer | Profile')
@CustomerProtected()
@Controller('customer/profile')
export class CustomerProfileController {
  constructor(private readonly profileService: CustomerProfileService) {}

  @Post()
  @ApiOperation({ summary: 'Create customer profile' })
  @ApiResponse({ status: 201, description: 'Profile created successfully' })
  @ApiResponse({ status: 409, description: 'Email/phone in use' })
  async createProfile(@Body() dto: CreateCustomerProfileDto) {
    return this.profileService.createProfile(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get customer profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfile(@CurrentUser() user: any) {
    return this.profileService.getProfile(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Update customer profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 409, description: 'Phone number already in use' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.profileService.updateProfile(user.id, dto);
  }

  @Post('fcm-token')
  @ApiOperation({ summary: 'Register/Update FCM token for push notifications' })
  @ApiResponse({
    status: 200,
    description: 'FCM token registered successfully',
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async registerFCMToken(
    @CurrentUser() user: any,
    @Body() dto: { fcmToken: string },
  ) {
    return this.profileService.registerFCMToken(user.id, dto.fcmToken);
  }

  @Get('admin-phone')
  @ApiOperation({ summary: 'Get admin phone number for support' })
  @ApiResponse({
    status: 200,
    description: 'Admin phone number retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async getAdminPhone() {
    return this.profileService.getAdminPhone();
  }

  @Delete()
  @ApiOperation({ summary: 'Delete customer profile' })
  @ApiResponse({ status: 200, description: 'Profile deleted successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async deleteProfile(@CurrentUser() user: any) {
    return this.profileService.deleteAccount(user.id);
  }
}
