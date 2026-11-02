import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const GIGACHAD_GIF_URL = "https://media1.tenor.com/m/UiRm8ob_ws4AAAAd/giga-gigachad.gif";
export const GIGACHAD_GIF_MS = 5900;
const FINISH_MARGIN_MS = 150;
const LOAD_TIMEOUT_MS = 15000;

export function GigachadGif({ onFinished }: { onFinished: () => void }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const wait = loaded ? GIGACHAD_GIF_MS + FINISH_MARGIN_MS : LOAD_TIMEOUT_MS;
    const timer = setTimeout(onFinished, wait);
    return () => clearTimeout(timer);
  }, [loaded, onFinished]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gigachad"
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 backdrop-blur-sm"
    >
      <img
        alt="Gigachad"
        src={GIGACHAD_GIF_URL}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={onFinished}
        className={`animate-pop-in h-[90vh] w-[94vw] rounded-2xl object-contain ${loaded ? "" : "invisible"}`}
      />
      {/* <p className="pointer-events-none absolute bottom-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
        GIF via Tenor
      </p> */}
    </div>,
    document.body,
  );
}
