import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { CreateTenantPlanDto } from './dto/create-tenant-plan.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';
import { TenantPlanService } from './tenant-plan.service';

@ApiTags('Super Admin | Billing')
@ApiBearerAuth()
@Controller('super-admin/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class TenantPlanController {
  constructor(private readonly planService: TenantPlanService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a billing plan template (catalog — reused across tenants)',
  })
  create(@Body() dto: CreateTenantPlanDto) {
    return this.planService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all billing plan templates' })
  findAll() {
    return this.planService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID' })
  findOne(@Param('id') id: string) {
    return this.planService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a SaaS billing plan' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantPlanDto) {
    return this.planService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete a plan when no active/pending subscriptions use it (otherwise deactivates)',
  })
  remove(@Param('id') id: string) {
    return this.planService.remove(id);
  }
}
