"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface TopbarSlotContextValue {
  left: ReactNode | null;
  setLeft: (node: ReactNode | null) => void;
}

const TopbarSlotContext = createContext<TopbarSlotContextValue | null>(null);

export function TopbarSlotProvider({ children }: { children: ReactNode }) {
  const [left, setLeft] = useState<ReactNode | null>(null);
  const value = useMemo(() => ({ left, setLeft }), [left]);
  return (
    <TopbarSlotContext.Provider value={value}>
      {children}
    </TopbarSlotContext.Provider>
  );
}

export function useTopbarSlot(): { left: ReactNode | null } {
  const ctx = useContext(TopbarSlotContext);
  if (!ctx) return { left: null };
  return { left: ctx.left };
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Last-mount wins if multiple consumers set the slot simultaneously.
export function useSetTopbarLeft(node: ReactNode | null) {
  const ctx = useContext(TopbarSlotContext);
  useIsomorphicLayoutEffect(() => {
    if (!ctx) return;
    ctx.setLeft(node);
    return () => ctx.setLeft(null);
  }, [ctx, node]);
}
