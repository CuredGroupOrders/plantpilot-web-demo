import { create } from "zustand";

type UIStore = {
  showHistory: boolean;
  toggleHistory: () => void;
  hideHistory: () => void;
};

export const useUi = create<UIStore>((set) => ({
  showHistory: false,
  toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),
  hideHistory: () => set({ showHistory: false }),
}));

