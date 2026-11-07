import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import catalog from './transit-catalog.json';
import { findTransitLines } from './transit';

// Public, read-only lookup of bundled official data. No secrets or user data.
export const searchTransitLines = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ number: z.string().trim().min(1).max(16).regex(/^[0-9a-zA-Z\s-]+$/) }))
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const matches = findTransitLines(catalog, data.number);
    return { lines: matches.filter((line) => line.validUntil >= today).slice(0, 50),
      expired: matches.some((line) => line.validUntil < today) };
  });