import { ORDER_STATUSES } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { si } from './si';
import { ta } from './ta';

describe('i18n dictionaries', () => {
  it('name and describe every order status', () => {
    for (const s of ORDER_STATUSES) {
      expect(si, s).toHaveProperty([`status.${s}`]);
      expect(si, s).toHaveProperty([`status.desc.${s}`]);
    }
  });
  it('have identical keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(si).sort());
    expect(Object.keys(ta).sort()).toEqual(Object.keys(si).sort());
  });
  it('have no empty values', () => {
    for (const d of [si, en, ta]) for (const [k, v] of Object.entries(d)) expect(v.trim(), k).not.toBe('');
  });
  it('keep the same placeholders', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(si) as (keyof typeof si)[]) {
      expect(vars(en[k]), k).toBe(vars(si[k]));
      expect(vars(ta[k]), k).toBe(vars(si[k]));
    }
  });
});
