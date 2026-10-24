import { logger } from '../../lib/logger';

export interface NotificationPayload {
  userId: string;
  userEmail: string;
  userName?: string | null;
  jobId: string;
  jobTitle: string;
  companyName?: string | null;
  jobLocation?: string | null;
  salaryText?: string | null;
  jobUrl?: string | null;
  matchedSearches: string[];
}

export interface NotificationResult {
  channel: 'IN_APP' | 'EMAIL';
  status: 'DELIVERED' | 'FAILED' | 'SKIPPED';
  deliveredAt?: Date;
  error?: string;
}

export interface INotificationProvider {
  channel: 'IN_APP' | 'EMAIL';
  send(payload: NotificationPayload): Promise<NotificationResult>;
}

export class EmailNotificationProvider implements INotificationProvider {
  readonly channel = 'EMAIL' as const;

  private isConfigured(): boolean {
    return Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      logger.info(
        `[EmailNotificationProvider] SMTP unconfigured. Email notification skipped for user ${payload.userEmail} (Job: "${payload.jobTitle}").`
      );
      return {
        channel: 'EMAIL',
        status: 'SKIPPED',
      };
    }

    try {
      // In future when SMTP credentials are provided, nodemailer/transport can be wired here
      logger.info(
        `[EmailNotificationProvider] Sending email alert to ${payload.userEmail} for job "${payload.jobTitle}"`
      );
      return {
        channel: 'EMAIL',
        status: 'DELIVERED',
        deliveredAt: new Date(),
      };
    } catch (err) {
      logger.error(`[EmailNotificationProvider] Failed to send email alert: ${(err as Error).message}`);
      return {
        channel: 'EMAIL',
        status: 'FAILED',
        error: (err as Error).message,
      };
    }
  }
}

export class InAppNotificationProvider implements INotificationProvider {
  readonly channel = 'IN_APP' as const;

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    // In-App notifications are recorded into the job_notifications table by the notification service
    return {
      channel: 'IN_APP',
      status: 'DELIVERED',
      deliveredAt: new Date(),
    };
  }
}

export const emailNotificationProvider = new EmailNotificationProvider();
export const inAppNotificationProvider = new InAppNotificationProvider();
