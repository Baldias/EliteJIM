import { describe, expect, it } from 'vitest';
import { validSubscription, MESSAGES } from '../api/_lib/reminder.js';

const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };

describe('workout push reminder API', () => {
  it('accepts subscriptions from known push services only', () => {
    expect(validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys })).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys });
    expect(validSubscription({ endpoint: 'https://web.push.apple.com/QGx', keys })).not.toBeNull();
    expect(validSubscription({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x', keys })).not.toBeNull();
    expect(validSubscription({ endpoint: 'https://evil.example.com/push', keys })).toBeNull();
    expect(validSubscription({ endpoint: 'http://fcm.googleapis.com/fcm/send/abc', keys })).toBeNull();
    expect(validSubscription({ endpoint: 'https://fcm.googleapis.com.evil.com/x', keys })).toBeNull();
    expect(validSubscription({ endpoint: 'https://fcm.googleapis.com/x' })).toBeNull();
    expect(validSubscription(null)).toBeNull();
  });
  it('has the reminder text in both languages', () => {
    expect(MESSAGES.it.title).toBe('Stai ancora allenandoti?');
    expect(MESSAGES.en.title).toBe('Still training?');
  });
});
