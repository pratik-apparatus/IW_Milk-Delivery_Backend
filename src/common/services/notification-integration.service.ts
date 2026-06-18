import { Injectable, Logger } from '@nestjs/common';
import { MailClientService } from '../../microservices/mail-client.service';

@Injectable()
export class NotificationIntegrationService {
  private readonly logger = new Logger(NotificationIntegrationService.name);

  constructor(private readonly mailClient: MailClientService) {}

  async sendNotification(payload: {
    recipientId: string;
    recipientType: 'CUSTOMER' | 'DELIVERY_PARTNER';
    templateType: string;
    variables: Record<string, string | number>;
    channel?: 'EMAIL' | 'FCM' | 'BOTH';
    fcmToken?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    return this.mailClient.sendNotification(payload);
  }

  async sendBulkNotifications(payload: {
    recipientIds: string[];
    templateType: string;
    variables: Record<string, string | number>;
    channel?: 'EMAIL' | 'FCM' | 'BOTH';
  }): Promise<{ success: boolean; sentTo: number }> {
    return this.mailClient.sendBulkNotifications(payload);
  }

  async sendCustomNotification(payload: {
    title: string;
    body: string;
    recipientType: string;
    recipientIds?: string[];
    channel?: 'EMAIL' | 'FCM' | 'BOTH';
  }): Promise<{ success: boolean; sentTo: number }> {
    return this.mailClient.sendCustomNotification(payload);
  }
}
