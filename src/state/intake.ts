import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type StagePhase =
  | "early veg"
  | "late veg"
  | "early bloom"
  | "mid bloom"
  | "late bloom"
  | "flush";

export const STAGE_PHASES: StagePhase[] = [
  "early veg",
  "late veg",
  "early bloom",
  "mid bloom",
  "late bloom",
  "flush",
];

export type Medium = "coco" | "rockwool" | "soil" | "dwc";
export const MEDIA: Medium[] = ["coco", "rockwool", "soil", "dwc"];

export interface FSIntake {
  stagePhase: StagePhase;
  medium: Medium;
  containerSize?: number;
  co2Mode?: string;
  [k: string]: unknown;
}

export interface FSIntakeStore {
  saved: FSIntake;
  setSaved: <K extends keyof FSIntake>(key: K, value: FSIntake[K]) => void;
  setMany: (patch: Partial<FSIntake>) => void;
  reset: () => void;
}

const DEFAULT_SAVED: FSIntake = {
  stagePhase: "early veg",
  medium: "coco",
  co2Mode: "ambient",
  containerSize: 1,
};

export const useIntake = create<FSIntakeStore>()(
  persist(
    (set) => ({
      saved: DEFAULT_SAVED,
      setSaved: (key, value) =>
        set((state) => ({ saved: { ...state.saved, [key]: value } })),
      setMany: (patch) =>
        set((state) => ({ saved: { ...state.saved, ...patch } })),
      reset: () => set({ saved: DEFAULT_SAVED }),
    }),
    {
      name: "fs-intake-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => {
        const incoming: any = persistedState;
        if (version < 2 && incoming) {
          const saved = incoming.saved ?? incoming;
          if (saved) {
            if (saved.stage && !saved.stagePhase) {
              const map: Record<string, StagePhase> = {
                veg: "early veg",
                flower: "early bloom",
              };
              const incomingStage: string = saved.stage;
              saved.stagePhase = map[incomingStage] ?? "early veg";
              delete saved.stage;
            }
            if (!saved.medium) saved.medium = "coco";
            if (!saved.co2Mode) saved.co2Mode = "ambient";
            if (saved.containerSize == null) saved.containerSize = 1;
            return { saved } as FSIntakeStore;
          }
        }
        const current = incoming as FSIntakeStore | undefined;
        if (!current?.saved) return { saved: DEFAULT_SAVED } as FSIntakeStore;
        return current;
      },
    }
  )
);

export const getIntakeSnapshot = (): FSIntake => useIntake.getState().saved;

export const useStagePhase = () => useIntake((s) => s.saved.stagePhase);
export const useMedium = () => useIntake((s) => s.saved.medium);
// alias for legacy imports


// alias for legacy imports


// alias for legacy imports
export const useFrontIntake = useIntake as typeof useIntake;

