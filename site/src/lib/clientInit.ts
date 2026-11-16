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

export function initClient(): void {
  // Start the intro animations once everything on the first screen has loaded.
  const ready = () => requestAnimationFrame(() => document.documentElement.classList.add('is-ready'));
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });

  initConfigLinks();
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
