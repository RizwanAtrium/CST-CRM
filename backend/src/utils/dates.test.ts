import { describe,expect,it } from 'vitest';
import { billingDate,businessDateKey,currentWeekRange,daysBeforeDue,invoiceDueCandidates,invoiceTiming,monthsActive,nextBillingDate } from './dates.js';

describe('computed business rules',()=>{
  it('freezes months active on churn',()=>expect(monthsActive(new Date('2026-01-15T05:00:00.000Z'),new Date('2026-04-15T04:00:00.000Z'),new Date('2030-01-01T05:00:00.000Z'))).toBe(3));
  it('uses the last day for short billing months',()=>expect(businessDateKey(billingDate(new Date('2026-01-31T05:00:00.000Z'),2026,1))).toBe('2026-02-28'));
  it('keeps today as the next billing date throughout the due day',()=>expect(businessDateKey(nextBillingDate(new Date('2026-01-20T05:00:00.000Z'),new Date('2026-06-21T03:59:00.000Z'))!)).toBe('2026-06-20'));
  it('starts Sunday weeks on the prior Monday',()=>{
    const range=currentWeekRange(new Date('2026-06-21T16:00:00.000Z'));
    expect(range.start).toEqual(new Date('2026-06-15T04:00:00.000Z'));
    expect(range.end).toEqual(new Date('2026-06-22T04:00:00.000Z'));
  });
  it('classifies invoice timing',()=>{const due=new Date('2026-06-20T04:00:00.000Z');expect(invoiceTiming(due,new Date('2026-06-15T04:00:00.000Z'))).toBe('Early');expect(invoiceTiming(due,new Date('2026-06-19T04:00:00.000Z'))).toBe('On Time');expect(invoiceTiming(due,new Date('2026-06-20T04:00:00.000Z'))).toBe('Late');expect(daysBeforeDue(due,new Date('2026-06-15T04:00:00.000Z'))).toBe(5);});
  it('makes the next invoice available five days before its due date',()=>{
    const dates=invoiceDueCandidates(new Date('2026-01-01T05:00:00.000Z'),new Date('2026-06-27T16:00:00.000Z'));
    expect(dates.map(businessDateKey)).toEqual(['2026-06-01','2026-07-01']);
  });
  it('does not create a future invoice before the five-day window',()=>{
    const dates=invoiceDueCandidates(new Date('2026-01-20T05:00:00.000Z'),new Date('2026-06-14T16:00:00.000Z'));
    expect(dates).toEqual([]);
  });
});
