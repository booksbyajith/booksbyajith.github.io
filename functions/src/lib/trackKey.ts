import { timingSafeEqual } from 'node:crypto';
import { hmac } from './hash.js';

/**
 * Private key for an order's tracking link (128 bits, from the site's secret salt). Links we
 * send carry it, so the customer sees the order without typing the phone digits; nobody can
 * work it out from the order number. Derived, not stored, so it also works for older orders.
 */
export function trackKeyFor(orderId: string): string {
  return hmac(`track:${orderId}`).slice(0, 32);
}

export function isTrackKey(orderId: string, key: string): boolean {
  const want = Buffer.from(trackKeyFor(orderId));
  const got = Buffer.from(key);
  return want.length === got.length && timingSafeEqual(want, got);
}
