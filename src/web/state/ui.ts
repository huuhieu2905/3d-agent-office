import { create } from 'zustand';

interface UiStore {
  openConversationId: string | null;
  camera: 'overview' | 'first_person';
  highlightProjectId: string | null;
  buildMode: boolean;
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
  openConversation: (id) => set({ openConversationId: id }),
  closeConversation: () => set({ openConversationId: null }),
  setCamera: (camera) => set({ camera }),
  setHighlightProject: (highlightProjectId) => set({ highlightProjectId }),
  setBuildMode: (buildMode) => set({ buildMode }),
}));
