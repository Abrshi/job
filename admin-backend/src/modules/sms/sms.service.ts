import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export interface SendSmsOptions {
  to: string; // E.164 formatted number e.g. +251911223344
  message: string;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
}

export class SmsService {
  private apiUrl: string;
  private token: string | undefined;

  constructor() {
    this.apiUrl = (env.SMS_API_URL || 'https://sms-connect.vercel.app').replace(/\/+$/, '');
    this.token = env.SMS_DEVICE_TOKEN?.trim();
  }

  /**
   * Check if SMSBridge credentials are configured.
   */
  public isConfigured(): boolean {
    return Boolean(this.token && this.token.length > 0);
  }

  /**
   * Test SMS gateway connectivity and authorization without sending a message.
   */
  public async testConnection(): Promise<{ success: boolean; status?: number; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'SMS service not configured (SMS_DEVICE_TOKEN is missing).' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      // Ping gateway root or health endpoint
      const res = await fetch(`${this.apiUrl}/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return { success: res.status < 500, status: res.status };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Send an SMS message via SMSBridge API.
   */
  public async sendSms(options: SendSmsOptions): Promise<SmsSendResult> {
    const { to, message } = options;

    if (!this.isConfigured()) {
      logger.warn(`[SmsService] Skipping SMS to ${to.slice(0, 7)}***: SMS_DEVICE_TOKEN is not configured.`);
      return {
        success: false,
        error: 'SMS service is not configured on the server.',
      };
    }

    const endpoint = `${this.apiUrl}/api/v1/messages`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          to,
          message,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseBody = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          responseBody?.message ||
          responseBody?.error ||
          `Gateway HTTP error ${res.status} (${res.statusText})`;
        logger.error(`[SmsService] SMS delivery failed to ${to.slice(0, 7)}***: ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          status: res.status.toString(),
        };
      }

      // Check success flag in response payload
      const isSuccess = responseBody?.success !== false;
      const messageId = responseBody?.messageId || responseBody?.id || responseBody?.data?.id;
      const status = responseBody?.status || (isSuccess ? 'sent' : 'failed');

      logger.info(`[SmsService] SMS dispatched to ${to.slice(0, 7)}*** with status: ${status}`);

      return {
        success: isSuccess,
        messageId,
        status,
      };
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? 'SMS gateway request timed out after 12s' : err.message;
      logger.error(`[SmsService] Exception while dispatching SMS to ${to.slice(0, 7)}***: ${msg}`);
      return {
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Send phone verification OTP code.
   */
  public async sendVerificationOtp(to: string, otp: string, expiresInMinutes: number = 10): Promise<SmsSendResult> {
    const text = `Your JobPlatform verification code is: ${otp}. It will expire in ${expiresInMinutes} minutes. Do not share this code.`;
    return this.sendSms({ to, message: text });
  }
}

export const smsService = new SmsService();
