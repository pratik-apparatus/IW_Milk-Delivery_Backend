import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import { UpdateTenantAppsDto } from './dto/update-tenant-apps.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { TenantsService } from './tenants.service';
import { AdminAuditLogService } from '../../admin/audit-log/admin-audit-log.service';
import { toAdminAuditLogListResponse } from '../../admin/audit-log/admin-audit-log.mapper';

mkdirSync('./uploads/tenant-documents', { recursive: true });

const tenantDocumentStorage = diskStorage({
  destination: './uploads/tenant-documents',
  filename: (_req, file, callback) => {
    callback(null, `${uuidv4()}${extname(file.originalname)}`);
  },
});

const allowedDocumentExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const allowedDocumentMimes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

function tenantDocumentFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  const fileExt = extname(file.originalname).toLowerCase();
  if (
    !allowedDocumentExtensions.includes(fileExt) ||
    !allowedDocumentMimes.includes(file.mimetype)
  ) {
    return callback(
      new BadRequestException(
        'Only JPG, PNG, WEBP, and PDF files are allowed for KYC documents',
      ),
      false,
    );
  }
  callback(null, true);
}

@ApiTags('Super Admin | Tenants')
@ApiBearerAuth()
@Controller('super-admin/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Create and provision a new tenant (optionally pass databaseId from the database pool)',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant created, provisioned, and credentials email sent',
  })
  create(@Body() payload: CreateTenantDto) {
    return this.tenantsService.create(payload);
  }

  @Get()
  @ApiOperation({ summary: 'List tenants with pagination/filter/search' })
  @ApiResponse({ status: 200, description: 'Tenant list fetched successfully' })
  findAll(@Query() query: TenantQueryDto) {
    return this.tenantsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details by ID' })
  @ApiResponse({ status: 200, description: 'Tenant found' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Get tenant management overview' })
  @ApiResponse({ status: 200, description: 'Tenant overview fetched' })
  getOverview(@Param('id') id: string) {
    return this.tenantsService.getOverview(id);
  }

  @Get(':id/db/health')
  @ApiOperation({ summary: 'Get tenant database health metrics' })
  @ApiResponse({ status: 200, description: 'Tenant database health snapshot' })
  getDbHealth(@Param('id') id: string) {
    return this.tenantsService.getTenantDbHealth(id);
  }

  @Get(':id/audit-logs')
  @ApiOperation({ summary: 'Get tenant admin audit logs by tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant audit logs fetched' })
  async getAuditLogs(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsedLimit = Math.min(Number(limit) || 100, 500);
    const logs = await this.auditLogService.findByTenant(id, parsedLimit);
    return toAdminAuditLogListResponse(logs);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant profile and DB/app config' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  update(@Param('id') id: string, @Body() payload: UpdateTenantDto) {
    return this.tenantsService.update(id, payload);
  }

  @Post(':id/kyc-documents')
  @ApiOperation({
    summary:
      'Upload tenant KYC documents (Aadhaar front/back, PAN, FSSAI license)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        aadharFront: { type: 'string', format: 'binary' },
        aadharBack: { type: 'string', format: 'binary' },
        panCard: { type: 'string', format: 'binary' },
        fssaiLicense: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'KYC documents uploaded' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'aadharFront', maxCount: 1 },
        { name: 'aadharBack', maxCount: 1 },
        { name: 'panCard', maxCount: 1 },
        { name: 'fssaiLicense', maxCount: 1 },
      ],
      {
        storage: tenantDocumentStorage,
        fileFilter: tenantDocumentFileFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
      },
    ),
  )
  uploadKycDocuments(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      aadharFront?: Express.Multer.File[];
      aadharBack?: Express.Multer.File[];
      panCard?: Express.Multer.File[];
      fssaiLicense?: Express.Multer.File[];
    },
  ) {
    const toUrl = (file?: Express.Multer.File) =>
      file ? `/uploads/tenant-documents/${file.filename}` : undefined;

    const documents = {
      aadharFrontUrl: toUrl(files?.aadharFront?.[0]),
      aadharBackUrl: toUrl(files?.aadharBack?.[0]),
      panCardUrl: toUrl(files?.panCard?.[0]),
      fssaiLicenseUrl: toUrl(files?.fssaiLicense?.[0]),
    };

    if (
      !documents.aadharFrontUrl &&
      !documents.aadharBackUrl &&
      !documents.panCardUrl &&
      !documents.fssaiLicenseUrl
    ) {
      throw new BadRequestException(
        'At least one KYC document file is required',
      );
    }

    return this.tenantsService.updateKycDocuments(id, documents);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update tenant status (activate/suspend/inactive)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant status updated successfully',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() payload: UpdateTenantStatusDto,
  ) {
    return this.tenantsService.updateStatus(id, payload);
  }

  @Patch(':id/apps')
  @ApiOperation({ summary: 'Update enabled tenant apps and app settings' })
  @ApiResponse({ status: 200, description: 'Tenant apps updated successfully' })
  updateApps(@Param('id') id: string, @Body() payload: UpdateTenantAppsDto) {
    return this.tenantsService.updateApps(id, payload);
  }

  @Post(':id/provision')
  @ApiOperation({
    summary:
      'Provision tenant database and activate tenant (blocked when DB is already healthy unless forceReset is true)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant provisioning started/completed',
  })
  provision(@Param('id') id: string, @Body() payload?: ProvisionTenantDto) {
    return this.tenantsService.provisionTenant(id, undefined, {
      forceReset: payload?.forceReset === true,
    });
  }

  @Post(':id/decommission')
  @ApiOperation({ summary: 'Decommission tenant and deactivate tenant admins' })
  @ApiResponse({
    status: 200,
    description: 'Tenant decommissioned successfully',
  })
  decommission(@Param('id') id: string) {
    return this.tenantsService.decommissionTenant(id);
  }

  @Post(':id/restore')
  @ApiOperation({
    summary: 'Restore a decommissioned tenant and reactivate admins',
  })
  @ApiResponse({ status: 200, description: 'Tenant restored successfully' })
  restore(@Param('id') id: string) {
    return this.tenantsService.restoreTenant(id);
  }

  @Get(':id/provisioning-jobs/:jobId')
  @ApiOperation({ summary: 'Get provisioning job status by job ID' })
  @ApiResponse({ status: 200, description: 'Provisioning job status fetched' })
  getProvisioningJob(@Param('id') id: string, @Param('jobId') jobId: string) {
    return this.tenantsService.getProvisioningJob(id, jobId);
  }

  @Delete(':id/permanent')
  @ApiOperation({
    summary:
      'Permanently delete tenant, detach billing, remove users, and drop tenant database',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant permanently deleted',
  })
  permanentlyDelete(@Param('id') id: string) {
    return this.tenantsService.permanentlyDeleteTenant(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (decommission) a tenant' })
  @ApiResponse({
    status: 200,
    description: 'Tenant decommissioned successfully',
  })
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}
