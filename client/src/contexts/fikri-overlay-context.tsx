import { createContext, useContext, useState } from "react";

type FikriOverlayContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const FikriOverlayContext = createContext<FikriOverlayContextType | undefined>(undefined);

export function FikriOverlayProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <FikriOverlayContext.Provider value={{ open, setOpen }}>
      {children}
    </FikriOverlayContext.Provider>
  );
}

export function useFikriOverlay() {
  const ctx = useContext(FikriOverlayContext);
  if (!ctx) throw new Error("useFikriOverlay must be used inside FikriOverlayProvider");
  return ctx;
}
