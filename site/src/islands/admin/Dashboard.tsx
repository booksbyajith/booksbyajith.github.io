import { l10nText as tl } from '@shared/l10n';
import { ORDER_STATUSES } from '@shared/types';
import { formatLKR } from '@shared/pricing';
import type { BookDoc, OrderStatus } from '@shared/types';
import { useEffect, useState } from 'preact/hooks';
import type { I18nKey } from '../../i18n/si';
import { adminFirebase } from './fb';
import { Section, useAdmin, useT } from './ui';

function colomboStart(kind: 'day' | 'month'): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = parts.split('-');
  return new Date(`${y}-${m}-${kind === 'day' ? d : '01'}T00:00:00+05:30`);
}

// Gregorian month names as used in Sri Lanka (the browser's si locale gives the old Sinhala months).
const SI_MONTHS = [
  'ජනවාරි',
  'පෙබරවාරි',
  'මාර්තු',
  'අප්‍රේල්',
  'මැයි',
  'ජූනි',
  'ජූලි',
  'අගෝස්තු',
  'සැප්තැම්බර්',
  'ඔක්තෝබර්',
  'නොවැම්බර්',
  'දෙසැම්බර්',
];

export function Dashboard() {
  const t = useT();
  const { lang } = useAdmin();
  const [counts, setCounts] = useState<Partial<Record<OrderStatus, number>>>({});
  const [today, setToday] = useState<number | null>(null);
  const [revenue, setRevenue] = useState<number | null>(null);
  const [revenueAll, setRevenueAll] = useState<number | null>(null);
  const [low, setLow] = useState<BookDoc[]>([]);
  const [extra, setExtra] = useState({ reviews: 0, enquiries: 0, failures: 0 });

  useEffect(() => {
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      const orders = fs.collection(db, 'orders');
      const c: Partial<Record<OrderStatus, number>> = {};
      await Promise.all(
        ORDER_STATUSES.map(async (s) => {
          c[s] = (await fs.getCountFromServer(fs.query(orders, fs.where('status', '==', s)))).data().count;
        }),
      );
      setCounts(c);
      setToday(
        (
          await fs.getCountFromServer(
            fs.query(orders, fs.where('createdAt', '>=', fs.Timestamp.fromDate(colomboStart('day')))),
          )
        ).data().count,
      );
      const paidStatuses = ['payment_verified', 'packed', 'dispatched', 'delivered'];
      const sumTotals = async (q: ReturnType<typeof fs.query>) => {
        try {
          return (
            (await fs.getAggregateFromServer(q, { total: fs.sum('totals.grandTotalLKR') })).data().total ?? 0
          );
        } catch {
          const snap = await fs.getDocs(q); // R6 fallback
          return snap.docs.reduce((n, d) => n + (d.get('totals.grandTotalLKR') ?? 0), 0);
        }
      };
      // "This month" is the calendar month in Sri Lanka time: it starts again from
      // zero on the 1st. The all-time total never resets.
      setRevenue(
        await sumTotals(
          fs.query(
            orders,
            fs.where('status', 'in', paidStatuses),
            fs.where('createdAt', '>=', fs.Timestamp.fromDate(colomboStart('month'))),
          ),
        ),
      );
      setRevenueAll(await sumTotals(fs.query(orders, fs.where('status', 'in', paidStatuses))));
      const priv = (await fs.getDoc(fs.doc(db, 'config/private'))).data();
      const threshold = (priv?.lowStockThreshold as number | undefined) ?? 5;
      const books = (await fs.getDocs(fs.collection(db, 'books'))).docs.map((d) => d.data() as BookDoc);
      setLow(books.filter((b) => b.saleMode === 'direct' && !b.preorder && b.stock <= threshold));
      const weekAgo = fs.Timestamp.fromMillis(Date.now() - 7 * 86400_000);
      const [r, e, f] = await Promise.all([
        fs.getCountFromServer(
          fs.query(fs.collection(db, 'review_submissions'), fs.where('status', '==', 'pending')),
        ),
        fs.getCountFromServer(fs.query(fs.collection(db, 'enquiries'), fs.where('handledAt', '==', null))),
        fs.getCountFromServer(
          fs.query(fs.collection(db, 'notification_failures'), fs.where('at', '>=', weekAgo)),
        ),
      ]);
      setExtra({ reviews: r.data().count, enquiries: e.data().count, failures: f.data().count });
    })();
  }, []);

  // Every real order: all statuses except rejected and cancelled.
  const total = ORDER_STATUSES.every((s) => counts[s] !== undefined)
    ? ORDER_STATUSES.filter((s) => s !== 'rejected' && s !== 'cancelled').reduce(
        (n, s) => n + (counts[s] ?? 0),
        0,
      )
    : null;
  const monthIdx = Number(
    new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date()),
  );
  const monthName =
    lang === 'si'
      ? SI_MONTHS[monthIdx - 1]
      : new Intl.DateTimeFormat(lang === 'ta' ? 'ta-LK' : 'en-GB', {
          month: 'long',
          timeZone: 'Asia/Colombo',
        }).format(new Date());

  const tile = (label: string, value: string | number | null, href?: string, warn = false) => (
    <a href={href ?? '#/'} class={`card block p-4 text-ink no-underline ${warn ? 'border-danger' : ''}`}>
      <p class="text-sm text-ink-soft">{label}</p>
      <p class="mt-1 text-2xl font-bold">{value ?? '…'}</p>
    </a>
  );

  return (
    <div data-screen="dashboard">
      <div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile(t('admin.dash.today'), today, '#/orders')}
        {tile(t('admin.dash.totalOrders'), total, '#/orders')}
        {tile(`${t('admin.dash.revenueMonth')} (${monthName})`, revenue === null ? null : formatLKR(revenue))}
        {tile(t('admin.dash.revenueAll'), revenueAll === null ? null : formatLKR(revenueAll))}
        {tile(t('admin.dash.pendingReviews'), extra.reviews, '#/reviews')}
        {tile(t('admin.dash.enquiries'), extra.enquiries, '#/enquiries')}
        {tile(t('admin.dash.failures'), extra.failures, undefined, extra.failures > 0)}
      </div>
      <Section title={t('admin.dash.byStatus')}>
        <ul class="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="status-counts">
          {ORDER_STATUSES.map((s) => (
            <li>
              <a
                href={`#/orders?status=${s}`}
                class="flex justify-between rounded border border-line px-3 py-2 text-ink no-underline"
                data-count={s}
              >
                <span>{t(`status.${s}` as I18nKey)}</span>
                <strong>{counts[s] ?? '…'}</strong>
              </a>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('admin.dash.lowStock')}>
        {low.length === 0 ? (
          <p class="text-ink-soft">—</p>
        ) : (
          <ul>
            {low.map((b) => (
              <li class="text-danger">
                {tl(b.title, lang)}: {b.stock}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
