// window.__agentOffice as seen by the e2e specs (src/web/scene/interaction/TestHooks.tsx, U-6 / U4-4).
import type { PlacedItem } from '../../src/shared/domain';

export {};

declare global {
  interface Window {
    __agentOffice?: {
      project(x: number, z: number, y?: number): { x: number; y: number };
      arrange(): { active: boolean; selectedId: string | null; drag: unknown; seating: Record<string, string | null>; past: number; items: PlacedItem[]; meetingSeating: Record<string, string | null> };
      brains(): { id: string; mode: string; activity: string | null; x: number; z: number; outside: boolean }[];
      setBreakInterval(ms: number): void;
      shops(): { id: string; x: number; z: number }[];
      player(): { x: number; z: number; pose: 'standing' | 'sit' | 'lie'; aim: { itemId: string; action: string } | null } | null;
      teleportPlayer(x: number, z: number, yaw: number, pitch?: number): void;
      itemWorld(id: string): { x: number; z: number } | null;
      /** 008: office door states. */
      doors(): { id: string; openness: number }[];
      /** 009 T028: open the hire dialog as if an empty desk was clicked. */
      openHireAtDesk(deskId: string): void;
    };
  }
}
