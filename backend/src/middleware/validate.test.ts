import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate } from './validate.js';

describe('validate middleware', () => {
  it('shadows the Express 5 readonly query getter with parsed values', () => {
    const prototype = {};
    Object.defineProperty(prototype, 'query', { get: () => ({ page: '2' }), configurable: true });
    const request = Object.create(prototype);
    const next = vi.fn();

    validate(z.object({ page: z.coerce.number().int() }), 'query')(request, {} as never, next);

    expect(next).toHaveBeenCalledWith();
    expect(request.query).toEqual({ page: 2 });
  });
});
