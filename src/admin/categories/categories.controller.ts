import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CategoryService } from './categories.servics';
import { CreateCategoryDto } from '../../dto/categories.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { ApiOperation, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AdminProtected } from '../../auth/admin-protected.decorator';

// Configure multer for category image uploads
const categoryStorage = diskStorage({
  destination: './uploads/categories',
  filename: (req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

// Allowed file extensions and MIME types
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

@ApiTags('Admin | Categories')
@AdminProtected()
@Controller('admin/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create new category (Admin API)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: categoryStorage,
      fileFilter: (req, file, callback) => {
        // Validate file extension
        const fileExt = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
          return callback(
            new Error('Images with jpg, webp, png are only allowed'),
            false,
          );
        }
        // Validate MIME type
        if (!allowedMimes.includes(file.mimetype)) {
          return callback(
            new Error('Images with jpg, webp, png are only allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }),
  )
  create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imagePath = file ? `/uploads/categories/${file.filename}` : undefined;
    return this.categoryService.create({ ...dto, image: imagePath });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by id (Admin API)' })
  findById(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories (Admin API)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.categoryService.findAll(query);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update category (Admin API)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: categoryStorage,
      fileFilter: (req, file, callback) => {
        // Validate file extension
        const fileExt = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
          return callback(
            new Error('Images with jpg, webp, png are only allowed'),
            false,
          );
        }
        // Validate MIME type
        if (!allowedMimes.includes(file.mimetype)) {
          return callback(
            new Error('Images with jpg, webp, png are only allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() dto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // If new image is uploaded, use it; otherwise preserve existing image
    if (file) {
      const imagePath = `/uploads/categories/${file.filename}`;
      return this.categoryService.update(id, { ...dto, image: imagePath });
    }
    // If no new image, update without changing image field
    const { image, ...restDto } = dto;
    return this.categoryService.update(id, restDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete category (Admin API)' })
  delete(@Param('id') id: string) {
    return this.categoryService.delete(id);
  }
}
