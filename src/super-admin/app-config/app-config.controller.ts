import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { AppConfigService } from '../../admin/app-config/app-config.service';
import {
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from '../../admin/app-config/dto/app-config.dto';

const logoStorage = diskStorage({
  destination: './uploads/app-config',
  filename: (_req, file, callback) => {
    callback(null, `${uuidv4()}${extname(file.originalname)}`);
  },
});

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
const allowedMimes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];

function parseStyleVariables(raw: unknown) {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'object') {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      throw new BadRequestException('styleVariables must be valid JSON');
    }
  }
  throw new BadRequestException(
    'styleVariables must be a JSON object or string',
  );
}

function normalizeAppConfigBody(body: Record<string, unknown>) {
  return {
    theme: body.theme as string | undefined,
    primaryColor: body.primaryColor as string | undefined,
    secondaryColor: body.secondaryColor as string | undefined,
    fontFamily: body.fontFamily as string | undefined,
    styleVariables: parseStyleVariables(body.styleVariables),
  } as CreateAppConfigDto;
}

const APP_CONFIG_SWAGGER_BODY = {
  schema: {
    type: 'object',
    properties: {
      theme: { type: 'string', example: 'light' },
      primaryColor: { type: 'string', example: '#2563eb' },
      secondaryColor: { type: 'string', example: '#64748b' },
      fontFamily: { type: 'string', example: "'Inter', sans-serif" },
      styleVariables: {
        type: 'string',
        description: 'JSON string of style variables object',
        example: '{"bgColor":"#f8fafc","borderRadius":"8px"}',
      },
      logo: { type: 'string', format: 'binary' },
    },
  },
} as const;

@ApiTags('Super Admin | App Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('super-admin/tenants/:tenantId/app-config')
export class SuperAdminAppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get app config for a tenant (super admin only)' })
  @ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
  @ApiResponse({
    status: 200,
    description: 'App config retrieved successfully',
  })
  getAppConfig(@Param('tenantId') tenantId: string) {
    return this.appConfigService.getByTenantId(tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create app config for a tenant (super admin only)',
  })
  @ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(APP_CONFIG_SWAGGER_BODY)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: logoStorage,
      fileFilter: (_req, file, callback) => {
        const fileExt = extname(file.originalname).toLowerCase();
        if (
          !allowedExtensions.includes(fileExt) ||
          !allowedMimes.includes(file.mimetype)
        ) {
          return callback(
            new BadRequestException(
              'Only JPG, PNG, WEBP, and SVG image files are allowed',
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  createAppConfig(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dto = normalizeAppConfigBody(body);
    const logoUrl = file ? `/uploads/app-config/${file.filename}` : undefined;
    return this.appConfigService.create(tenantId, dto, logoUrl);
  }

  @Put()
  @ApiOperation({
    summary: 'Update app config for a tenant (super admin only)',
  })
  @ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(APP_CONFIG_SWAGGER_BODY)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: logoStorage,
      fileFilter: (_req, file, callback) => {
        const fileExt = extname(file.originalname).toLowerCase();
        if (
          !allowedExtensions.includes(fileExt) ||
          !allowedMimes.includes(file.mimetype)
        ) {
          return callback(
            new BadRequestException(
              'Only JPG, PNG, WEBP, and SVG image files are allowed',
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  updateAppConfig(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dto = normalizeAppConfigBody(body) as UpdateAppConfigDto;
    const logoUrl = file ? `/uploads/app-config/${file.filename}` : undefined;
    return this.appConfigService.update(tenantId, dto, logoUrl);
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete app config for a tenant (super admin only)',
  })
  @ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
  deleteAppConfig(@Param('tenantId') tenantId: string) {
    return this.appConfigService.remove(tenantId);
  }
}
