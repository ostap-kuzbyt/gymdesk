import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CommandPalette } from "./command-palette";

interface PaletteContextValue {
  open: () => void;
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={isOpen} onOpenChange={setIsOpen} />
    </PaletteContext.Provider>
  );
}

export function usePalette(): PaletteContextValue {
  const context = useContext(PaletteContext);
  if (!context) throw new Error("usePalette must be used inside a CommandPaletteProvider");
  return context;
}
