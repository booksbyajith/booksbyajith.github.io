import { trackPageView, loadPixel } from './analytics';
import { initConfigLinks } from './configLinks';
import { env } from './env';
import { legacyRedirect } from './legacyBase';
import { asset } from './paths';

const KEY = 'aj.pixelConsent';

function pixel() {
  if (!env.metaPixelId) return;
  let choice: string | null = null;
  try {
    choice = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (choice === 'accept') return loadPixel(env.metaPixelId);
  if (choice === 'decline') return;
  const banner = document.querySelector<HTMLElement>('[data-pixel-consent]');
  if (!banner) return;
  banner.hidden = false;
  banner.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('[data-pixel]')?.dataset.pixel;
    if (!v) return;
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
    banner.hidden = true;
    if (v === 'accept') loadPixel(env.metaPixelId);
  });
}

/**
 * Switching language keeps the rest of the address: "#order/key" on the tracking page,
 * "#order" on the success page, "?book=" on the order form.
 */
function keepAddressOnLanguageSwitch(): void {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-lang-toggle]');
    if (!a || (!location.hash && !location.search)) return;
    const url = new URL(a.href, location.href);
    if (!url.search && location.search) url.search = location.search;
    if (!url.hash && location.hash) url.hash = location.hash;
    a.href = url.toString();
  });
}

export function initClient(): void {
  // Start the intro animations once everything on the first screen has loaded.
  const ready = () => requestAnimationFrame(() => document.documentElement.classList.add('is-ready'));
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });

  initConfigLinks();
  keepAddressOnLanguageSwitch();
  trackPageView();
  pixel();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(asset('/sw.js'), { scope: asset('/') }).catch(() => undefined);
      // Remove the offline copy left by the site's old /home/ address, so it can't keep
      // serving outdated pages there.
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          regs
            .filter((r) => legacyRedirect(new URL(r.scope).pathname, env.base) !== null)
            .forEach((r) => void r.unregister()),
        )
        .catch(() => undefined);
    });
  }
}
