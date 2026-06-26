import { NotFoundException } from '@nestjs/common';

export class NoRecordsFoundException extends NotFoundException {
  constructor() {
    super('No records found for the given search criteria');
  }
}
