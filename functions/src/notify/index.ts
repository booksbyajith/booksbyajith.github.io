import type { OrderDoc } from '../shared/types.js';
import { eventName, planSends, runSends, type NotifyEvent } from './core.js';
import { channelsFor, firestoreLedger, runtimeSettings } from './runtime.js';
import { trackKeyFor } from '../lib/trackKey.js';

export async function notify(stored: OrderDoc, event: NotifyEvent) {
  const settings = await runtimeSettings();
  // Emails link to the order's tracking page with its private key.
  const order = {
    ...stored,
    trackKey: trackKeyFor(stored.orderId),
    contactWhatsapp: settings.pub.contact.whatsappNumber || undefined,
  };
  const sends = planSends(order, event, settings);
  return runSends(
    sends,
    { orderId: order.orderId, eventId: event.eventId, event: eventName(event) },
    channelsFor(settings),
    firestoreLedger(),
  );
}

export type { NotifyEvent };
