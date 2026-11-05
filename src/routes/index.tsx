import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRightLeft, FileText, LocateFixed, MapPin, Navigation, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  distanceMeters,
  loadItinerary,
  parseItinerary,
  saveItinerary,
  shortName,
  type Itinerary,
} from "@/lib/itinerary";
import { buildRoute, type RouteResult } from "@/lib/routing";

const RouteMap = lazy(() => import("@/components/RouteMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rota Motorista — GPS de itinerário para ônibus" },
      { name: "description", content: "Importe o itinerário em PDF com ida e volta e siga o percurso exato da linha no GPS." },
      { property: "og:title", content: "Rota Motorista — GPS de itinerário para ônibus" },
      { property: "og:description", content: "Importe o itinerário em PDF com ida e volta e siga o percurso exato da linha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function fmt(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`;
}

function distToLine(p: { lat: number; lon: number }, line: [number, number][]) {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111320;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i]![1] * k, ay = line[i]![0] * 110540;
    const bx = line[i + 1]![1] * k, by = line[i + 1]![0] * 110540;
    const px = p.lon * k, py = p.lat * 110540;
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function Index() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [dir, setDir] = useState(0);
  const [screen, setScreen] = useState<"setup" | "nav">("setup");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setItinerary(loadItinerary()), []);

  async function onFile(file: File) {
    setLoading(true);
    setMsg({ text: "Lendo o PDF neste aparelho…" });
    try {
      const { extractPdfLines } = await import("@/lib/pdf");
      const parsed = parseItinerary(await extractPdfLines(file));
      if (!parsed.directions.length) {
        setMsg({ text: "Não encontrei paradas com latitude e longitude neste PDF.", error: true });
        return;
      }
      saveItinerary(parsed);
      setItinerary(parsed);
      setDir(0);
      setMsg({ text: `${parsed.directions.length} sentido(s) encontrados. Confira e escolha por onde começar.` });
    } catch (e) {
      console.error(e);
      setMsg({ text: "Não foi possível abrir este PDF.", error: true });
    } finally {
      setLoading(false);
    }
  }

  if (screen === "nav" && itinerary) {
    return (
      <Navigator
        itinerary={itinerary}
        dir={dir}
        onDir={setDir}
        onBack={() => setScreen("setup")}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-5 pb-16 pt-8">
        <header className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-display text-xl text-primary-foreground">R</span>
          <span className="font-display text-xl tracking-tight">Rota Motorista</span>
        </header>

        <h1 className="font-display text-4xl leading-tight">
          O percurso da linha,<br />
          <span className="text-primary">exatamente como é.</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          Envie o PDF do itinerário. O app separa ida e volta e liga as paradas na ordem oficial, sem atalhos.
        </p>

        <label className="mt-8 flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-5 transition hover:border-primary">
          <FileText className="h-8 w-8 shrink-0 text-primary" />
          <span className="flex-1">
            <strong className="block">{loading ? "Lendo…" : "Escolher itinerário em PDF"}</strong>
            <span className="text-sm text-muted-foreground">O arquivo não sai do seu aparelho</span>
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            hidden
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
        {msg && (
          <p role="status" className={`mt-3 text-sm ${msg.error ? "text-destructive" : "text-muted-foreground"}`}>
            {msg.text}
          </p>
        )}

        {itinerary && (
          <section className="mt-8">
            <h2 className="font-display text-2xl">{itinerary.title}</h2>
            <div className="mt-4 space-y-3">
              {itinerary.directions.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setDir(i)}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                    dir === i ? "border-primary bg-accent" : "border-border bg-card"
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">
                    {i === 0 ? "Ida" : i === 1 ? "Volta" : `Sentido ${i + 1}`} · {d.stops.length} paradas
                  </span>
                  <strong className="mt-1 block">{d.label}</strong>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    De {shortName(d.stops[0]!.name)} até {shortName(d.stops.at(-1)!.name)}
                  </span>
                </button>
              ))}
            </div>
            <Button size="lg" className="mt-6 h-14 w-full text-lg" onClick={() => setScreen("nav")}>
              <Navigation /> Abrir no mapa
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              Prepare a viagem com o ônibus parado. Durante a condução, não manuseie o celular.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function Navigator({
  itinerary,
  dir,
  onDir,
  onBack,
}: {
  itinerary: Itinerary;
  dir: number;
  onDir: (d: number) => void;
  onBack: () => void;
}) {
  const direction = itinerary.directions[dir] ?? itinerary.directions[0]!;
  const stops = direction.stops;
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [status, setStatus] = useState("Traçando percurso…");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ lat: number; lon: number; heading: number | null } | null>(null);
  const [gps, setGps] = useState(false);
  const [voice, setVoice] = useState(false);
  const watch = useRef<number | null>(null);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    let cancel = false;
    setRoute(null);
    setActive(0);
    const cacheKey = `rota-motorista:route:${itinerary.title}:${direction.label}:${stops.length}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setRoute(JSON.parse(cached));
      setStatus("");
      return;
    }
    buildRoute(stops, (m) => !cancel && setStatus(m)).then((r) => {
      if (cancel) return;
      setRoute(r);
      setStatus("");
      try {
        localStorage.setItem(cacheKey, JSON.stringify(r));
      } catch {
        /* storage full */
      }
    });
    return () => {
      cancel = true;
    };
  }, [dir]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
  }, []);

  // Advance through stops as the bus passes them (also skips stops passed without stopping).
  useEffect(() => {
    if (!pos) return;
    let next = active;
    for (let i = active; i < Math.min(stops.length, active + 4); i++) {
      if (distanceMeters(pos, stops[i]!) < 45) next = i + 1;
    }
    if (next !== active) {
      setActive(next);
      if (voiceRef.current) {
        speak(next >= stops.length ? "Fim do itinerário." : `Próxima parada: ${shortName(stops[next]!.name)}`);
      }
    }
  }, [pos]); // eslint-disable-line react-hooks/exhaustive-deps

  const offRoute = useMemo(() => (pos && route ? distToLine(pos, route.line) > 80 : false), [pos, route]);
  const prevOff = useRef(false);
  useEffect(() => {
    if (offRoute && !prevOff.current && voiceRef.current) speak("Atenção, você saiu do percurso da linha.");
    prevOff.current = offRoute;
  }, [offRoute]);

  function toggleGps() {
    if (gps) {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
      setGps(false);
      return;
    }
    if (!("geolocation" in navigator)) return setStatus("Este aparelho não tem GPS disponível.");
    setGps(true);
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude, heading: p.coords.heading });
        setStatus("");
      },
      () => {
        setStatus("Permita o acesso à localização para usar o GPS.");
        setGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  }

  const finished = active >= stops.length;
  const next = stops[Math.min(active, stops.length - 1)]!;
  const other = itinerary.directions.length > 1 ? (dir + 1) % itinerary.directions.length : null;

  return (
    <main className="fixed inset-0 flex flex-col bg-background">
      <div className="z-10 flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            {dir === 0 ? "Ida" : "Volta"}
          </span>
          <strong className="block truncate text-sm">{direction.label}</strong>
        </div>
        {other !== null && (
          <Button variant="outline" size="sm" onClick={() => onDir(other)}>
            <ArrowRightLeft /> {other === 0 ? "Ida" : "Volta"}
          </Button>
        )}
      </div>

      <div className="relative flex-1">
        <ClientOnly fallback={<div className="h-full bg-muted" />}>
          <Suspense fallback={<div className="h-full bg-muted" />}>
            <RouteMap stops={stops} line={route?.line ?? []} activeIndex={active} position={pos} follow={gps && !!pos} />
          </Suspense>
        </ClientOnly>
        {offRoute && (
          <div className="absolute inset-x-3 top-3 z-[500] rounded-xl bg-destructive p-3 text-center font-bold text-destructive-foreground shadow-lg">
            Fora do percurso da linha
          </div>
        )}
        {status && (
          <div className="absolute inset-x-3 top-3 z-[400] rounded-xl bg-card/95 p-3 text-center text-sm shadow">{status}</div>
        )}
      </div>

      <div className="z-10 space-y-3 border-t border-border bg-card p-4 pb-6">
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <small className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {finished ? "Itinerário concluído" : `Próxima parada · ${active + 1} de ${stops.length}`}
            </small>
            <strong className="block truncate text-lg">
              {finished ? "Fim da linha" : shortName(next.name)}
            </strong>
            {!finished && pos && (
              <span className="text-sm text-muted-foreground">a {fmt(distanceMeters(pos, next))}</span>
            )}
          </div>
        </div>
        {route && (
          <p className="text-xs text-muted-foreground">
            Percurso: {fmt(route.distance)}
            {route.straightLegs > 0 &&
              ` · ${route.straightLegs} trecho(s) em linha reta, onde o mapa sugeriria desvio`}
          </p>
        )}
        <div className="flex gap-2">
          {finished && other !== null ? (
            <Button size="lg" className="h-14 flex-1 text-base" onClick={() => onDir(other)}>
              <ArrowRightLeft /> Começar {other === 0 ? "ida" : "volta"}
            </Button>
          ) : (
            <Button size="lg" variant={gps ? "secondary" : "default"} className="h-14 flex-1 text-base" onClick={toggleGps}>
              <LocateFixed /> {gps ? "Parar GPS" : "Iniciar GPS"}
            </Button>
          )}
          <Button size="lg" variant="outline" className="h-14 w-14" onClick={() => setVoice((v) => !v)} aria-label="Voz">
            {voice ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
        {!finished && (
          <div className="flex justify-between text-sm">
            <button className="text-muted-foreground underline" disabled={active === 0} onClick={() => setActive((a) => Math.max(0, a - 1))}>
              Parada anterior
            </button>
            <button className="text-muted-foreground underline" onClick={() => setActive((a) => a + 1)}>
              Pular parada
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
