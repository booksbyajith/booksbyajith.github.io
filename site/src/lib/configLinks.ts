import { buildWaUrl } from '@shared/templates';
import { fetchPublicConfig } from './publicData';

/** Fill links whose targets come from config/public (Facebook page, WhatsApp, phone). */
export function initConfigLinks(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-config]');
  const texts = document.querySelectorAll<HTMLElement>('[data-config-text]');
  if (!els.length && !texts.length && !document.querySelector('[data-pickup]')) return;
  const run = async () => {
    const cfg = await fetchPublicConfig();
    if (!cfg) return;
    // Text filled from the admin settings (bank details, WhatsApp number), so posts that mention
    // them stay correct and the values never live in the site's source.
    const wa = cfg.contact.whatsappNumber;
    const values: Record<string, string> = {
      'bank-name': cfg.bank.bankName,
      'bank-branch': cfg.bank.branch,
      'bank-account-name': cfg.bank.accountName,
      'bank-account-number': cfg.bank.accountNumber,
      'whatsapp-number': wa ? `+${wa}` : '',
    };
    // In-person purchase: shown only once a place and a price are set.
    const c = cfg.contact;
    if (c.pickupName && c.pickupPriceLKR) {
      values['pickup-name'] = c.pickupName;
      values['pickup-address'] = c.pickupAddress ?? '';
      values['pickup-price'] = c.pickupPriceLKR.toLocaleString('en-US');
      for (const el of document.querySelectorAll<HTMLElement>('[data-pickup]')) el.hidden = false;
      for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-pickup-map]')) {
        if (c.pickupMapUrl) a.href = c.pickupMapUrl;
        else a.removeAttribute('href');
      }
    }
    for (const el of texts) {
      const v = values[el.dataset.configText ?? ''];
      if (v) el.textContent = v;
    }
    for (const el of els) {
      const kind = el.dataset.config;
      let url = '';
      if (kind === 'facebook') url = cfg.contact.facebookPageUrl;
      else if (kind === 'tiktok') url = cfg.contact.tiktokUrl ?? '';
      else if (kind === 'youtube') url = cfg.contact.youtubeUrl ?? '';
      else if (kind === 'email' && cfg.contact.email) {
        url = `mailto:${cfg.contact.email}`;
        const label = el.querySelector('[data-email-label]');
        if (label) label.textContent = cfg.contact.email;
      }
      else if (kind === 'whatsapp' && cfg.contact.whatsappNumber) {
        url = buildWaUrl(cfg.contact.whatsappNumber, el.dataset.waText ?? '');
        const label = el.querySelector('[data-wa-label]');
        if (label) label.textContent = '+' + cfg.contact.whatsappNumber;
      }
      else if (kind === 'phone' && cfg.contact.orderPhone) {
        url = `tel:+${cfg.contact.orderPhone}`;
        const label = el.querySelector('[data-phone-label]');
        if (label) label.textContent = '+' + cfg.contact.orderPhone;
      }
      if (url && el instanceof HTMLAnchorElement) {
        el.href = url;
        el.hidden = false;
        el.closest<HTMLElement>('[data-config-wrap]')?.removeAttribute('hidden');
      }
    }
  };
  if ('requestIdleCallback' in window) requestIdleCallback(() => void run(), { timeout: 2000 });
  else setTimeout(() => void run(), 200);
}
