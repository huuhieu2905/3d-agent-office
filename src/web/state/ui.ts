import { create } from 'zustand';

interface UiStore {
  openConversationId: string | null;
  camera: 'overview' | 'first_person';
  highlightProjectId: string | null;
  buildMode: boolean;
  hireDeskId: string | null;
  /** 004 US4 (data-model §8, not saved): first-person pose, what the crosshair is on, watered plants, effect. */
  playerPose: 'standing' | { spotId: string; pose: 'sit' | 'lie' };
  fpAim: { itemId: string; action: string } | null;
  freshPlants: Record<string, number>;
  fpEffect: { kind: 'water' | 'plant'; until: number } | null;
  setPlayerPose(p: UiStore['playerPose']): void;
  setFpAim(a: UiStore['fpAim']): void;
  waterPlant(id: string, until: number): void;
  setFpEffect(e: UiStore['fpEffect']): void;
  setHireDesk(id: string | null): void;
  openConversation(id: string): void;
  closeConversation(): void;
  setCamera(c: 'overview' | 'first_person'): void;
  setHighlightProject(id: string | null): void;
  setBuildMode(v: boolean): void;
}

export const useUi = create<UiStore>((set) => ({
  openConversationId: null,
  camera: 'overview',
  highlightProjectId: null,
  buildMode: false,
  hireDeskId: null,
  playerPose: 'standing',
  fpAim: null,
  freshPlants: {},
  fpEffect: null,
  setPlayerPose: (playerPose) => set({ playerPose }),
  setFpAim: (fpAim) => set({ fpAim }),
  waterPlant: (id, until) => set((s) => ({ freshPlants: { ...s.freshPlants, [id]: until } })),
  setFpEffect: (fpEffect) => set({ fpEffect }),
  setHireDesk: (hireDeskId) => set({ hireDeskId }),
  openConversation: (id) => set({ openConversationId: id }),
  closeConversation: () => set({ openConversationId: null }),
  setCamera: (camera) => set({ camera }),
  setHighlightProject: (highlightProjectId) => set({ highlightProjectId }),
  setBuildMode: (buildMode) => set({ buildMode }),
}));
