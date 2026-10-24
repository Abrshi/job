import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createSavedSearch,
  fetchSavedSearches,
  fetchSavedSearchById,
  updateSavedSearch,
  toggleSavedSearchAlert,
  deleteSavedSearch,
  runSavedSearch,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from '../lib/jobs-api.js';

describe('Saved Searches and Job Notifications API Client Exports', () => {
  it('exports all saved searches functions', () => {
    assert.strictEqual(typeof createSavedSearch, 'function');
    assert.strictEqual(typeof fetchSavedSearches, 'function');
    assert.strictEqual(typeof fetchSavedSearchById, 'function');
    assert.strictEqual(typeof updateSavedSearch, 'function');
    assert.strictEqual(typeof toggleSavedSearchAlert, 'function');
    assert.strictEqual(typeof deleteSavedSearch, 'function');
    assert.strictEqual(typeof runSavedSearch, 'function');
  });

  it('exports all job notification functions', () => {
    assert.strictEqual(typeof fetchNotifications, 'function');
    assert.strictEqual(typeof fetchUnreadNotificationCount, 'function');
    assert.strictEqual(typeof markNotificationRead, 'function');
    assert.strictEqual(typeof markAllNotificationsRead, 'function');
    assert.strictEqual(typeof deleteNotification, 'function');
    assert.strictEqual(typeof clearReadNotifications, 'function');
  });
});

