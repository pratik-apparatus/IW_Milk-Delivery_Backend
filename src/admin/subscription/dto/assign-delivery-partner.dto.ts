import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignDeliveryPartnerDto {
  @ApiProperty({
    description:
      'The UUID of the delivery partner to assign to the subscription',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  deliveryPartnerId: string;
}
