import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRightLeft, BusFront, FileText, LocateFixed, MapPin, Navigation, Route as RouteIcon, Satellite, ShieldCheck, Volume2, VolumeX } from "lucide-react";
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
import { LineSearch } from '@/components/LineSearch';
import { directionName, officialRoute } from '@/lib/transit';

const RouteMap = lazy(() => import("@/components/RouteMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rota Motorista — Buscar linhas de São Paulo e metropolitanas" },
      { name: "description", content: "Pesquise linhas da SPTrans e metropolitanas por número, carregue o itinerário oficial ou importe seu PDF de ida e volta." },
      { property: "og:title", content: "Rota Motorista — Busca de linhas e GPS de ônibus" },
      { property: "og:description", content: "Busque itinerários oficiais de São Paulo e linhas metropolitanas de Guarulhos pelo número da linha." },
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
    <main className="app-shell min-h-screen bg-background text-foreground">
      <div className="relative z-[1] mx-auto w-full max-w-xl px-5 pb-12 pt-6 sm:px-6 sm:pt-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="brand-mark grid h-11 w-11 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
              <RouteIcon className="h-6 w-6" />
            </span>
            <div>
              <div className="font-display text-lg font-semibold uppercase tracking-[0.08em]">Rota<span className="text-primary">//</span>Motorista</div>
              <div className="font-display text-[9px] uppercase tracking-[0.24em] text-muted-foreground">Sistema de navegação</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="status-dot" /> Online
          </div>
        </header>

        <section className="mt-10 sm:mt-12" aria-labelledby="hero-title">
          <div className="flex items-center gap-3 font-display text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            <Satellite className="h-4 w-4" /> Central de navegação <span className="hero-rule" />
          </div>
          <h1 id="hero-title" className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
            Sua rota.<span className="text-glow block text-primary">No seu comando.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Localize o itinerário oficial e navegue por cada parada, com ida e volta no mesmo percurso da linha.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="search-step">
          <div className="mb-3 flex items-center gap-2 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="text-primary">01</span><span className="h-px w-4 bg-border" /><span id="search-step">Localizar linha</span>
          </div>
          <LineSearch disabled={loading} onSelect={(it) => {
            saveItinerary(it);
            setItinerary(it);
            setDir(0);
            setMsg(null);
          }} />
        </section>

        <section className="mt-8 border-t border-border/70 pt-6" aria-labelledby="pdf-step">
          <div className="mb-3 flex items-center gap-2 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="text-primary">02</span><span className="h-px w-4 bg-border" /><span id="pdf-step">Itinerário local</span>
          </div>
          <label className="hud-panel group flex cursor-pointer items-center gap-4 rounded-2xl border-dashed p-4 transition hover:border-primary/70">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary transition group-hover:bg-primary/15">
              <FileText className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block font-display text-sm font-semibold uppercase tracking-wide">{loading ? "Lendo arquivo…" : "Importar itinerário em PDF"}</strong>
              <span className="mt-1 block text-xs text-muted-foreground">Processado apenas neste aparelho</span>
            </span>
            <span className="font-display text-lg text-primary">+</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              hidden
              disabled={loading}
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          {msg && (
            <p role="status" className={`mt-3 rounded-xl border p-3 text-sm ${msg.error ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border bg-card/60 text-muted-foreground"}`}>
              {msg.text}
            </p>
          )}
        </section>

        {itinerary && (
          <section className="mt-8 border-t border-border/70 pt-6" aria-labelledby="route-step">
            <div className="mb-4 flex items-center gap-2 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="text-primary">03</span><span className="h-px w-4 bg-border" /><span id="route-step">Rota carregada</span>
            </div>
            <div className="hud-panel hud-corners rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><BusFront className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <div className="font-display text-[9px] uppercase tracking-[0.18em] text-primary">Percurso pronto</div>
                  <h2 className="mt-1 font-display text-xl font-semibold leading-tight">{itinerary.title}</h2>
                </div>
              </div>
              {itinerary.source && <p className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                Fonte: <a href={itinerary.source.source} target="_blank" rel="noreferrer" className="text-foreground underline decoration-primary/50 underline-offset-2">{itinerary.source.provider === 'sptrans' ? 'SPTrans' : 'ARTESP / EMTU'}</a>
                {' · '}Importado em {itinerary.source.importedAt.split('-').reverse().join('/')}
                {' · '}Válido até {itinerary.source.validUntil.replace(/^(\d{4})(\d{2})(\d{2})$/, '$3/$2/$1')}
              </p>}
            </div>
            <div className="mt-3 space-y-3">
              {itinerary.directions.map((d, i) => (
                <Button variant="outline"
                  key={i}
                  onClick={() => setDir(i)}
                  aria-pressed={dir === i}
                  className={`relative block h-auto w-full overflow-hidden whitespace-normal rounded-xl border p-4 text-left transition ${
                    dir === i ? "border-primary/70 bg-primary/10" : "border-border bg-card/50 hover:border-primary/40"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                    <span>{directionName(d.kind, i)} · {d.stops.length} paradas</span>
                    {dir === i && <span className="status-dot shrink-0" />}
                  </span>
                  <strong className="mt-2 block font-display text-base font-semibold">{d.label}</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    De {shortName(d.stops[0]!.name)} até {shortName(d.stops.at(-1)!.name)}
                  </span>
                </Button>
              ))}
            </div>
            <Button size="lg" className="glow-primary mt-5 h-14 w-full rounded-xl font-display text-sm font-bold uppercase tracking-[0.12em]" onClick={() => setScreen("nav")}>
              <Navigation /> Iniciar navegação
            </Button>
          </section>
        )}

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-border/60 bg-card/35 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>Prepare a viagem com o ônibus parado. Durante a condução, não manuseie o celular.</p>
        </div>
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
    const shape = officialRoute(itinerary, dir);
    if (shape) {
      const distance = shape.reduce((total, point, index) => {
        const prev = shape[index - 1];
        return prev ? total + distanceMeters({ lat: prev[0], lon: prev[1] }, { lat: point[0], lon: point[1] }) : total;
      }, 0);
      setRoute({ line: shape, distance, straightLegs: 0 });
      setStatus("");
      return;
    }
    const cacheKey = `rota-motorista:route:v2:${JSON.stringify(stops.map((s) => [s.lat, s.lon]))}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const saved = JSON.parse(cached) as RouteResult;
        if (Array.isArray(saved.line) && saved.line.length >= 2 && Number.isFinite(saved.distance)) {
          setRoute(saved);
          setStatus("");
          return;
        }
      }
    } catch { /* Invalid or unavailable cache: rebuild from source stops. */ }
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

  const distNext = !finished && pos ? distanceMeters(pos, next) : null;
  const after = stops[active + 1];

  return (
    <main className="navigation-shell fixed inset-0 overflow-hidden bg-background">
      <div className="absolute inset-0">
        <ClientOnly fallback={<div className="h-full bg-muted" />}>
          <Suspense fallback={<div className="h-full bg-muted" />}>
            <RouteMap stops={stops} line={route?.line ?? []} activeIndex={active} position={pos} follow={gps && !!pos} />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="navigation-top pointer-events-none absolute inset-x-0 top-0 z-[600] space-y-2 px-3">
        <div className="navigation-shadow pointer-events-auto overflow-hidden rounded-2xl bg-navigation-panel text-navigation-panel-foreground">
          <div className="flex items-center gap-3 p-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-navigation-accent text-navigation-accent-foreground">
              {finished ? <MapPin className="h-8 w-8" /> : <Navigation className="h-8 w-8" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-3xl font-black leading-none">
                {finished ? "Fim" : distNext !== null ? fmt(distNext) : `Parada ${active + 1}`}
              </div>
              <div className="mt-1 line-clamp-2 text-base font-semibold leading-tight">
                {finished ? "Itinerário concluído" : shortName(next.name)}
              </div>
            </div>
          </div>
          {!finished && after && (
            <div className="border-t border-navigation-panel-foreground/15 px-3 py-1.5 text-xs opacity-80 truncate">
              Depois: {shortName(after.name)}
            </div>
          )}
        </div>
        {offRoute && (
          <div className="navigation-shadow rounded-xl bg-destructive p-3 text-center font-bold text-destructive-foreground">
            Fora do percurso da linha
          </div>
        )}
        {status && (
          <div className="navigation-shadow rounded-xl bg-navigation-surface p-2 text-center text-sm text-navigation-foreground">{status}</div>
        )}
      </div>

      <div className="navigation-bottom absolute inset-x-0 bottom-0 z-[600] px-3">
        <div className="navigation-shadow rounded-3xl bg-navigation-surface p-3 text-navigation-foreground">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-12 w-12 shrink-0 rounded-full" onClick={onBack} aria-label="Voltar">
              <ArrowLeft />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-lg font-black leading-tight">
                {finished ? "Concluído" : `${active + 1} de ${stops.length}`}
                {route && <span className="font-semibold opacity-60"> · {fmt(route.distance)}</span>}
              </div>
              <div className="truncate text-xs opacity-70">
                {directionName(direction.kind, dir)} · {direction.label}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-12 w-12 shrink-0 rounded-full" onClick={() => setVoice((v) => !v)} aria-label="Voz">
              {voice ? <Volume2 /> : <VolumeX />}
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            {finished && other !== null ? (
              <Button size="lg" className="h-14 flex-1 rounded-2xl text-base font-bold" onClick={() => onDir(other)}>
                <ArrowRightLeft /> Começar {directionName(itinerary.directions[other]?.kind, other).toLowerCase()}
              </Button>
            ) : (
              <Button size="lg" variant={gps ? "secondary" : "default"} className="h-14 flex-1 rounded-2xl text-base font-bold" onClick={toggleGps}>
                <LocateFixed /> {gps ? "Parar GPS" : "Iniciar GPS"}
              </Button>
            )}
            {other !== null && !finished && (
              <Button size="lg" variant="outline" className="h-14 rounded-2xl" onClick={() => onDir(other)} aria-label="Trocar sentido">
                <ArrowRightLeft />
              </Button>
            )}
          </div>
          {!finished && (
            <div className="mt-2 flex justify-between px-2 text-sm">
              <button className="opacity-70 underline disabled:opacity-30" disabled={active === 0} onClick={() => setActive((a) => Math.max(0, a - 1))}>
                Parada anterior
              </button>
              <button className="opacity-70 underline" onClick={() => setActive((a) => a + 1)}>
                Pular parada
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
