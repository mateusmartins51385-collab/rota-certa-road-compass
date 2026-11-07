import { describe, expect, it } from 'vitest';
import catalog from './transit-catalog.json';
import { findTransitLines, officialRoute } from './transit';

describe('Official line-number lookup', () => {
  it('finds metropolitan Guarulhos line 003 from number 3', () => {
    const result = findTransitLines(catalog, '3');
    expect(result.some((r) => r.number === '003' && r.name.includes('GUARULHOS'))).toBe(true);
    expect(result.every((r) => r.number.startsWith('003'))).toBe(true);
  });
  it('finds São Paulo line 1016-10 without matching unrelated prefixes', () => {
    const result = findTransitLines(catalog, '1016-10');
    expect(result).toHaveLength(1);
    expect(result[0]?.provider).toBe('sptrans');
    expect(findTransitLines(catalog, '101').some((r) => r.number === '1016-10')).toBe(false);
  });
  it('shows line variants when the suffix is not supplied', () => {
    expect(findTransitLines(catalog, '1012').map((r) => r.number)).toEqual(['1012-10', '1012-21']);
  });
  it('does not claim municipal Guarulhos coverage or invent unknown lines', () => {
    expect(catalog.every((r) => ['artesp', 'sptrans'].includes(r.provider))).toBe(true);
    expect(findTransitLines(catalog, '999999')).toEqual([]);
    expect(findTransitLines(catalog, '')).toEqual([]);
  });
  it('uses the official shape unchanged rather than connecting only stops', () => {
    const line: [number, number][] = [[-23.4, -46.5], [-23.401, -46.502], [-23.405, -46.51]];
    expect(officialRoute({ title: 'Official', directions: [{ label: 'Ida', stops: [], line }] }, 0)).toBe(line);
    expect(officialRoute({ title: 'PDF', directions: [{ label: 'Ida', stops: [] }] }, 0)).toBeNull();
  });
});