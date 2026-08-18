"use client";

import { useEffect, useState } from "react";

// Typing for the Chrome beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPwaButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already running in standalone (installed) mode
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const safari = /safari/i.test(ua) && !/chrome/i.test(ua);
    setIsIos(ios && safari);

    // Android / Chrome — capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Don't render if already installed
  if (isInstalled) return null;

  // Don't render if neither Android prompt nor iOS available
  if (!installPrompt && !isIos) return null;

  const handleClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstallPrompt(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 active:scale-[0.98]"
      >
        <span className="text-lg">📱</span>
        Installa App su schermata Home
      </button>

      {/* iOS instruction modal */}
      {showIosModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowIosModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl mb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-slate-900 mb-3 text-center">
              📱 Installa su iPhone / iPad
            </h2>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">1</span>
                <span>Tocca il tasto <strong>Condividi</strong> in basso nel browser (l&apos;icona con la freccia verso l&apos;alto ↑).</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">2</span>
                <span>Scorri in basso e seleziona <strong>&ldquo;Aggiungi a schermata Home&rdquo;</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">3</span>
                <span>Tocca <strong>Aggiungi</strong> in alto a destra. L&apos;app apparirà sulla schermata Home.</span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </>
  );
}
