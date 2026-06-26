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
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProductService } from './product.sevices';
import { CreateProductDto } from '../../dto/product.dto';
import { ProductQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseMultipartPipe } from '../../common/pipes/parse-multipart.pipe';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AdminProtected } from '../../auth/admin-protected.decorator';

// Configure multer for product image uploads
const productStorage = diskStorage({
  destination: './uploads/products',
  filename: (req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

// Allowed file extensions
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

@ApiTags('Admin | Products')
@AdminProtected()
@Controller('admin/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: 'Create product' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' },
        quantity: { type: 'number' },
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description:
            'Product images. First image is the hero image (appears first)',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: productStorage,
      fileFilter: (req, file, callback) => {
        // Validate file extension
        const fileExt = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
          return callback(
            new Error('Only JPG, PNG, and WEBP image files are allowed!'),
            false,
          );
        }
        // Validate MIME type
        if (!allowedMimes.includes(file.mimetype)) {
          return callback(
            new Error('Only JPG, PNG, and WEBP image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit per file
    }),
  )
  create(
    @Body(ParseMultipartPipe) dto: CreateProductDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // First uploaded image is the hero image (appears first in array)
    // Order is preserved: first file = hero image, subsequent files follow in order
    const imagePaths =
      files && files.length > 0
        ? files.map((file) => `/uploads/products/${file.filename}`)
        : [];
    return this.productService.create({ ...dto, images: imagePaths });
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  findAll(@Query() query: ProductQueryDto) {
    return this.productService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by id' })
  findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update product' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' },
        quantity: { type: 'number' },
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description:
            'Product images. First image is the hero image (appears first)',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: productStorage,
      fileFilter: (req, file, callback) => {
        // Validate file extension
        const fileExt = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
          return callback(
            new Error('Only JPG, PNG, and WEBP image files are allowed!'),
            false,
          );
        }
        // Validate MIME type
        if (!allowedMimes.includes(file.mimetype)) {
          return callback(
            new Error('Only JPG, PNG, and WEBP image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit per file
    }),
  )
  async update(
    @Param('id') id: string,
    @Body(ParseMultipartPipe) dto: CreateProductDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // If new images are uploaded, use them; otherwise preserve existing images
    // First uploaded image is the hero image (appears first in array)
    // Order is preserved: first file = hero image, subsequent files follow in order
    if (files && files.length > 0) {
      const imagePaths = files.map(
        (file) => `/uploads/products/${file.filename}`,
      );
      return this.productService.update(id, { ...dto, images: imagePaths });
    }
    // If no new images, update without changing images field
    const { images, ...restDto } = dto;
    return this.productService.update(id, restDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'delete product' })
  delete(@Param('id') id: string) {
    return this.productService.delete(id);
  }
}
