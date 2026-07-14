import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MAIL_MS_CLIENT } from './patterns';
import { MailClientService } from './mail-client.service';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: MAIL_MS_CLIENT,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            // TCP microservice host/port (not MAIL_SERVICE_URL HTTP)
            host:
              configService.get<string>('MAIL_MS_HOST') ||
              configService.get<string>('MAIL_HOST') ||
              '127.0.0.1',
            port: Number(
              configService.get<string>('MAIL_MS_PORT') ||
                configService.get<string>('MAIL_PORT') ||
                4003,
            ),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [MailClientService],
  exports: [MailClientService],
})
export class MailClientModule {}
