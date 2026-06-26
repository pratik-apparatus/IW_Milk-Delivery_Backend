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
    }
    return value;
  }
}
