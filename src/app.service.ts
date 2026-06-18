import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    console.log("Core backend health check invoked");
    return 'Core backend is alive 🌱';
  }
}
