import dns from 'node:dns';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { TelegramApiResponse, TelegramSendMessagePayload } from './telegram.types';

// Ensure fast IPv4 DNS resolution across environments with unrouted IPv6
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

export function normalizeTelegramChannelId(channelId?: string | null): string {
  if (!channelId || !channelId.trim()) return '@etjobcollector';
  let cleaned = channelId.trim();
  // Strip https://t.me/ or http://t.me/ or t.me/ and trailing slashes
  cleaned = cleaned.replace(/^https?:\/\/t\.me\//i, '').replace(/^t\.me\//i, '').replace(/\/$/, '');
  // If it doesn't start with - (numeric ID) and doesn't start with @, prepend @
  if (!cleaned.startsWith('@') && !cleaned.startsWith('-')) {
    cleaned = `@${cleaned}`;
  }
  return cleaned;
}

export class TelegramApiClient {
  private botToken?: string;
  private customFetch?: typeof fetch;

  constructor(
    optionsOrToken?: { customFetch?: typeof fetch; botToken?: string } | string,
    customFetch?: typeof fetch
  ) {
    if (typeof optionsOrToken === 'string') {
      this.botToken = optionsOrToken;
      this.customFetch = customFetch;
    } else if (optionsOrToken) {
      this.botToken = optionsOrToken.botToken;
      this.customFetch = optionsOrToken.customFetch;
    }
  }

  /**
   * Set custom fetch handler (used for test mocking)
   */
  setFetch(fetchFn: typeof fetch | undefined) {
    this.customFetch = fetchFn;
  }

  /**
   * Send a formatted HTML message to the configured Telegram channel
   */
  async sendMessage(
    htmlMessage: string,
    options: {
      channelId?: string;
      disablePreview?: boolean;
    } = {}
  ): Promise<TelegramApiResponse> {
    const token = this.botToken || env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured in the environment.');
    }

    const channelId = normalizeTelegramChannelId(options.channelId || env.TELEGRAM_CHANNEL_ID || '@etjobcollector');

    const payload: TelegramSendMessagePayload = {
      chat_id: channelId,
      text: htmlMessage,
      parse_mode: 'HTML',
      disable_web_page_preview: options.disablePreview ?? false,
    };

    const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const fetchImpl = this.customFetch || globalThis.fetch;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ETJobCollector-Bot/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = (await response.json()) as TelegramApiResponse;

      if (!response.ok || !data.ok) {
        const errorDesc = data?.description || `HTTP ${response.status} ${response.statusText}`;
        const retryAfter = data?.parameters?.retry_after;

        // Mask token if it ever appeared in error description
        const safeErrorDesc = errorDesc.replace(token, '[REDACTED_BOT_TOKEN]');

        logger.warn(
          `[TelegramAPI] Failed to publish message to ${channelId}: ${safeErrorDesc}` +
            (retryAfter ? ` (retry_after: ${retryAfter}s)` : '')
        );

        return {
          ok: false,
          error_code: data.error_code || response.status,
          description: safeErrorDesc,
          parameters: data.parameters,
        };
      }

      return data;
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      const msg = isAbort ? 'Telegram API request timed out after 10s' : err?.message || String(err);
      const safeMsg = token ? msg.replace(token, '[REDACTED_BOT_TOKEN]') : msg;

      logger.error(`[TelegramAPI] Network error while sending message to ${channelId}:`, safeMsg);

      return {
        ok: false,
        error_code: isAbort ? 408 : 500,
        description: safeMsg,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Test connection to the bot and verify its access to the channel
   */
  async testConnection(channelId?: string): Promise<{ ok: boolean; message: string; botInfo?: unknown }> {
    const token = this.botToken || env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return { ok: false, message: 'TELEGRAM_BOT_TOKEN is not configured.' };
    }

    const fetchImpl = this.customFetch || globalThis.fetch;
    const targetChannel = normalizeTelegramChannelId(channelId || env.TELEGRAM_CHANNEL_ID || '@etjobcollector');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    try {
      // 1. Check bot identity (getMe)
      const meRes = await fetchImpl(`https://api.telegram.org/bot${token}/getMe`, { signal: controller.signal });
      const meData = await meRes.json();
      if (!meData.ok) {
        return { ok: false, message: `Invalid bot token: ${meData.description || meRes.statusText}` };
      }

      // 2. Check channel access (getChat)
      const chatRes = await fetchImpl(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(targetChannel)}`,
        { signal: controller.signal }
      );
      const chatData = await chatRes.json();
      if (!chatData.ok) {
        return {
          ok: false,
          message: `Bot cannot access channel ${targetChannel}: ${chatData.description || chatRes.statusText}. Ensure bot is added as administrator.`,
          botInfo: meData.result,
        };
      }

      return {
        ok: true,
        message: `Connection successful. Bot @${meData.result?.username} is authorized for channel ${targetChannel}.`,
        botInfo: {
          bot: meData.result,
          channel: chatData.result,
        },
      };
    } catch (err: any) {
      return { ok: false, message: `Network error verifying connection: ${err.message || err}` };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const telegramApiClient = new TelegramApiClient();
