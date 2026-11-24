import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharpLib from 'sharp';
import { regionLine } from '../shared/districts.js';
import { l10nText } from '../shared/l10n.js';
import { formatLKR } from '../shared/pricing.js';
import type { Lang } from '../shared/constants.js';
import type { OrderDoc } from '../shared/types.js';

/**
 * The order receipt as a one-page A4 PDF for the payment-confirmed email. Text is drawn with
 * sharp (Pango shapes Sinhala and Tamil correctly), then the page image is wrapped in a PDF.
 */
const FONTS = join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
const font = (f: string) => join(FONTS, f);
const F = {
  latin: [font('noto-sans-sinhala-latin-400-normal.woff'), font('noto-sans-sinhala-latin-700-normal.woff')],
  sinhala: [font('noto-sans-sinhala-sinhala-400-normal.woff'), font('noto-sans-sinhala-sinhala-700-normal.woff')],
  tamil: [font('noto-sans-tamil-tamil-400-normal.woff'), font('noto-sans-tamil-tamil-700-normal.woff')],
};

const L: Record<Lang, Record<string, string>> = {
  si: {
    title: 'ඇණවුම් රිසිට්පත', seller: 'විකුණුම්කරු', deliverTo: 'බෙදාහැරිය යුත්තේ', orderId: 'ඇණවුම් අංකය',
    date: 'දිනය', items: 'පොත්', qty: 'ප්‍රමාණය', total: 'මුළු මුදල', subtotal: 'පොත්', bundle: 'පැකේජ වට්ටම',
    signed: 'අත්සන් කළ පිටපත්', delivery: 'බෙදාහැරීම', later: 'පසුව දන්වනු ලැබේ', paid: 'ගෙවීම තහවුරුයි',
    track: 'ඔබගේ ඇණවුම පරීක්ෂා කරන්න', thanks: 'ඉතිහාස පර්යේෂණයට සහාය දීම ගැන ස්තුතියි.',
    site: 'වෛද්‍ය අජිත් අමරසිංහ',
  },
  en: {
    title: 'Order receipt', seller: 'Sold by', deliverTo: 'Deliver to', orderId: 'Order number', date: 'Date',
    items: 'Books', qty: 'Qty', total: 'Total', subtotal: 'Books', bundle: 'Bundle discount',
    signed: 'Signed copies', delivery: 'Delivery', later: 'To be confirmed', paid: 'PAID',
    track: 'Track your order', thanks: 'Thank you for supporting historical research.',
    site: 'Dr. Ajith Amarasinghe',
  },
  ta: {
    title: 'ஆர்டர் ரசீது', seller: 'விற்பனையாளர்', deliverTo: 'அனுப்ப வேண்டிய முகவரி', orderId: 'ஆர்டர் எண்',
    date: 'திகதி', items: 'புத்தகங்கள்', qty: 'அளவு', total: 'மொத்தம்', subtotal: 'புத்தகங்கள்',
    bundle: 'தொகுப்புத் தள்ளுபடி', signed: 'கையொப்பமிட்ட பிரதிகள்', delivery: 'விநியோகம்',
    later: 'பின்னர் அறிவிக்கப்படும்', paid: 'கட்டணம் உறுதி', track: 'உங்கள் ஆர்டரைக் கண்காணிக்கவும்',
    thanks: 'வரலாற்று ஆய்வுக்கு ஆதரவளித்தமைக்கு நன்றி.', site: 'வைத்தியர் அஜித் அமரசிங்க',
  },
};

const W = 1240; // A4 at 150 dpi
const H = 1754;
const M = 90;
const INK = '#2b1d12';
const SOFT = '#5e4b39';
const BROWN = '#6f4626';

