import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTenantPlanDto {
  @ApiProperty({ example: 'uuid-of-plan' })
  @IsUUID()
  planId: string;
}
