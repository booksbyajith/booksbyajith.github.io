import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, HASH_SALT, corsOrigins } from '../options.js';
import { getSlipUrlSchema } from '../shared/schemas.js';
import { parse, requireAppCheck, requireStaff } from '../lib/guard.js';
import { trackKeyFor } from '../lib/trackKey.js';

/** Admin and staff: the private key for an order's tracking link (for WhatsApp messages). */
export async function handleGetTrackKey(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  requireStaff(request);
  const { orderId } = parse(getSlipUrlSchema, request.data);
  return { key: trackKeyFor(orderId) };
}

export const getTrackKey = onCall(
  { ...ADMIN_CALLABLE, cors: corsOrigins(), secrets: [HASH_SALT] },
  handleGetTrackKey,
);
