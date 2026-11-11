import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TelegramChannelsService } from '../../src/modules/telegram/telegram-channels.service';

describe('TelegramChannelsService Unit Tests', () => {
  const service = new TelegramChannelsService();

  describe('normalizeIdentifier', () => {
    it('normalizes https://t.me/ username URLs', () => {
      const res = service.normalizeIdentifier('https://t.me/ethiojobs_official');
      assert.equal(res.username, 'ethiojobs_official');
    });

    it('normalizes @username handles', () => {
      const res = service.normalizeIdentifier('@HaHuJobs');
      assert.equal(res.username, 'hahujobs');
    });

    it('handles numeric Telegram channel IDs', () => {
      const res = service.normalizeIdentifier('-1001140939513');
      assert.equal(res.channelId, '-1001140939513');
    });

    it('handles plain string usernames', () => {
      const res = service.normalizeIdentifier('afriwork');
      assert.equal(res.username, 'afriwork');
    });
  });

  describe('Validation Guards', () => {
    const dummyAdmin = {
      id: 'admin-123',
      email: 'admin@jobsphere.et',
    };

    it('rejects registration without explicit consent confirmation', async () => {
      await assert.rejects(
        async () => {
          await service.registerChannel(
            {
              identifier: '@testchannel',
              authorizationRecord: 'Agreement reference #2026-TG-01',
              explicitConsentConfirmation: false,
            },
            dummyAdmin
          );
        },
        {
          message: /Explicit confirmation is required/,
        }
      );
    });

    it('rejects registration with short or empty authorization record', async () => {
      await assert.rejects(
        async () => {
          await service.registerChannel(
            {
              identifier: '@testchannel',
              authorizationRecord: 'too short',
              explicitConsentConfirmation: true,
            },
            dummyAdmin
          );
        },
        {
          message: /Documented authorization reference.*is required/,
        }
      );
    });

    it('rejects worker toggle without explicit confirmation', async () => {
      await assert.rejects(
        async () => {
          await service.toggleWorkerState(false, false, dummyAdmin);
        },
        {
          message: /Explicit confirmation is required/,
        }
      );
    });
  });
});
