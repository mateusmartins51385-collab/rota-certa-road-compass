import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { BusFront, Search, LoaderCircle, ArrowRight } from 'lucide-react';
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

  return <section className="mt-6" aria-label="Pesquisa por linha">
    <form onSubmit={submit}>
      <label htmlFor="line-number" className="mb-2 block text-sm font-bold">Número da linha</label>
      <div className="flex gap-2">
        <Input id="line-number" className="h-12 min-w-0 flex-1" value={number} maxLength={16}
          placeholder="Ex.: 003, 011 ou 1016-10" autoComplete="off" disabled={busy || disabled}
          onChange={(e) => { setNumber(e.target.value); setLines([]); setMessage(''); }} required pattern="[0-9a-zA-Z -]+" />
        <Button type="submit" className="h-12" disabled={busy || disabled || !number.trim()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Search />} Buscar
        </Button>
      </div>
    </form>
    <p className="mt-2 text-xs text-muted-foreground">São Paulo · SPTrans / Metropolitanas · ARTESP (antiga EMTU)</p>
    <p className="mt-1 text-xs text-muted-foreground">Municipais de Guarulhos: importação por PDF.</p>
    {message && <p role={error ? 'alert' : 'status'} className={`mt-3 text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>}
    {!!lines.length && <ul className="mt-4 space-y-2" aria-label="Linhas encontradas">
      {lines.map((line) => <li key={line.id}>
        <Button variant="outline" className="h-auto w-full justify-start gap-3 whitespace-normal p-4 text-left" disabled={busy || disabled} onClick={() => select(line)}>
          <BusFront className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <strong className="block">{line.number} · {line.provider === 'sptrans' ? 'SPTrans' : 'ARTESP / EMTU'}</strong>
            <span className="mt-1 block text-sm font-normal">{line.name}</span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{line.hasReturn ? 'Ida e volta' : 'Somente ida disponível'} · {line.directionCount} sentido(s)</span>
          </span>
          <ArrowRight className="shrink-0" />
        </Button>
      </li>)}
    </ul>}
  </section>;
}