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
            host: configService.get<string>('MAIL_MS_HOST') || '127.0.0.1',
            port: Number(configService.get<string>('MAIL_MS_PORT') || 4003),
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
