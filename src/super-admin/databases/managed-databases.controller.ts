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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { CreateManagedDatabaseDto } from './dto/create-managed-database.dto';
import { ManagedDatabaseQueryDto } from './dto/managed-database-query.dto';
import { UpdateManagedDatabaseDto } from './dto/update-managed-database.dto';
import { ManagedDatabasesService } from './managed-databases.service';

@ApiTags('Super Admin | Database Pool')
@ApiBearerAuth()
@Controller('super-admin/databases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class ManagedDatabasesController {
  constructor(private readonly managedDatabasesService: ManagedDatabasesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a standalone tenant database (no tenant required)',
  })
  @ApiBody({ type: CreateManagedDatabaseDto })
  @ApiResponse({ status: 201, description: 'Database created and registered as AVAILABLE' })
  create(@Body() payload: CreateManagedDatabaseDto) {
    return this.managedDatabasesService.create(payload);
  }

  @Get()
  @ApiOperation({
    summary: 'List managed databases (filter by AVAILABLE to pick one for tenant creation)',
  })
  @ApiResponse({ status: 200, description: 'Managed database list fetched' })
  findAll(@Query() query: ManagedDatabaseQueryDto) {
    return this.managedDatabasesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get managed database by ID' })
  @ApiParam({ name: 'id', description: 'Managed database ID' })
  @ApiResponse({ status: 200, description: 'Managed database found' })
  findOne(@Param('id') id: string) {
    return this.managedDatabasesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update managed database (only when AVAILABLE)' })
  @ApiParam({ name: 'id', description: 'Managed database ID' })
  @ApiBody({ type: UpdateManagedDatabaseDto })
  @ApiResponse({ status: 200, description: 'Managed database updated' })
  update(@Param('id') id: string, @Body() payload: UpdateManagedDatabaseDto) {
    return this.managedDatabasesService.update(id, payload);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete managed database and drop PostgreSQL database' })
  @ApiParam({ name: 'id', description: 'Managed database ID' })
  @ApiResponse({ status: 200, description: 'Managed database deleted' })
  remove(@Param('id') id: string) {
    return this.managedDatabasesService.remove(id);
  }

  @Post(':id/test-connection')
  @ApiOperation({ summary: 'Test managed database connection' })
  @ApiParam({ name: 'id', description: 'Managed database ID' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  testConnection(@Param('id') id: string) {
    return this.managedDatabasesService.testConnection(id);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Get managed database health metrics' })
  @ApiParam({ name: 'id', description: 'Managed database ID' })
  @ApiResponse({ status: 200, description: 'Database health snapshot' })
  getHealth(@Param('id') id: string) {
    return this.managedDatabasesService.getHealth(id);
  }
}
