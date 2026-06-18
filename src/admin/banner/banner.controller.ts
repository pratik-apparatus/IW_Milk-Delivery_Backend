import { Controller, Get, Post, Body, Param, Put, Delete, Patch, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BannerService } from './banner.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AdminProtected } from '../../auth/admin-protected.decorator';

const bannerStorage = diskStorage({
    destination: './uploads/banners',
    filename: (req, file, callback) => {
        const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
        callback(null, uniqueName);
    },
});

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

@ApiTags('Admin | Banners')
@AdminProtected()
@Controller('admin/banners')
export class BannerController {
    constructor(private readonly bannerService: BannerService) { }

    @Get()
    @ApiOperation({ summary: 'Get all banners' })
    @ApiResponse({ status: 200, description: 'List of all banners with pagination' })
    getAllBanners(@Query() query: PaginationQueryDto) {
        return this.bannerService.getAllBanners(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single banner' })
    @ApiParam({ name: 'id', description: 'Banner ID' })
    getBannerById(@Param('id') id: string) {
        return this.bannerService.getBannerById(id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new banner' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                isActive: { type: 'boolean' },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Banner image file',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('image', {
        storage: bannerStorage,
        fileFilter: (req, file, callback) => {
            const fileExt = extname(file.originalname).toLowerCase();
            if (!allowedExtensions.includes(fileExt) || !allowedMimes.includes(file.mimetype)) {
                return callback(new BadRequestException('Only JPG, PNG, and WEBP image files are allowed!'), false);
            }
            callback(null, true);
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }))
    createBanner(
        @Body() dto: CreateBannerDto,
        @UploadedFile() file: Express.Multer.File
    ) {
        if (!file) {
            throw new BadRequestException('Banner image is required');
        }
        // Build the URL path for the database
        const imageUrl = `/uploads/banners/${file.filename}`;

        // Pass to standard service without custom DTO logic needed
        return this.bannerService.createBanner({ ...dto, imageUrl });
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update an existing banner' })
    @ApiParam({ name: 'id', description: 'Banner ID' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                isActive: { type: 'boolean' },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'New banner image file (optional)',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('image', {
        storage: bannerStorage,
        fileFilter: (req, file, callback) => {
            const fileExt = extname(file.originalname).toLowerCase();
            if (!allowedExtensions.includes(fileExt) || !allowedMimes.includes(file.mimetype)) {
                return callback(new BadRequestException('Only JPG, PNG, and WEBP image files are allowed!'), false);
            }
            callback(null, true);
        },
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    updateBanner(
        @Param('id') id: string,
        @Body() dto: UpdateBannerDto,
        @UploadedFile() file?: Express.Multer.File
    ) {
        const updateData = { ...dto };

        // If a new image is provided, update the specific URL
        if (file) {
            updateData.imageUrl = `/uploads/banners/${file.filename}`;
        }

        return this.bannerService.updateBanner(id, updateData);
    }

    @Patch(':id/toggle-status')
    @ApiOperation({ summary: 'Toggle active status of a banner' })
    @ApiParam({ name: 'id', description: 'Banner ID' })
    toggleStatus(@Param('id') id: string) {
        return this.bannerService.toggleBannerStatus(id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a banner' })
    @ApiParam({ name: 'id', description: 'Banner ID' })
    deleteBanner(@Param('id') id: string) {
        return this.bannerService.deleteBanner(id);
    }
}
