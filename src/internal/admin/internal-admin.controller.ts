import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { InternalAdminService } from './internal-admin.service';
import { CreateAdminDto } from '../../dto/create-admin.dto';
import { InternalServiceGuard } from '../../auth/internal-service.guard';

@Controller('internal/admin')
@UseGuards(InternalServiceGuard)
export class InternalAdminController {
    constructor(private readonly internalAdminService: InternalAdminService) { }

    @Post('create')

    async createAdmin(@Body() dto: CreateAdminDto) {
        return this.internalAdminService.createAdmin(dto);
    }
}
