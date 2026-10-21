/** Date helpers working on plain YYYY-MM-DD strings (no timezone drift). */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export const periodKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/**
 * Rent for a calendar month, pro-rated by days when the lease starts or ends inside it.
 * Returns 0 when the lease does not overlap the month.
 */
export function proratedRent(opts: {
  monthlyRent: number;
  year: number;
  month: number; // 1-12
  leaseStart: string;
  leaseEnd?: string | null;
}): { amount: number; days: number; totalDays: number; from: string; to: string } {
  const total = daysInMonth(opts.year, opts.month);
  const monthStart = `${periodKey(opts.year, opts.month)}-01`;
  const monthEnd = `${periodKey(opts.year, opts.month)}-${String(total).padStart(2, '0')}`;
  const from = opts.leaseStart > monthStart ? opts.leaseStart.slice(0, 10) : monthStart;
  const to = opts.leaseEnd && opts.leaseEnd.slice(0, 10) < monthEnd ? opts.leaseEnd.slice(0, 10) : monthEnd;
  if (from > to) return { amount: 0, days: 0, totalDays: total, from, to };
  const days = Math.round((parseYmd(to).getTime() - parseYmd(from).getTime()) / 86_400_000) + 1;
  const amount = days === total ? opts.monthlyRent : Math.round((opts.monthlyRent * days * 100) / total) / 100;
  return { amount, days, totalDays: total, from, to };
}

export function dueDateFor(year: number, month: number, dueDay: number): string {
  return `${periodKey(year, month)}-${String(Math.min(dueDay, daysInMonth(year, month))).padStart(2, '0')}`;
}

const ET_MONTHS = ['jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni', 'juuli', 'august', 'september', 'oktoober', 'november', 'detsember'];
export const etMonth = (month: number) => ET_MONTHS[month - 1];

export const etDate = (s?: string | null) => {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};
