const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function monthsActive(workStartDate: Date, dateChurned?: Date | null, now = new Date()) {
  const start = startOfDay(workStartDate);
  const end = startOfDay(dateChurned ?? now);
  if (end < start) return 0;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function billingDate(anchor: Date, year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(anchor.getDate(), lastDay));
}

export function nextBillingDate(anchor: Date, now = new Date()) {
  let due = billingDate(anchor, now.getFullYear(), now.getMonth());
  if (startOfDay(due) < startOfDay(now)) due = billingDate(anchor, now.getFullYear(), now.getMonth() + 1);
  return due;
}

export function billingMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function invoiceDueCandidates(anchor: Date, now = new Date(), leadDays = 5) {
  const today = startOfDay(now);
  const current = billingDate(anchor, today.getFullYear(), today.getMonth());
  const next = billingDate(anchor, today.getFullYear(), today.getMonth() + 1);
  const threshold = (due: Date) => {
    const date = new Date(due);
    date.setDate(date.getDate() - leadDays);
    return startOfDay(date);
  };
  return [current, next].filter((due) => today >= threshold(due));
}

export function invoiceTiming(dueDate: Date, sentDate?: Date | null, now = new Date()) {
  if (!sentDate) return startOfDay(now) > startOfDay(dueDate) ? 'Late' : 'Not Sent';
  const days = Math.floor((startOfDay(dueDate).getTime() - startOfDay(sentDate).getTime()) / 86400000);
  if (days >= 5) return 'Early';
  if (days >= 1) return 'On Time';
  return 'Late';
}

export function daysBeforeDue(dueDate: Date, sentDate?: Date | null) {
  if (!sentDate) return null;
  return Math.floor((startOfDay(dueDate).getTime() - startOfDay(sentDate).getTime()) / 86400000);
}

export function dateRange(from?: string, to?: string) {
  const now = new Date();
  const start = from ? new Date(`${from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function derivedInvoiceStatus(dueDate: Date, sentDate?: Date | null, now = new Date()) {
  if (!sentDate) return startOfDay(now) > startOfDay(dueDate) ? 'Late' : 'Not Sent';
  return invoiceTiming(dueDate, sentDate, now) === 'Late' ? 'Late' : 'Sent';
}

export function currentWeekRange(now = new Date()) {
  const start = startOfDay(now);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}
