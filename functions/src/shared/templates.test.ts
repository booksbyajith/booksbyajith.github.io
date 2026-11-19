import { mergePrivateConfig } from './defaults.js';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATES,
  LEGACY_TEMPLATES,
  bookTitles,
  buildCourierTrackingUrl,
  buildMapsUrl,
  buildOrderUrl,
  buildTrackUrl,
  buildWaUrl,
  renderTemplate,
} from './templates.js';

describe('renderTemplate', () => {
  it('substitutes variables', () => {
    expect(renderTemplate('Hi {name}, order {orderId}', { name: 'Nimal', orderId: 'AJ-2611-7K3Q' })).toBe(
      'Hi Nimal, order AJ-2611-7K3Q',
    );
  });
  it('leaves unknown variables', () => expect(renderTemplate('{foo} {name}', { name: 'A' })).toBe('{foo} A'));
  it('renders the English acknowledged template exactly', () => {
    expect(
      renderTemplate(DEFAULT_TEMPLATES.acknowledged.en, {
        bookTitles: 'Finding Sinhabahu',
        name: 'Nimal',
        orderId: 'AJ-2611-7K3Q',
        trackingUrl: 'https://example.com/en/track/#AJ-2611-7K3Q',
      }),
    ).toBe(
      'Thank you for ordering Finding Sinhabahu, Nimal! 🙏 Your order number is AJ-2611-7K3Q. We will verify your bank transfer shortly and start preparing your book. Track your order here: https://example.com/en/track/#AJ-2611-7K3Q',
    );
  });
  it('leaves out [[optional]] text when its value is empty', () => {
    const tpl = DEFAULT_TEMPLATES.dispatched.si;
    const base = {
      orderId: 'AJ-2611-7K3Q',
      bookTitles: 'Book',
      courier: 'Sri Lanka Post',
      trackingUrl: 'u',
      facebookUrl: 'f',
    };
    const without = renderTemplate(tpl, { ...base, trackingNo: '' });
    expect(without).not.toContain('ලුහුබැඳීමේ අංකය');
    expect(without).not.toContain('[[');
    expect(without).toContain('Sri Lanka Post මගින් තැපැල් කර ඇත. වැඩකරන දින 3ක් ඇතුළත');
    const withNo = renderTemplate(tpl, { ...base, trackingNo: 'RR123LK' });
    expect(withNo).toContain('ලුහුබැඳීමේ අංකය RR123LK.');
  });
  it('upgrades never-edited saved templates but keeps edited ones', () => {
    const merged = mergePrivateConfig({
      templates: {
        acknowledged: { ...LEGACY_TEMPLATES.acknowledged![0] },
        payment_verified: { si: 'Edited by admin', en: LEGACY_TEMPLATES.payment_verified![0].en },
        // The dispatched text from before the 'working days' change also upgrades.
        dispatched: { ...LEGACY_TEMPLATES.dispatched![1] },
      } as never,
    });
    expect(merged.templates.acknowledged.en).toBe(DEFAULT_TEMPLATES.acknowledged.en);
    expect(merged.templates.acknowledged.si).toContain('{trackingUrl}');
    expect(merged.templates.payment_verified.si).toBe('Edited by admin');
    expect(merged.templates.payment_verified.en).toBe(DEFAULT_TEMPLATES.payment_verified.en);
    expect(merged.templates.packed.en).toContain('{trackingUrl}');
    expect(merged.templates.dispatched.si).toContain('වැඩකරන දින 3ක් ඇතුළත');
  });
  it('every default template exists in all three languages with the same variables', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const t of Object.values(DEFAULT_TEMPLATES)) {
      expect(t.si.length).toBeGreaterThan(10);
      expect(t.en.length).toBeGreaterThan(10);
      expect(t.ta!.length).toBeGreaterThan(10);
      expect(vars(t.ta!)).toEqual(vars(t.en));
      expect(vars(t.si)).toEqual(vars(t.en));
    }
  });
  it('bookTitles uses Tamil titles and falls back to English when missing', () => {
    expect(
      bookTitles(
        [
          { title: { si: 'සිං', en: 'Eng', ta: 'தமிழ்' } },
          { title: { si: 'Finding Sinhabahu', en: 'Finding Sinhabahu' } },
        ],
        'ta',
      ),
    ).toContain('தமிழ்');
    expect(bookTitles([{ title: { si: 'සිං', en: 'Eng' } }], 'ta')).toBe('Eng');
  });
});

describe('urls', () => {
  it('wa.me encodes Sinhala and emoji', () => {
    const text = 'ස්තුතියි 🙏 & AJ-2611-7K3Q';
    const url = buildWaUrl('+94 77 123 4567', text);
    expect(url.startsWith('https://wa.me/94771234567?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(text);
    expect(url).not.toContain(' ');
  });
  it('maps url', () =>
    expect(buildMapsUrl(6.9271, 79.8612)).toBe('https://maps.google.com/?q=6.9271,79.8612'));
  it('track url', () => {
    expect(buildTrackUrl('https://x.github.io/booksbyajith/', 'si', 'AJ-2611-7K3Q')).toBe(
      'https://x.github.io/booksbyajith/track/#AJ-2611-7K3Q',
    );
    expect(buildTrackUrl('https://x.github.io/booksbyajith', 'en', 'AJ-2611-7K3Q')).toBe(
      'https://x.github.io/booksbyajith/en/track/#AJ-2611-7K3Q',
    );
  });
  it('order url', () =>
    expect(buildOrderUrl('https://a.b', 'en', 'finding-sinhabahu')).toBe(
      'https://a.b/en/order/?book=finding-sinhabahu',
    ));
  it('courier tracking url', () => {
    expect(buildCourierTrackingUrl('https://c.example.com/t?n={trackingNo}', 'AB 12')).toBe(
      'https://c.example.com/t?n=AB%2012',
    );
    expect(buildCourierTrackingUrl(null, 'AB')).toBeNull();
  });
  it('book titles', () => {
    const items = [{ title: { si: 'අ', en: 'A' } }, { title: { si: 'ආ', en: 'B' } }];
    expect(bookTitles(items, 'si')).toBe('අ, ආ');
    expect(bookTitles(items, 'en')).toBe('A, B');
  });
});
