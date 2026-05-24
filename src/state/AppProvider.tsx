// src/state/AppProvider.tsx
import { useReducer } from "react";
import type { ReactNode } from "react";
import { Ctx, reduce, initial } from "./app";

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initial);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

