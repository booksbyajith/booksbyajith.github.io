/**
 * Latest-posts carousel: slides one card at a time (no fade) and loops seamlessly — the first
 * cards are repeated after the last, and once those copies are in view the track jumps back to
 * the start without animation. Pauses on hover/focus, when off screen, when the visitor presses
 * pause, and never moves on its own with reduced motion.
 */
export function initPostCarousel(root: HTMLElement): void {
  const viewport = root.querySelector<HTMLElement>('[data-post-viewport]');
  const track = root.querySelector<HTMLElement>('[data-post-track]');
  if (!viewport || !track) return;
  const real = track.querySelectorAll('[data-card]:not([data-clone])').length;
  const interval = Number(root.dataset.interval) || 5000;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;
  let timer = 0;
  let paused = reduce;
  let hovered = false;
  let visible = true;

  const step = () => {
    const cards = track.querySelectorAll<HTMLElement>('[data-card]');
    if (cards.length < 2) return 0;
    return cards[1].offsetLeft - cards[0].offsetLeft;
  };
  const place = (animate: boolean) => {
    track.style.transition = animate && !reduce ? '' : 'none';
    track.style.transform = `translateX(${-i * step()}px)`;
    if (!animate) void track.offsetWidth; // apply the jump before the next animated move
  };
  const go = (to: number) => {
    if (to < 0) {
      // Going back from the first card: jump to its copy at the end, then slide back one.
      i = real;
      place(false);
      to = real - 1;
    }
    i = to;
    place(true);
  };
  track.addEventListener('transitionend', () => {
    if (i >= real) {
      i -= real;
      place(false);
      track.style.transition = '';
    }
  });

  const schedule = () => {
    window.clearInterval(timer);
    if (paused || hovered || !visible) return;
    timer = window.setInterval(() => go(i + 1), interval);
  };
  const toggle = root.querySelector<HTMLButtonElement>('[data-toggle]');
  const setPaused = (p: boolean) => {
    paused = p;
    root.dataset.playing = String(!p);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(p));
      const label = p ? root.dataset.labelPlay : root.dataset.labelPause;
      if (label) {
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
      }
    }
    schedule();
  };
  toggle?.addEventListener('click', () => setPaused(!paused));
  root.querySelector('[data-prev]')?.addEventListener('click', () => {
    go(i - 1);
    schedule();
  });
  root.querySelector('[data-next]')?.addEventListener('click', () => {
    go(i + 1);
    schedule();
  });

  for (const [ev, h] of [
    ['pointerenter', true],
    ['pointerleave', false],
    ['focusin', true],
    ['focusout', false],
  ] as const) {
    viewport.addEventListener(ev, () => {
      hovered = h;
      schedule();
    });
  }

  // Swipe on touch screens.
  let startX: number | null = null;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') startX = e.clientX;
  });
  viewport.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) {
      go(dx < 0 ? i + 1 : i - 1);
      schedule();
    }
  });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    schedule();
  }).observe(root);
  window.addEventListener('resize', () => place(false));
  setPaused(paused);
}
