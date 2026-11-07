export type Stop = { n: number; name: string; lat: number; lon: number };
export type Direction = { label: string; stops: Stop[]; kind?: 'ida' | 'volta'; line?: [number, number][] };
export type Itinerary = { title: string; directions: Direction[]; source?: import('./transit').TransitLine };

const ROW = /^(\d{1,4})\s+(.*?)\s+(-\d{1,2}\.\d{3,})\s+(-\d{1,3}\.\d{3,})$/;
const COORDS_ONLY = /^(.*?)\s*(-\d{1,2}\.\d{3,})\s+(-\d{1,3}\.\d{3,})$/;
const NOISE = /^(nº|n°|paradas \(\d+\)|representação esquemática|página \d+)|•.*página \d+$/i;

/** Parse text lines (in reading order) from an itinerary PDF into directions with ordered stops. */
export function parseItinerary(lines: string[]): Itinerary {
  const clean = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const title = clean.find((l) => /linha/i.test(l)) ?? clean[0] ?? "Itinerário";
  const directions: Direction[] = [];
  let current: Direction | null = null;
  let pendingHeading: string | null = null;
  let last: Stop | null = null;

  for (const line of clean) {
    if (/^sentido\b/i.test(line)) {
      pendingHeading = line;
      current = null;
      last = null;
      continue;
    }
    const row = ROW.exec(line);
    if (row) {
      if (!current) {
        current = { label: cleanHeading(pendingHeading) ?? `Sentido ${directions.length + 1}`, stops: [] };
        directions.push(current);
        pendingHeading = null;
      }
      last = { n: Number(row[1]), name: row[2]!.trim(), lat: Number(row[3]), lon: Number(row[4]) };
      current.stops.push(last);
      continue;
    }
    if (pendingHeading && !current && !NOISE.test(line) && !/^paradas/i.test(line) && pendingHeading.length < 120 && !/representa/i.test(line)) {
      pendingHeading += " " + line; // heading wrapped onto a second line
      continue;
    }
    if (NOISE.test(line) || /^paradas/i.test(line)) continue;
    // Continuation of the previous stop's address (wrapped line)
    if (last && current && !COORDS_ONLY.test(line) && line.length < 160) {
      last.name = `${last.name} ${line}`;
    }
  }
  return { title, directions: directions.filter((d) => d.stops.length >= 2) };
}

function cleanHeading(h: string | null) {
  if (!h) return null;
  return h.replace(/^sentido\s*/i, "").replace(/\s*(representa.*)$/i, "").trim();
}

export function shortName(name: string) {
  return name.split(" - ")[0]!.replace(/\s+Mogi das Cruzes - São Paulo.*$/, "").trim();
}

export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** A road leg is rejected (straight line kept instead) when it is much longer than the direct distance — a sign the router took a detour off the line's path. */
export function isDetour(roadMeters: number, directMeters: number) {
  return roadMeters > Math.max(directMeters * 2.5, directMeters + 600);
}

const KEY = "rota-motorista:itinerary";
export function saveItinerary(it: Itinerary) {
  localStorage.setItem(KEY, JSON.stringify(it));
}
export function loadItinerary(): Itinerary | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Itinerary) : null;
  } catch {
    return null;
  }
}
