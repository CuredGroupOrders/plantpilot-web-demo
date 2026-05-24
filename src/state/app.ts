import { createContext, useContext } from "react";
import type { Dispatch } from "react";

export type Gate = "ENV" | "ROOT" | "IRR";
export type Stage = "veg" | "flower";
export type Intake = { stage: Stage; medium: "coco" | "rockwool" | "soil" | "other" };

export type State = { intake: Intake; draftIntake?: Intake; isEditing: boolean };

export type Action =
  | { type: "START_EDIT" }
  | { type: "CANCEL_EDIT" }
  | { type: "SET_DRAFT"; patch: Partial<Intake> }
  | { type: "COMMIT_EDIT" }
  | { type: "RESET_ALL"; next: State };

export const initial: State = { intake: { stage: "veg", medium: "coco" }, isEditing: false };

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "START_EDIT": return { ...s, isEditing: true, draftIntake: { ...s.intake } };
    case "CANCEL_EDIT": return { ...s, isEditing: false, draftIntake: undefined };
    case "SET_DRAFT": return s.draftIntake ? { ...s, draftIntake: { ...s.draftIntake, ...a.patch } } : s;
    case "COMMIT_EDIT": return s.draftIntake ? { intake: s.draftIntake, draftIntake: undefined, isEditing: false } : s;
    case "RESET_ALL": return a.next;
    default: return s;
  }
}

export const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

