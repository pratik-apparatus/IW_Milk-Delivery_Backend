import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminProfileService } from './profile.services';
import { UpdateAdminProfileDto } from '../../dto/admin-profile.dto';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminProtected } from '../../auth/admin-protected.decorator';

@ApiTags('Admin | Profile')
@AdminProtected()
@Controller('admin/profile')
export class AdminProfileController {
    constructor(private readonly profileService: AdminProfileService) { }

    @Get()
    @ApiOperation({ summary: 'Get admin profile' })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Admin profile not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getProfile(@CurrentUser() user: any) {
        return this.profileService.getProfile(user.id);
    }

    @Put()
    @ApiOperation({ summary: 'Update admin profile' })
    @ApiResponse({ status: 200, description: 'Profile updated successfully' })
    @ApiResponse({ status: 404, description: 'Admin profile not found' })
    @ApiResponse({ status: 409, description: 'Email/phone/username already in use' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async updateProfile(
        @CurrentUser() user: any,
        @Body() dto: UpdateAdminProfileDto
    ) {
        return this.profileService.updateProfile(user.id, dto);
    }
}
