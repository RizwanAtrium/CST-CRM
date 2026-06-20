import { describe, expect, it } from 'vitest';
import { Invoice } from './Invoice.js';

const base = {
  client: '507f1f77bcf86cd799439011',
  billingMonth: '2026-06',
  amount: 1000,
  issueDate: new Date(2026, 4, 15),
  dueDate: new Date(2026, 5, 20),
  status: 'Sent' as const
};

describe('invoice ledger validation', () => {
  it('requires a sent date and paid date before payment', async () => {
    const invoice = new Invoice({ ...base, paid: true, paidDate: new Date(2026, 5, 18) });
    await expect(invoice.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ sentDate: expect.anything() })
    });
  });

  it('rejects payment before the invoice was sent', async () => {
    const invoice = new Invoice({
      ...base,
      sentDate: new Date(2026, 5, 18),
      paid: true,
      paidDate: new Date(2026, 5, 17)
    });
    await expect(invoice.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ paidDate: expect.anything() })
    });
  });

  it('clears paidDate when payment is reversed', async () => {
    const invoice = new Invoice({ ...base, sentDate: new Date(2026, 5, 15), paid: false, paidDate: new Date(2026, 5, 18) });
    await invoice.validate();
    expect(invoice.paidDate).toBeNull();
  });
});
