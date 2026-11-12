import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Lets the driver put the app on the phone home screen.
 * Android/Chrome: uses the native install prompt when the browser offers one,
 * otherwise shows the manual menu steps.
 * iPhone (Safari): shows the manual "Adicionar à Tela de Início" steps.
 */
export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    const ua = window.navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setIos(isIos);
    setAndroid(/Android/.test(ua));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as PromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  if (installed) {
    return (
      <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Smartphone className="h-3.5 w-3.5 text-primary" />
        App instalado neste aparelho.
      </p>
    );
  }

  if (!promptEvent && !ios && !android) return null;

  return (
    <div className="mt-3">
      {promptEvent ? (
        <button
          type="button"
          onClick={install}
          className="hud-panel flex w-full items-center gap-3 rounded-2xl border-dashed p-3 text-left transition hover:border-primary/70"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block font-display text-xs font-semibold uppercase tracking-wide">
              Instalar no celular
            </strong>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Abre em tela cheia, com ícone na área inicial
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowSteps((v) => !v)}
          className="hud-panel flex w-full items-center gap-3 rounded-2xl border-dashed p-3 text-left transition hover:border-primary/70"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block font-display text-xs font-semibold uppercase tracking-wide">
              Instalar no celular
            </strong>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {showSteps ? "Ocultar passos" : "Ver os 3 passos para colocar o ícone"}
            </span>
          </span>
        </button>
      )}

      {showSteps && !promptEvent && (
        <ol className="mt-2 space-y-1.5 rounded-xl border border-border bg-card/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {ios ? (
            <>
              <li>1. Toque no botão Compartilhar do Safari (quadrado com seta para cima).</li>
              <li>2. Escolha "Adicionar à Tela de Início".</li>
              <li>3. Toque em "Adicionar". O app aparece com o ícone verde.</li>
            </>
          ) : (
            <>
              <li>1. Toque no menu de 3 pontinhos do navegador (Chrome).</li>
              <li>2. Escolha "Adicionar à Tela de Início" ou "Instalar aplicativo".</li>
              <li>3. Confirme em "Adicionar". O app aparece com o ícone verde.</li>
            </>
          )}
        </ol>
      )}
    </div>
  );
}
