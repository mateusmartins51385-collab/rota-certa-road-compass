import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Stop } from "@/lib/itinerary";
import { Button } from '@/components/ui/button';
import { LocateFixed, Maximize, Plus, Minus, Compass } from 'lucide-react';

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
  const me = useRef<L.Marker | null>(null);
  const bounds = useRef<L.LatLngBounds | null>(null);
  const [tracking, setTracking] = useState(true);
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;
  const [headingUp, setHeadingUp] = useState(true);
  const [bearing, setBearing] = useState(0);
  const last = useRef<{ lat: number; lon: number } | null>(null);
  const bearingRef = useRef(0);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: false }).setView([-23.55, -46.63], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map.current);
    layers.current = L.layerGroup().addTo(map.current);
    map.current.on('dragstart', () => setTracking(false));
    return () => {
      map.current?.remove();
      map.current = null;
      me.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layers.current;
    if (!m || !g) return;
    g.clearLayers();
    const css = getComputedStyle(document.documentElement);
    const route = css.getPropertyValue("--navigation-route").trim();
    const outline = css.getPropertyValue("--navigation-route-outline").trim();
    const done = css.getPropertyValue("--muted-foreground").trim();
    const next = css.getPropertyValue("--navigation-accent").trim();
    const surface = css.getPropertyValue('--navigation-surface').trim();
    const points = line.length ? line : stops.map((s) => [s.lat, s.lon] as [number, number]);
    if (!points.length) return;
    L.polyline(points, { color: outline, weight: 11, opacity: 1 }).addTo(g);
    const pl = L.polyline(points, {
      color: route,
      weight: 7,
      opacity: 1,
    }).addTo(g);
    stops.forEach((s, i) => {
      L.circleMarker([s.lat, s.lon], {
        radius: i === activeIndex ? 9 : 3,
        color: surface,
        weight: 2,
        fillColor: i < activeIndex ? done : i === activeIndex ? next : route,
        fillOpacity: 1,
      })
        .bindPopup(`<strong>${s.n}.</strong> ${s.name.replace(/[<>&]/g, "")}`)
        .addTo(g);
    });
    bounds.current = pl.getBounds();
    if (!follow) m.fitBounds(pl.getBounds(), { paddingTopLeft: [30, 150], paddingBottomRight: [70, 230] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, line, activeIndex]);

  useEffect(() => {
    const m = map.current;
    if (!m || !position) return;
    if (!me.current) {
      me.current = L.marker([position.lat, position.lon], {
        icon: L.divIcon({ className: 'navigation-marker', iconSize: [48, 48], iconAnchor: [24, 24],
          html: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><path d="M24 8 36 36 24 30 12 36Z"/></svg>' }),
        zIndexOffset: 1000,
      }).addTo(m);
    } else me.current.setLatLng([position.lat, position.lon]);
    // Direction: device heading when moving, otherwise bearing from the last fixes.
    let h: number | null = position.heading != null && !Number.isNaN(position.heading) ? position.heading : null;
    const prev = last.current;
    if (prev) {
      const y = Math.sin((position.lon - prev.lon) * Math.PI / 180) * Math.cos(position.lat * Math.PI / 180);
      const x = Math.cos(prev.lat * Math.PI / 180) * Math.sin(position.lat * Math.PI / 180) - Math.sin(prev.lat * Math.PI / 180) * Math.cos(position.lat * Math.PI / 180) * Math.cos((position.lon - prev.lon) * Math.PI / 180);
      const moved = Math.hypot(position.lat - prev.lat, (position.lon - prev.lon) * Math.cos(position.lat * Math.PI / 180)) * 111320;
      if (moved > 6) { if (h == null) h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; last.current = { lat: position.lat, lon: position.lon }; }
    } else last.current = { lat: position.lat, lon: position.lon };
    if (h != null) {
      // unwrap so the CSS transition turns the short way
      const cur = bearingRef.current;
      const diff = ((h - cur) % 360 + 540) % 360 - 180;
      bearingRef.current = cur + diff;
      setBearing(bearingRef.current);
    }
    const arrow = me.current.getElement()?.querySelector('svg');
    if (arrow) arrow.style.transform = `rotate(${bearingRef.current}deg)`;
    if (follow && trackingRef.current) m.setView([position.lat, position.lon], Math.max(m.getZoom(), 17));
  }, [position, follow, tracking]);

  useEffect(() => { if (follow) setTracking(true); }, [follow]);

  const rotate = headingUp && follow && tracking;
  useEffect(() => { const t = setTimeout(() => map.current?.invalidateSize(), 50); return () => clearTimeout(t); }, [rotate]);

  return <div className="navigation-map relative h-full w-full overflow-hidden">
    <div ref={el} className="absolute"
      style={rotate
        ? { width: '150vmax', height: '150vmax', left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${-bearing}deg)`, transition: 'transform 0.6s linear' }
        : { inset: 0 }} />
    <div className="absolute right-3 top-1/2 z-[450] flex -translate-y-1/2 flex-col gap-2 sm:right-5">
      <Button variant="outline" size="icon" className="navigation-shadow h-12 w-12 rounded-full border-0 bg-navigation-surface text-navigation-foreground" aria-label="Aumentar mapa" title="Aumentar mapa" onClick={() => map.current?.zoomIn()}><Plus /></Button>
      <Button variant="outline" size="icon" className="navigation-shadow h-12 w-12 rounded-full border-0 bg-navigation-surface text-navigation-foreground" aria-label="Diminuir mapa" title="Diminuir mapa" onClick={() => map.current?.zoomOut()}><Minus /></Button>
      <Button variant="outline" size="icon" className="navigation-shadow h-12 w-12 rounded-full border-0 bg-navigation-surface text-navigation-foreground" aria-label="Ver percurso inteiro" title="Ver percurso inteiro" onClick={() => { setTracking(false); if (bounds.current) map.current?.fitBounds(bounds.current, { paddingTopLeft: [30, 150], paddingBottomRight: [70, 230] }); }}><Maximize /></Button>
      <Button variant="outline" size="icon" className="navigation-shadow h-12 w-12 rounded-full border-0 bg-navigation-surface text-navigation-foreground" aria-label={headingUp ? 'Mapa virando com o ônibus' : 'Norte para cima'} title={headingUp ? 'Mapa virando com o ônibus (toque para norte para cima)' : 'Norte para cima (toque para virar com o ônibus)'} aria-pressed={headingUp} onClick={() => setHeadingUp((v) => !v)}><Compass style={{ transform: `rotate(${rotate ? -bearing - 45 : -45}deg)`, transition: 'transform 0.6s linear' }} /></Button>
      <Button variant="outline" size="icon" className="navigation-shadow h-12 w-12 rounded-full border-0 bg-navigation-accent text-navigation-accent-foreground" aria-label="Centralizar localização" title="Centralizar localização" disabled={!position} onClick={() => setTracking(true)}><LocateFixed /></Button>
    </div>
  </div>;
}
