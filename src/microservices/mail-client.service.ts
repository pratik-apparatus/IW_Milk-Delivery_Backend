import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { MAIL_MS_CLIENT, MailPatterns } from './patterns';
import { RpcEnvelope } from './rpc.types';

@Injectable()
export class MailClientService {
  private readonly logger = new Logger(MailClientService.name);
  private readonly internalToken: string;

  constructor(
    @Inject(MAIL_MS_CLIENT) private readonly mailClient: ClientProxy,
    private readonly configService: ConfigService,
  ) {
    this.internalToken =
      this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || '';
  }

  private async send<T>(pattern: object, data: unknown): Promise<T> {
    const envelope: RpcEnvelope = {
      token: this.internalToken,
      data,
    };

    return firstValueFrom(
      this.mailClient.send<T>(pattern, envelope).pipe(timeout(10000)),
    );
  }

  async sendTenantCredentials(payload: {
    to: string;
    businessName: string;
    adminEmail: string;
    temporaryPassword: string;
    adminPanelUrl?: string;
    subdomain?: string;
  }) {
    return this.send(MailPatterns.SEND_TENANT_CREDENTIALS, payload);
  }

  async sendNotification(payload: {
    recipientId: string;
    recipientType: 'CUSTOMER' | 'DELIVERY_PARTNER';
    templateType: string;
    variables: Record<string, string | number>;
    channel?: 'EMAIL' | 'FCM' | 'BOTH';
    fcmToken?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    try {
      return await this.send(MailPatterns.NOTIFICATION_SEND, payload);
    } catch (error: any) {
      this.logger.warn(`Notification RPC failed: ${error?.message || error}`);
      return { success: false };
    }
  }

  async sendBulkNotifications(payload: {
    recipientIds: string[];
    templateType: string;
    variables: Record<string, string | number>;
    channel?: 'EMAIL' | 'FCM' | 'BOTH';
  }): Promise<{ success: boolean; sentTo: number }> {
    try {
      return await this.send(MailPatterns.NOTIFICATION_SEND_BULK, payload);
    } catch (error: any) {
      this.logger.warn(
        `Bulk notification RPC failed: ${error?.message || error}`,
      );
      return { success: false, sentTo: 0 };
    }
  }

  async sendCustomNotification(payload: {
    title: string;
    body: string;
    recipientType: string;
    recipientIds?: string[];
    channel?: 'EMAIL' | 'FCM' | 'BOTH';
  }): Promise<{ success: boolean; sentTo: number }> {
    try {
      return await this.send(MailPatterns.NOTIFICATION_SEND_CUSTOM, payload);
    } catch (error: any) {
      this.logger.warn(
        `Custom notification RPC failed: ${error?.message || error}`,
      );
      return { success: false, sentTo: 0 };
    }
  }
}
