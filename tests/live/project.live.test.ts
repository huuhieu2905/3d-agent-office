import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAppAdapter, deleteTestConversation, deleteTestProject } from '../../src/server/app-adapter/index';
import { sweepTestArtifacts } from './sweep';

// Spec 003 T010 (R3-09, FR-003): create a project bound to a folder, hire into it, check projectId.

beforeAll(async () => {
  await sweepTestArtifacts();
}, 120_000);

describe('live: projects', () => {
  it('creates a project and starts a conversation inside it', async () => {
    const a = createAppAdapter();
    await a.start();
    expect(a.getConnection().kind).toBe('connected');
    const dir = await mkdtemp(join(tmpdir(), 'ao-project-'));
    let projectId: string | null = null;
    let conversationId: string | null = null;
    try {
      const folderUri = pathToFileURL(dir).href;
      // App 2.29.0 rejects duplicate project names (HTTP 409), so every run uses a unique name.
      const p = await a.createProject({ name: `[agent-office-test] project ${Date.now()}`, folderUri });
      projectId = p.id;
      expect(p.folderUri).toBe(folderUri);
      expect((await a.listProjects()).some((x) => x.id === p.id)).toBe(true);

      const models = await a.getModels();
      const model = models.find((m) => /Flash/.test(m.label))?.modelId ?? models[0]!.modelId;
      ({ conversationId } = await a.startConversation({
        projectId: p.id,
        parts: [{ text: '[agent-office-test] project. Reply OK only. No tools.' }],
        model,
      }));
      let conv;
      for (let i = 0; i < 40 && !conv; i++) {
        conv = (await a.listConversations()).find((c) => c.id === conversationId);
        if (!conv) await new Promise((r) => setTimeout(r, 250));
      }
      expect(conv?.projectId).toBe(p.id);
    } finally {
      await a.stop();
      if (conversationId) await deleteTestConversation(conversationId).catch(() => undefined);
      if (projectId) await deleteTestProject(projectId).catch(() => undefined);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
