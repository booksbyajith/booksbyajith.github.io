import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { OVERSEAS } from '../shared/districts.js';
import { updateOrderAddressSchema } from '../shared/schemas.js';
import type { AuditEvent, OrderDoc } from '../shared/types.js';
import { Timestamp, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { parse, requireAppCheck, requireStaff } from '../lib/guard.js';

/**
 * Admins and packing staff can correct a delivery address (typos, a town written twice).
 * The district is kept, because it decides the delivery fee. The audit log records which
 * fields changed, not the address itself, so anonymising an order leaves nothing behind.
 */
export async function handleUpdateOrderAddress(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  const actor = requireStaff(request);
  const input = parse(updateOrderAddressSchema, request.data);
  const ref = db().collection('orders').doc(input.orderId);
  const order = (await ref.get()).data() as OrderDoc | undefined;
  if (!order) fail('not-found', 'NOT_FOUND');
  if (order.anonymisedAt) fail('failed-precondition', 'INVALID_TRANSITION');
  const overseas = order.address.districtId === OVERSEAS;
  const postalOk = overseas
    ? /^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(input.postalCode)
    : /^\d{5}$/.test(input.postalCode);
  if (!postalOk) fail('invalid-argument', 'VALIDATION', { fields: ['postalCode'] });
  if (overseas && (input.country ?? '').length < 2)
    fail('invalid-argument', 'VALIDATION', { fields: ['country'] });

  const next: OrderDoc['address'] = {
    ...order.address,
    line1: input.line1,
    line2: input.line2 || null,
    city: input.city,
    postalCode: input.postalCode,
    landmark: input.landmark || null,
    ...(overseas ? { country: input.country || null } : {}),
  };
  const changed = (['line1', 'line2', 'city', 'postalCode', 'country', 'landmark'] as const).filter(
    (k) => (order.address[k] ?? null) !== (next[k] ?? null),
  );
  if (!changed.length) return { ok: true, changed };
  const event: AuditEvent = {
    type: 'address',
    at: Timestamp.now(),
    by: actor,
    from: null,
    to: null,
    note: null,
    meta: { fields: changed },
  };
  await ref.update({ address: next, updatedAt: Timestamp.now() });
  await ref.collection('audit').add(event);
  return { ok: true, changed };
}

export const updateOrderAddress = onCall(
  { ...ADMIN_CALLABLE, cors: corsOrigins() },
  handleUpdateOrderAddress,
);
