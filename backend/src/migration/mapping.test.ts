import { describe, expect, it } from 'vitest';
import { buildMigrationPlan, validateMigrationConfig } from './mapping.js';
import type { MigrationConfig } from './types.js';

const config: MigrationConfig = {
  clientSheet: 'Clients',
  onboardingSheet: 'Onboarding',
  clientColumns: { businessName:'Business', saleDate:'Sale', workStartDate:'Start', lifecycleStage:'Stage', dateChurned:'Churn' },
  services: [{ name:'SEO', column:'SEO' }],
  onboardingColumns: { businessName:'Business', delaySide:'Delay', delayReason:'Reason', accessReceived:'Access' },
  historicalMonths: [{ column:'June Revenue', billingMonth:'2026-06' }]
};

describe('Excel migration mapping',()=>{
  it('requires explicit historical month labels',()=>{
    expect(()=>validateMigrationConfig({...config,historicalMonths:[]})).toThrow(/historicalMonths/);
    expect(()=>validateMigrationConfig({...config,historicalMonths:[{column:'BH',billingMonth:'June'}]})).toThrow(/billingMonth/);
  });
  it('normalizes services invoices and onboarding without computed columns',()=>{
    const plan=buildMigrationPlan([{rowNumber:2,values:{Business:'Acme',Sale:'2026-01-01',Start:'2026-01-05',Stage:'Active',SEO:'1,200','June Revenue':'1500','[AUTO] Months':99}}],[{rowNumber:2,values:{Business:'Acme',Delay:'N/A',Access:'Yes'}}],config);
    expect(plan.clients[0]?.services).toEqual([{name:'SEO',monthlyAmount:1200}]);
    expect(plan.clients[0]?.invoices).toEqual([{billingMonth:'2026-06',amount:1500}]);
    expect(plan.onboarding[0]?.accessReceived).toBe(true);
    expect(plan.reconciliation.invoiceTotalsByMonth['2026-06']).toBe(1500);
  });
  it('rejects duplicates and unmatched onboarding rows',()=>{
    const plan=buildMigrationPlan([
      {rowNumber:2,values:{Business:'Acme Inc',Sale:'2026-01-01',Start:'2026-01-05'}},
      {rowNumber:3,values:{Business:' ACME INC ',Sale:'2026-01-01',Start:'2026-01-05'}}
    ],[{rowNumber:2,values:{Business:'Missing Client'}}],config);
    expect(plan.clients).toHaveLength(0);
    expect(plan.duplicates[0]?.rows).toEqual([2,3]);
    expect(plan.rejected).toHaveLength(3);
  });
});
