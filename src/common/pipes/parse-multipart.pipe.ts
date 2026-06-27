import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ParseMultipartPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' && value) {
      // Transform numeric fields from strings to numbers
      if (value.price !== undefined) {
        value.price =
          typeof value.price === 'string' && value.price !== ''
            ? parseFloat(value.price)
            : value.price;
      }
      if (value.quantity !== undefined) {
        value.quantity =
          typeof value.quantity === 'string' && value.quantity !== ''
            ? parseInt(value.quantity, 10)
            : value.quantity;
      }
      if (value.latitude !== undefined) {
        value.latitude =
          typeof value.latitude === 'string' && value.latitude !== ''
            ? parseFloat(value.latitude)
            : value.latitude;
      }
      if (value.longitude !== undefined) {
        value.longitude =
          typeof value.longitude === 'string' && value.longitude !== ''
            ? parseFloat(value.longitude)
            : value.longitude;
      }
    }
    return value;
  }
}
