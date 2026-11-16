import { describe, expect, it } from 'vitest';
import { legacyRedirect } from './legacyBase';

describe('legacyRedirect', () => {
  it('maps old /home/ addresses to the root site', () => {
    expect(legacyRedirect('/home/', '')).toBe('/');
    expect(legacyRedirect('/home', '')).toBe('/');
    expect(legacyRedirect('/home/en/order/', '')).toBe('/en/order/');
    expect(legacyRedirect('/home/track/', '/')).toBe('/track/');
  });
  it('does nothing while the site still lives at /home or for other paths', () => {
    expect(legacyRedirect('/home/en/', '/home')).toBeNull();
    expect(legacyRedirect('/homework/', '')).toBeNull();
    expect(legacyRedirect('/en/books/', '')).toBeNull();
  });
});
