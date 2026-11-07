import type { Itinerary } from './itinerary';

export type TransitLine = {
  id: string; number: string; name: string; provider: string; area: string;
  source: string; importedAt: string; version: string; validUntil: string;
  directionCount: number; hasReturn: boolean;
};

export function normalizeLine(value: string) {
  return value.trim().toUpperCase().replace(/\s/g, '').replace(/^(\d+)(?=\D|$)/, (n) => String(Number(n)));
}

export function findTransitLines(catalog: TransitLine[], query: string): TransitLine[] {
  const normalized = normalizeLine(query);
  if (!normalized || !/^[0-9A-Z-]{1,16}$/.test(normalized)) return [];
  return catalog.filter((line) => {
    const number = normalizeLine(line.number);
    return number === normalized || (!normalized.includes('-') && number.split('-')[0] === normalized)
      || (/^\d+$/.test(normalized) && number.replace(/[A-Z].*$/, '') === normalized);
  }).sort((a, b) => a.number.localeCompare(b.number));
}

export function officialRoute(itinerary: Itinerary, index: number) {
  const line = itinerary.directions[index]?.line;
  if (!line || line.length < 2) return null;
  return line;
}

export function directionName(kind: 'ida' | 'volta' | undefined, index: number) {
  return kind === 'ida' ? 'Ida' : kind === 'volta' ? 'Volta' : index === 0 ? 'Ida' : index === 1 ? 'Volta' : `Sentido ${index + 1}`;
}