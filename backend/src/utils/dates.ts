const businessTimeZone = process.env.APP_TIMEZONE || 'America/New_York';

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: businessTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

function zonedParts(date: Date): DateParts {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function offsetMs(date: Date) {
  const parts = zonedParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedDateTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) {
  const utcGuess = Date.UTC(year, month, day, hour, minute, second, ms);
  const first = new Date(utcGuess - offsetMs(new Date(utcGuess)));
  const corrected = new Date(utcGuess - offsetMs(first));
  return corrected;
}

function addBusinessDays(date: Date, days: number) {
  const parts = zonedParts(date);
  return zonedDateTime(parts.year, parts.month - 1, parts.day + days);
}

export function businessDateKey(date: Date) {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function startOfBusinessDay(date: Date) {
  const parts = zonedParts(date);
  return zonedDateTime(parts.year, parts.month - 1, parts.day);
}

export function endOfBusinessDay(date: Date) {
  return new Date(addBusinessDays(startOfBusinessDay(date), 1).getTime() - 1);
}

export function businessDateFromIso(value: string, endOfDay = false) {
  const [year, month, day] = value.split('-').map(Number);
  const start = zonedDateTime(year!, month! - 1, day!);
  return endOfDay ? new Date(addBusinessDays(start, 1).getTime() - 1) : start;
}

export function monthsActive(workStartDate?: Date | null, dateChurned?: Date | null, now = new Date()) {
  if (!workStartDate) return 0;
  const start = zonedParts(workStartDate);
  const end = zonedParts(dateChurned ?? now);
  if (businessDateFromIso(`${end.year}-${String(end.month).padStart(2, '0')}-${String(end.day).padStart(2, '0')}`) < businessDateFromIso(`${start.year}-${String(start.month).padStart(2, '0')}-${String(start.day).padStart(2, '0')}`)) return 0;
  let months = (end.year - start.year) * 12 + end.month - start.month;
  if (end.day < start.day) months -= 1;
  return Math.max(0, months);
}

export function billingDate(anchor: Date, year: number, month: number) {
  const anchorDay = zonedParts(anchor).day;
  const lastDay = zonedParts(zonedDateTime(year, month + 1, 0)).day;
  return zonedDateTime(year, month, Math.min(anchorDay, lastDay));
}

export function nextBillingDate(anchor?: Date | null, now = new Date()) {
  if (!anchor) return null;
  const current = zonedParts(now);
  let due = billingDate(anchor, current.year, current.month - 1);
  if (startOfBusinessDay(due) < startOfBusinessDay(now)) due = billingDate(anchor, current.year, current.month);
  return due;
}

export function billingMonth(date: Date) {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

export function invoiceDueCandidates(anchor?: Date | null, now = new Date(), leadDays = 5) {
  if (!anchor) return [];
  const today = startOfBusinessDay(now);
  const current = zonedParts(today);
  const dueDates = [
    billingDate(anchor, current.year, current.month - 1),
    billingDate(anchor, current.year, current.month)
  ];
  const threshold = (due: Date) => addBusinessDays(due, -leadDays);
  return dueDates.filter((due) => today >= threshold(due));
}

export function invoiceTiming(dueDate: Date, sentDate?: Date | null, now = new Date()) {
  if (!sentDate) return startOfBusinessDay(now) > startOfBusinessDay(dueDate) ? 'Late' : 'Not Sent';
  const days = Math.floor((startOfBusinessDay(dueDate).getTime() - startOfBusinessDay(sentDate).getTime()) / 86400000);
  if (days >= 5) return 'Early';
  if (days >= 0) return 'On Time';
  return 'Late';
}

export function daysBeforeDue(dueDate: Date, sentDate?: Date | null) {
  if (!sentDate) return null;
  return Math.floor((startOfBusinessDay(dueDate).getTime() - startOfBusinessDay(sentDate).getTime()) / 86400000);
}

export function dateRange(from?: string, to?: string) {
  const now = new Date();
  const current = zonedParts(now);
  const start = from ? businessDateFromIso(from) : zonedDateTime(current.year, current.month - 1, 1);
  const end = to ? businessDateFromIso(to, true) : endOfBusinessDay(zonedDateTime(current.year, current.month, 0));
  return { start, end };
}

export function derivedInvoiceStatus(dueDate: Date, sentDate?: Date | null, now = new Date()) {
  if (!sentDate) return startOfBusinessDay(now) > startOfBusinessDay(dueDate) ? 'Late' : 'Not Sent';
  return invoiceTiming(dueDate, sentDate, now) === 'Late' ? 'Late' : 'Sent';
}

export function currentWeekRange(now = new Date()) {
  const start = startOfBusinessDay(now);
  const parts = zonedParts(start);
  const daysSinceMonday = (new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() + 6) % 7;
  const weekStart = addBusinessDays(start, -daysSinceMonday);
  const weekEnd = addBusinessDays(weekStart, 7);
  return { start: weekStart, end: weekEnd };
}
