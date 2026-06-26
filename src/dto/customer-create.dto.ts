import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class FindOrCreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number format' })
  phone: string;
}
