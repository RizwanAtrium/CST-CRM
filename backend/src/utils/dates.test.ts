import { describe,expect,it } from 'vitest';
import { billingDate,currentWeekRange,daysBeforeDue,invoiceDueCandidates,invoiceTiming,monthsActive,nextBillingDate } from './dates.js';

describe('computed business rules',()=>{
  it('freezes months active on churn',()=>expect(monthsActive(new Date(2026,0,15),new Date(2026,3,15),new Date(2030,0,1))).toBe(3));
  it('uses the last day for short billing months',()=>expect(billingDate(new Date(2026,0,31),2026,1).getDate()).toBe(28));
  it('keeps today as the next billing date throughout the due day',()=>expect(nextBillingDate(new Date(2026,0,20),new Date(2026,5,20,23,59)).getDate()).toBe(20));
  it('starts Sunday weeks on the prior Monday',()=>{
    const range=currentWeekRange(new Date(2026,5,21,12));
    expect(range.start).toEqual(new Date(2026,5,15));
    expect(range.end).toEqual(new Date(2026,5,22));
  });
  it('classifies invoice timing',()=>{const due=new Date(2026,5,20);expect(invoiceTiming(due,new Date(2026,5,15))).toBe('Early');expect(invoiceTiming(due,new Date(2026,5,19))).toBe('On Time');expect(invoiceTiming(due,new Date(2026,5,20))).toBe('Late');expect(daysBeforeDue(due,new Date(2026,5,15))).toBe(5);});
  it('makes the next invoice available five days before its due date',()=>{
    const dates=invoiceDueCandidates(new Date(2026,0,1),new Date(2026,5,27));
    expect(dates.map((date)=>billingDate(date,date.getFullYear(),date.getMonth()))).toHaveLength(2);
    expect(dates[1]).toEqual(new Date(2026,6,1));
  });
  it('does not create a future invoice before the five-day window',()=>{
    const dates=invoiceDueCandidates(new Date(2026,0,20),new Date(2026,5,14));
    expect(dates).toEqual([]);
  });
});