const sharp = () => sharpLib;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One block of text as a transparent PNG. */
async function text(
  s: string,
  opt: { size: number; bold?: boolean; color?: string; width?: number; align?: 'left' | 'right' },
) {
  const script = /[஀-௿]/.test(s) ? 'tamil' : /[඀-෿]/.test(s) ? 'sinhala' : 'latin';
  const fontfile = F[script][opt.bold ? 1 : 0];
  const family = script === 'tamil' ? 'Noto Sans Tamil' : 'Noto Sans Sinhala';
  const { data, info } = await sharp()({
    text: {
      text: `<span foreground="${opt.color ?? INK}">${esc(s)}</span>`,
      font: `${family}${opt.bold ? ' Bold' : ''} ${opt.size}`,
      fontfile,
      rgba: true,
      width: opt.width ?? W - 2 * M,
      align: opt.align ?? 'left',
      wrap: 'word',
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

let warmed = false;
/** Register the Latin fonts first, so digits and Latin letters in Sinhala/Tamil text render. */
async function warmUp() {
  if (warmed) return;
  await text('0', { size: 10 });
  await text('0', { size: 10, bold: true });
  warmed = true;
}

export async function buildReceiptPdf(order: OrderDoc, trackUrl: string): Promise<Buffer> {
  await warmUp();
  const lang = order.lang;
  const t = L[lang];
  const layers: { input: Buffer; left: number; top: number }[] = [];
  const put = async (s: string, left: number, top: number, o: Parameters<typeof text>[1]) => {
    const r = await text(s, o);
    layers.push({ input: r.data, left: Math.round(o.align === 'right' ? left - r.width : left), top: Math.round(top) });
    return r.height;
  };
  const rule = (top: number, h = 2, color = '#e6dccb') =>
    layers.push({
      input: Buffer.from(`<svg width="${W - 2 * M}" height="${h}"><rect width="100%" height="100%" fill="${color}"/></svg>`),
      left: M,
      top: Math.round(top),
    });

  let y = M;
  // Header: title and seller on the left, order number on the right.
  await put(t.orderId, W - M, y, { size: 22, color: SOFT, align: 'right', width: 520 });
  await put(order.orderId, W - M, y + 34, { size: 40, bold: true, align: 'right', width: 520 });
  y += (await put(t.title, M, y, { size: 46, bold: true, width: 600 })) + 6;
  y += await put(`${t.seller}: ${t.site}`, M, y, { size: 24, color: SOFT, width: 600 });
  y = Math.max(y, M + 90) + 20;
  rule(y, 6, BROWN);
  y += 30;

  // Paid stamp
  const paidH = await put(`✓ ${t.paid}`, W - M, y, { size: 30, bold: true, color: '#1f7a3a', align: 'right', width: 520 });

  // Deliver to
  const a = order.address;
  y += (await put(t.deliverTo, M, y, { size: 22, color: SOFT, width: 640 })) + 4;
  y += (await put(order.customer.name, M, y, { size: 28, bold: true, width: 640 })) + 2;
  for (const line of [[a.line1, a.line2, a.city].filter(Boolean).join(', '), regionLine(a, 'en')])
    y += await put(line, M, y, { size: 26, width: 700 });
  y = Math.max(y, y + 0, M + 200 + paidH) + 24;

  // Date
  const created = (order.createdAt as { toDate?: () => Date }).toDate?.() ?? new Date();
  const date = created.toLocaleDateString(lang === 'si' ? 'si-LK' : lang === 'ta' ? 'ta-LK' : 'en-GB', {
    timeZone: 'Asia/Colombo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  y += (await put(`${t.date}: ${date}`, M, y, { size: 24, color: SOFT })) + 24;

  // Items
  rule(y);
  y += 16;
  await put(t.qty, W - M - 260, y, { size: 22, color: SOFT, align: 'right', width: 200 });
  await put(t.total, W - M, y, { size: 22, color: SOFT, align: 'right', width: 240 });
  y += (await put(t.items, M, y, { size: 22, color: SOFT, width: 600 })) + 10;
  for (const i of order.items) {
    await put(String(i.qty), W - M - 260, y, { size: 26, align: 'right', width: 200 });
    await put(formatLKR(i.lineTotalLKR), W - M, y, { size: 26, align: 'right', width: 240 });
    y += (await put(l10nText(i.title, lang), M, y, { size: 26, width: 660 })) + 12;
  }
  rule(y);
  y += 18;

  // Totals
  const tot = order.totals;
  const overseas = a.districtId === 'overseas';
  const rows: [string, string][] = [
    [t.subtotal, formatLKR(tot.subtotalLKR)],
    ...(tot.bundleDiscountLKR > 0 ? [[t.bundle, `−${formatLKR(tot.bundleDiscountLKR)}`] as [string, string]] : []),
    ...(tot.signedSurchargeLKR > 0 ? [[t.signed, formatLKR(tot.signedSurchargeLKR)] as [string, string]] : []),
    [t.delivery, overseas ? t.later : formatLKR(tot.deliveryFeeLKR)],
  ];
  for (const [k, v] of rows) {
    await put(v, W - M, y, { size: 26, align: 'right', width: 400 });
    y += (await put(k, M + 420, y, { size: 26, color: SOFT, width: 300 })) + 8;
  }
  rule(y + 4, 3, BROWN);
  y += 22;
  await put(formatLKR(tot.grandTotalLKR), W - M, y, { size: 34, bold: true, align: 'right', width: 400 });
  y += (await put(t.total, M + 420, y, { size: 34, bold: true, width: 300 })) + 50;

  // Tracking link and thanks
  y += (await put(t.track, M, y, { size: 24, bold: true, color: BROWN })) + 4;
  const linkTop = y;
  const linkH = await put(trackUrl, M, y, { size: 20, color: '#1a5fb4' });
  y += linkH + 40;
  await put(t.thanks, M, y, { size: 26, color: BROWN });

  const jpg = await sharp()({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite(layers)
    .jpeg({ quality: 88 })
    .toBuffer();
  return jpegToPdf(jpg, W, H, { url: trackUrl, top: linkTop, height: linkH });
}

/** A one-page A4 PDF holding a JPEG, with the tracking link clickable. */
function jpegToPdf(jpg: Buffer, w: number, h: number, link: { url: string; top: number; height: number }): Buffer {
  const pw = 595.28;
  const ph = 841.89;
  const k = pw / w;
  const ly = ph - (link.top + link.height) * k;
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const uri = link.url.replace(/[()\\]/g, (c) => `\\${c}`);
  const objs: (string | Buffer)[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R] >>`,
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
      ),
      jpg,
      Buffer.from('\nendstream'),
    ]),
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Type /Annot /Subtype /Link /Rect [${(M * k).toFixed(2)} ${ly.toFixed(2)} ${(pw - M * k).toFixed(2)} ${(ly + link.height * k).toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI (${uri}) >> >>`,
  ];
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets: number[] = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    const body = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(o) ? o : Buffer.from(o), Buffer.from('\nendobj\n')]);
    offsets.push(pos);
    parts.push(body);
    pos += body.length;
  });
  const xref =
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref));
  return Buffer.concat(parts);
}

// Keep the font files' presence visible at deploy time (fails fast if the assets are missing).
export function receiptFontsPresent(): boolean {
  try {
    readFileSync(F.sinhala[0]);
    return true;
  } catch {
    return false;
  }
}
