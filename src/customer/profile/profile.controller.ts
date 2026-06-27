import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CustomerProfileService } from './profile.service';
import {
  CreateCustomerProfileDto,
  UpdateCustomerProfileDto,
} from '../../dto/customer-profile.dto';
import { CustomerProtected } from '../../auth/customer-protected.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ParseMultipartPipe } from '../../common/pipes/parse-multipart.pipe';
import { mkdirSync } from 'fs';

mkdirSync('./uploads/customer-profiles', { recursive: true });

const profilePicStorage = diskStorage({
  destination: './uploads/customer-profiles',
  filename: (_req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const profilePicInterceptor = FileInterceptor('profilePic', {
  storage: profilePicStorage,
  fileFilter: (_req, file, callback) => {
    const fileExt = extname(file.originalname).toLowerCase();
    if (
      !allowedExtensions.includes(fileExt) ||
      !allowedMimes.includes(file.mimetype)
    ) {
      return callback(
        new Error('Only JPG, PNG, and WEBP image files are allowed'),
        false,
      );
    }
    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const createProfileBodySchema = {
  type: 'object',
  required: ['name', 'email', 'phone', 'houseNo', 'landmark', 'area'],
  properties: {
    name: { type: 'string', example: 'John Doe' },
    email: { type: 'string', example: 'john@example.com' },
    phone: { type: 'string', example: '+919876543210' },
    houseNo: { type: 'string', example: 'A-101' },
    landmark: { type: 'string', example: 'Near Park' },
    area: { type: 'string', example: 'Kothrud' },
    latitude: { type: 'number', example: 18.5204, nullable: true },
    longitude: { type: 'number', example: 73.8567, nullable: true },
    profilePic: {
      type: 'string',
      format: 'binary',
      nullable: true,
      description: 'Optional profile picture (JPG, PNG, WEBP; max 5MB)',
    },
  },
};

const updateProfileBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', example: 'John Doe', nullable: true },
    email: { type: 'string', example: 'john@example.com', nullable: true },
    phone: { type: 'string', example: '+919876543210', nullable: true },
    houseNo: { type: 'string', example: 'A-101', nullable: true },
    landmark: { type: 'string', example: 'Near Park', nullable: true },
    area: { type: 'string', example: 'Kothrud', nullable: true },
    latitude: { type: 'number', example: 18.5204, nullable: true },
    longitude: { type: 'number', example: 73.8567, nullable: true },
    profilePic: {
      type: 'string',
      format: 'binary',
      nullable: true,
      description: 'Optional profile picture (JPG, PNG, WEBP; max 5MB)',
    },
  },
};

@ApiTags('Customer | Profile')
@CustomerProtected()
@Controller('customer/profile')
export class CustomerProfileController {
  constructor(private readonly profileService: CustomerProfileService) {}

  @Post()
  @ApiOperation({ summary: 'Create customer profile' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: createProfileBodySchema })
  @ApiResponse({ status: 201, description: 'Profile created successfully' })
  @ApiResponse({ status: 409, description: 'Email/phone in use' })
  @UseInterceptors(profilePicInterceptor)
  async createProfile(
    @Body(ParseMultipartPipe) dto: CreateCustomerProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const profilePic = file
      ? `/uploads/customer-profiles/${file.filename}`
      : null;
    return this.profileService.createProfile(dto, profilePic);
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: updateProfileBodySchema })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 409, description: 'Phone number already in use' })
  @UseInterceptors(profilePicInterceptor)
  async updateProfile(
    @CurrentUser() user: any,
    @Body(ParseMultipartPipe) dto: UpdateCustomerProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const profilePic = file
      ? `/uploads/customer-profiles/${file.filename}`
      : undefined;
    return this.profileService.updateProfile(user.id, dto, profilePic);
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
