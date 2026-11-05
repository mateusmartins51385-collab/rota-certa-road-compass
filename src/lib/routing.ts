import { distanceMeters, isDetour, type Stop } from "./itinerary";

const OSRM = "https://router.project-osrm.org/route/v1/driving";
const BATCH = 60;

export type RouteResult = { line: [number, number][]; distance: number; straightLegs: number };

/**
 * Builds a road path that passes through every stop in the exact order of the itinerary.
 * Any leg where the router would detour is replaced by a straight segment, so the
 * line's course is never changed.
 */
export async function buildRoute(stops: Stop[], onProgress?: (msg: string) => void): Promise<RouteResult> {
  const line: [number, number][] = [];
  let distance = 0;
  let straightLegs = 0;
  for (let start = 0; start < stops.length - 1; start += BATCH - 1) {
    const batch = stops.slice(start, start + BATCH);
    onProgress?.(`Traçando paradas ${start + 1}–${start + batch.length} de ${stops.length}…`);
    let legs: { coords: [number, number][]; distance: number }[] | null = null;
    try {
      const coords = batch.map((s) => `${s.lon},${s.lat}`).join(";");
      const res = await fetch(`${OSRM}/${coords}?overview=false&steps=true&geometries=geojson&continue_straight=true`);
      const data = await res.json();
      if (data.code === "Ok") {
        legs = data.routes[0].legs.map((leg: { distance: number; steps: { geometry: { coordinates: [number, number][] } }[] }) => ({
          distance: leg.distance,
          coords: leg.steps.flatMap((st) => st.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])),
        }));
      }
    } catch {
      legs = null;
    }
    for (let i = 0; i < batch.length - 1; i++) {
      const a = batch[i]!;
      const b = batch[i + 1]!;
      const direct = distanceMeters(a, b);
      const leg = legs?.[i];
      if (leg && leg.coords.length && !isDetour(leg.distance, direct)) {
        line.push(...leg.coords);
        distance += leg.distance;
      } else {
        line.push([a.lat, a.lon], [b.lat, b.lon]);
        distance += direct;
        straightLegs++;
      }
    }
  }
  return { line, distance, straightLegs };
}
