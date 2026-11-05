import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Stop } from "@/lib/itinerary";

type Props = {
  stops: Stop[];
  line: [number, number][];
  activeIndex: number;
  position: { lat: number; lon: number; heading: number | null } | null;
  follow: boolean;
};

export default function RouteMap({ stops, line, activeIndex, position, follow }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: false }).setView([-23.55, -46.63], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map.current);
    layers.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layers.current;
    if (!m || !g) return;
    g.clearLayers();
    const css = getComputedStyle(document.documentElement);
    const route = css.getPropertyValue("--route").trim() || "teal";
    const done = css.getPropertyValue("--muted-foreground").trim() || "gray";
    const next = css.getPropertyValue("--primary").trim() || "orange";
    const pl = L.polyline(line.length ? line : stops.map((s) => [s.lat, s.lon] as [number, number]), {
      color: route,
      weight: 7,
      opacity: 0.85,
    }).addTo(g);
    stops.forEach((s, i) => {
      L.circleMarker([s.lat, s.lon], {
        radius: i === activeIndex ? 10 : 5,
        color: "white",
        weight: 2,
        fillColor: i < activeIndex ? done : i === activeIndex ? next : route,
        fillOpacity: 1,
      })
        .bindPopup(`<strong>${s.n}.</strong> ${s.name.replace(/[<>&]/g, "")}`)
        .addTo(g);
    });
    if (!follow) m.fitBounds(pl.getBounds(), { padding: [30, 30] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, line, activeIndex]);

  useEffect(() => {
    const m = map.current;
    if (!m || !position) return;
    if (!me.current) {
      me.current = L.circleMarker([position.lat, position.lon], {
        radius: 11,
        color: "white",
        weight: 4,
        fillColor: "#1d6fe0",
        fillOpacity: 1,
      }).addTo(m);
    } else me.current.setLatLng([position.lat, position.lon]);
    if (follow) m.setView([position.lat, position.lon], Math.max(m.getZoom(), 17));
  }, [position, follow]);

  return <div ref={el} className="h-full w-full" />;
}
