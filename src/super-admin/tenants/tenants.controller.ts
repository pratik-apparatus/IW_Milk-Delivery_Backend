import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import { UpdateTenantAppsDto } from './dto/update-tenant-apps.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';
import { TenantDbService } from './tenant-db.service';

@ApiTags('Super Admin | Tenants')
@ApiBearerAuth()
@Controller('super-admin/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantDbService: TenantDbService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create and provision a new tenant' })
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

  @Post(':id/db/test-connection')
  @ApiOperation({ summary: 'Test tenant database connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  testDbConnection(@Param('id') id: string) {
    return this.tenantDbService.testConnection(id);
  }

  @Get(':id/db/health')
  @ApiOperation({ summary: 'Get tenant database health and monitoring metrics' })
  @ApiResponse({ status: 200, description: 'Database health snapshot' })
  getDbHealth(@Param('id') id: string) {
    return this.tenantDbService.getDbHealth(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant profile and DB/app config' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  update(@Param('id') id: string, @Body() payload: UpdateTenantDto) {
    return this.tenantsService.update(id, payload);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update tenant status (activate/suspend/inactive)' })
  @ApiResponse({ status: 200, description: 'Tenant status updated successfully' })
  updateStatus(@Param('id') id: string, @Body() payload: UpdateTenantStatusDto) {
    return this.tenantsService.updateStatus(id, payload);
  }

  @Patch(':id/apps')
  @ApiOperation({ summary: 'Update enabled tenant apps and app settings' })
  @ApiResponse({ status: 200, description: 'Tenant apps updated successfully' })
  updateApps(@Param('id') id: string, @Body() payload: UpdateTenantAppsDto) {
    return this.tenantsService.updateApps(id, payload);
  }

  @Post(':id/provision')
  @ApiOperation({ summary: 'Provision tenant database and activate tenant' })
  @ApiResponse({ status: 200, description: 'Tenant provisioning started/completed' })
  provision(@Param('id') id: string) {
    return this.tenantsService.provisionTenant(id);
  }

  @Post(':id/decommission')
  @ApiOperation({ summary: 'Decommission tenant and deactivate tenant admins' })
  @ApiResponse({ status: 200, description: 'Tenant decommissioned successfully' })
  decommission(@Param('id') id: string) {
    return this.tenantsService.decommissionTenant(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a decommissioned tenant and reactivate admins' })
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

  @Delete(':id')
  @ApiOperation({ summary: 'Decommission tenant (soft delete)' })
  @ApiResponse({ status: 200, description: 'Tenant decommissioned successfully' })
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}

