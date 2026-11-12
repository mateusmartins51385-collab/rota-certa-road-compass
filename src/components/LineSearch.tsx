import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { BusFront, Search, LoaderCircle, ArrowUpRight, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchTransitLines } from '@/lib/transit.functions';
import type { TransitLine } from '@/lib/transit';
import type { Itinerary } from '@/lib/itinerary';

export function LineSearch({ onSelect, disabled }: { onSelect: (it: Itinerary) => void; disabled: boolean }) {
  const search = useServerFn(searchTransitLines);
  const [number, setNumber] = useState('');
  const [lines, setLines] = useState<TransitLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || disabled) return;
    setBusy(true); setMessage('Pesquisando linha…'); setError(false); setLines([]);
    try {
      const result = await search({ data: { number } });
      setLines(result.lines);
      setMessage(result.lines.length ? '' : result.expired
        ? 'Os dados desta linha venceram. Use um PDF atualizado enquanto o catálogo é renovado.'
        : 'Linha não encontrada no catálogo oficial disponível. As linhas municipais de Guarulhos ainda precisam do PDF.');
    } catch {
      setError(true); setMessage('Não foi possível pesquisar. Confira sua conexão e tente novamente.');
    } finally { setBusy(false); }
  }

  async function select(line: TransitLine) {
    setBusy(true); setError(false); setMessage('Carregando ida e volta…');
    try {
      const res = await fetch(`/transit/${encodeURIComponent(line.id)}.json`);
      if (!res.ok) throw new Error('Unavailable itinerary');
      const it: Itinerary = await res.json();
      if (!it.directions?.length || it.source?.id !== line.id || it.directions.some((d) =>
        d.stops.length < 2 || !d.line || d.line.length < 2 || d.stops.some((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lon)))) {
        throw new Error('Incomplete itinerary');
      }
      onSelect(it);
      setLines([]); setMessage('Itinerário carregado. Escolha o sentido abaixo.');
    } catch {
      setError(true); setMessage('Não foi possível carregar este itinerário. Tente novamente ou envie o PDF.');
    } finally { setBusy(false); }
  }

  return <section aria-label="Pesquisa por linha">
    <form onSubmit={submit}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="line-number" className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Número da linha</label>
        <span className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><Radio className="h-3 w-3 text-primary" /> Catálogo oficial</span>
      </div>
      <div className="hud-panel hud-corners flex gap-2 rounded-2xl p-2">
        <Input id="line-number" className="h-12 min-w-0 flex-1 border-0 bg-transparent px-3 font-display text-lg font-semibold tracking-wider shadow-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal focus-visible:ring-0" value={number} maxLength={16}
          placeholder="Ex.: 003, 011 ou 1016-10" autoComplete="off" disabled={busy || disabled}
          onChange={(e) => { setNumber(e.target.value); setLines([]); setMessage(''); }} required pattern="[-0-9A-Za-z ]+" />
        <Button type="submit" className="glow-primary h-12 rounded-xl px-5 font-display text-xs font-bold uppercase tracking-wider" disabled={busy || disabled || !number.trim()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Search />} Buscar
        </Button>
      </div>
    </form>
    <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
      <p>São Paulo · SPTrans / Metropolitanas · ARTESP (antiga EMTU)</p>
      <p>Municipais de Guarulhos: importação por PDF.</p>
    </div>
    {message && <p role={error ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-3 text-sm leading-relaxed ${error ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-border bg-card/60 text-muted-foreground'}`}>{message}</p>}
    {!!lines.length && <ul className="mt-4 space-y-2" aria-label="Linhas encontradas">
      {lines.map((line) => <li key={line.id}>
        <Button variant="outline" className="h-auto w-full justify-start gap-3 whitespace-normal rounded-xl border-border bg-card/70 p-4 text-left hover:border-primary/70 hover:bg-accent/60" disabled={busy || disabled} onClick={() => select(line)}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10"><BusFront className="text-primary" /></span>
          <span className="min-w-0 flex-1">
            <strong className="block font-display tracking-wide">{line.number} <span className="text-muted-foreground">//</span> {line.provider === 'sptrans' ? 'SPTrans' : 'ARTESP / EMTU'}</strong>
            <span className="mt-1 block text-sm font-normal">{line.name}</span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{line.hasReturn ? 'Ida e volta' : 'Somente ida disponível'} · {line.directionCount} sentido(s)</span>
          </span>
          <ArrowUpRight className="shrink-0 text-primary" />
        </Button>
      </li>)}
    </ul>}
  </section>;
}
