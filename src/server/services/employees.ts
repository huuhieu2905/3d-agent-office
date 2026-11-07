import type { ConnectionState, Conversation, Employee, Step } from '../../shared/domain';
import { latestRequestedModel } from '../../shared/model';
import type { AppAdapter } from '../app-adapter/index';
import type { WsHub } from '../http/ws-hub';
import type { Logger } from '../log';
import { colorFor } from '../../shared/colors';
import { desks } from './default-layout';
import type { EmployeeProfiles } from './employee-profiles';
import type { LayoutStore } from './layout-store';
import { computeVisualState } from './visual-state';

// Conversations + profiles → Employees, polled every second (research.md R7), pushed as patches.

export const MAX_VISIBLE = 20;

export interface EmployeesServiceOptions {
  adapter: AppAdapter;
  hub: WsHub;
  log: Logger;
  profiles: EmployeeProfiles;
  layout: LayoutStore;
  intervalMs?: number;
  now?: () => number;
}

type Listener = (e: { type: 'run-finished'; conversationId: string } | { type: 'user-inputs'; count: number }) => void;

export class EmployeesService {
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private employees = new Map<string, Employee>();
  private lastSteps = new Map<string, Step | null>();
  /** A2-1: the model each conversation's latest user turn asked for, as seen in fetched steps. */
  private lastModel = new Map<string, string>();
  private lastStepCount = new Map<string, number>();
  private lastRun = new Map<string, Conversation['runStatus']>();
  private candidate = new Map<string, Employee['visualState']>();
  private conversations = new Map<string, Conversation>();
  private overflow = 0;
  private listeners = new Set<Listener>();
  private primed = false;
  private lastOverflow = -1;

  constructor(private readonly o: EmployeesServiceOptions) {}

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  snapshot(): { employees: Employee[]; overflow: number } {
    return { employees: [...this.employees.values()], overflow: this.overflow };
  }

  conversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  start(): void {
    this.o.hub.onClientConnect((send) => send({ type: 'employees.snapshot', payload: this.snapshot() }));
    this.o.adapter.onConnectionChange((s) => this.onConnection(s));
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.o.intervalMs ?? 1000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private onConnection(s: ConnectionState): void {
    if (s.kind === 'connected') return;
    // Everyone freezes while the App is away (FR-006); layout and seats are kept.
    const upserted: Employee[] = [];
    for (const e of this.employees.values()) {
      if (e.visualState !== 'disconnected') {
        e.visualState = 'disconnected';
        upserted.push({ ...e });
      }
    }
    if (upserted.length) this.o.hub.broadcast({ type: 'employees.patch', payload: { upserted, removed: [], overflow: this.overflow } });
  }

  /** Force an immediate refresh (e.g. right after the boss sends a message). */
  refresh(): Promise<void> {
    return this.poll();
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    const connection = this.o.adapter.getConnection();
    if (connection.kind !== 'connected') return;
    this.polling = true;
    try {
      const list = await this.o.adapter.listConversations();
      const now = this.o.now?.() ?? Date.now();
      this.conversations = new Map(list.map((c) => [c.id, c]));

      // Fetch the last step only where something may have changed.
      let newUserInputs = 0;
      await Promise.all(
        list.map(async (c) => {
          const prevCount = this.lastStepCount.get(c.id);
          const changed = prevCount === undefined || prevCount !== c.stepCount;
          const active = c.runStatus === 'RUNNING' || c.runStatus === 'BUSY' || c.runStatus === 'CANCELING';
          if (!changed && !active && this.lastSteps.has(c.id)) return;
          try {
            const steps = await this.o.adapter.getSteps(c.id, Math.max(0, (prevCount ?? c.stepCount) - 1));
            if (this.primed && prevCount !== undefined) newUserInputs += steps.filter((s) => s.kind === 'user' && s.index >= prevCount).length;
            this.lastSteps.set(c.id, steps.at(-1) ?? this.lastSteps.get(c.id) ?? null);
            const model = latestRequestedModel(steps);
            if (model) this.lastModel.set(c.id, model);
          } catch {
            /* keep previous */
          }
          this.lastStepCount.set(c.id, c.stepCount);
        }),
      );

      for (const c of list) {
        const prev = this.lastRun.get(c.id);
        if (prev && prev !== 'IDLE' && c.runStatus === 'IDLE') this.emit({ type: 'run-finished', conversationId: c.id });
        this.lastRun.set(c.id, c.runStatus);
      }
      if (newUserInputs) this.emit({ type: 'user-inputs', count: newUserInputs });

      await this.rebuild(list, connection, now);
      this.primed = true;
    } catch (err) {
      this.o.log.warn({ err }, 'employee poll failed');
    } finally {
      this.polling = false;
    }
  }

  private async rebuild(list: Conversation[], connection: ConnectionState, now: number): Promise<void> {
    const { profiles } = this.o;
    await profiles.touch(list.map((c) => c.id), now);

    // Visible = the 20 most recently active (FR-004); subagents count towards the limit.
    const sorted = [...list].sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
    const visibleIds = new Set(sorted.slice(0, MAX_VISIBLE).map((c) => c.id));
    this.overflow = Math.max(0, sorted.length - MAX_VISIBLE);

    await this.assignDesks(sorted.filter((c) => visibleIds.has(c.id)));

    const next = new Map<string, Employee>();
    for (const c of list) {
      const p = await profiles.get(c.id);
      const raw = computeVisualState(c, this.lastSteps.get(c.id) ?? null, connection, now);
      const prev = this.employees.get(c.id);
      // A new state must be seen on one poll before it is published (anti-flicker, ≤ 1 s extra).
      let visualState = prev?.visualState ?? raw;
      if (prev && raw !== prev.visualState) {
        if (this.candidate.get(c.id) === raw || prev.visualState === 'disconnected') {
          visualState = raw;
          this.candidate.delete(c.id);
        } else {
          this.candidate.set(c.id, raw);
        }
      } else {
        this.candidate.delete(c.id);
      }
      next.set(c.id, {
        conversationId: c.id,
        name: c.title,
        visualState,
        appearance: p.appearance,
        deskId: p.deskId,
        projectId: c.projectId,
        projectColor: colorFor(c.projectId),
        isSubagent: c.parentId != null,
        parentId: c.parentId,
        visible: visibleIds.has(c.id),
        lastActivityAt: c.lastActivityAt,
        preferredModel: p.preferredModel?.modelId ?? null,
        currentModel: this.lastModel.get(c.id) ?? c.currentModel ?? null,
      });
    }
    await profiles.flush();

    const upserted: Employee[] = [];
    const removed: string[] = [];
    for (const [id, e] of next) {
      if (JSON.stringify(this.employees.get(id)) !== JSON.stringify(e)) upserted.push(e);
    }
    for (const id of this.employees.keys()) if (!next.has(id)) removed.push(id);
    const overflowChanged = this.overflow !== this.lastOverflow;
    this.lastOverflow = this.overflow;
    this.employees = next;
    for (const id of removed) {
      this.lastSteps.delete(id);
      this.lastModel.delete(id);
      this.lastStepCount.delete(id);
      this.lastRun.delete(id);
    }
    if (upserted.length || removed.length || overflowChanged) {
      this.o.hub.broadcast({ type: 'employees.patch', payload: { upserted, removed, overflow: this.overflow } });
    }
  }

  /** New visible employees get a free desk; subagents prefer the free desk closest to their parent. */
  private async assignDesks(visible: Conversation[]): Promise<void> {
    const layout = await this.o.layout.get();
    const allDesks = desks(layout);
    const deskIds = new Set(allDesks.map((d) => d.id));
    const taken = new Set<string>();
    for (const c of visible) {
      const p = await this.o.profiles.get(c.id);
      if (p.deskId && deskIds.has(p.deskId) && !taken.has(p.deskId)) taken.add(p.deskId);
      else if (p.deskId && (!deskIds.has(p.deskId) || taken.has(p.deskId))) await this.o.profiles.update(c.id, { deskId: null });
    }
    const free = () => allDesks.filter((d) => !taken.has(d.id));
    const ordered = [...visible].sort((a, b) => Number(a.parentId != null) - Number(b.parentId != null));
    for (const c of ordered) {
      const p = await this.o.profiles.get(c.id);
      if (p.deskId) continue;
      const options = free();
      if (options.length === 0) break; // the rest wait in the lobby
      let chosen = options[0]!;
      if (c.parentId) {
        const parentDeskId = (await this.o.profiles.get(c.parentId)).deskId;
        const parentDesk = allDesks.find((d) => d.id === parentDeskId);
        if (parentDesk) {
          chosen = options.reduce((best, d) =>
            Math.hypot(d.pos.x - parentDesk.pos.x, d.pos.z - parentDesk.pos.z) <
            Math.hypot(best.pos.x - parentDesk.pos.x, best.pos.z - parentDesk.pos.z)
              ? d
              : best,
          );
        }
      }
      taken.add(chosen.id);
      await this.o.profiles.update(c.id, { deskId: chosen.id });
    }
  }

  private emit(e: Parameters<Listener>[0]): void {
    for (const l of this.listeners) l(e);
  }
}
