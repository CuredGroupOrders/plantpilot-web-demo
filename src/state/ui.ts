import { create } from "zustand";

type UIStore = {
  showHistory: boolean;
  toggleHistory: () => void;
  hideHistory: () => void;
  showIntake: boolean;
  showSymptoms: boolean;
  openIntake: () => void;
  closeIntake: () => void;
  openSymptoms: () => void;
  closeSymptoms: () => void;
};

export const useUi = create<UIStore>((set) => ({
  showHistory: false,
  toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),
  hideHistory: () => set({ showHistory: false }),
  showIntake: false,
  showSymptoms: false,
  openIntake: () => set({ showIntake: true }),
  closeIntake: () => set({ showIntake: false }),
  openSymptoms: () => set({ showSymptoms: true }),
  closeSymptoms: () => set({ showSymptoms: false }),
}));

