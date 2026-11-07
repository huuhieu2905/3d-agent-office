import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EmployeeProfiles, MISSING_POLLS } from '../../src/server/services/employee-profiles';

// 002 T093 / FR-005: the model remembered for a conversation is dropped once the conversation is gone
// from the App — not 30 days later — without being fooled by one bad or empty poll.

const setup = async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ao-profiles-'));
  const p = new EmployeeProfiles(dir);
  await p.update('a', { preferredModel: 'MODEL_A' });
  await p.update('b', { preferredModel: 'MODEL_B' });
  return { dir, p };
};

describe('forgetMissingModels', () => {
  it(`forgets the model after ${MISSING_POLLS} polls in a row without the conversation, and saves it`, async () => {
    const { dir, p } = await setup();
    for (let i = 0; i < MISSING_POLLS - 1; i++) await p.forgetMissingModels(['a']);
    expect((await p.get('b')).preferredModel?.modelId).toBe('MODEL_B');
    await p.forgetMissingModels(['a']);
    expect((await p.get('b')).preferredModel ?? null).toBeNull();
    expect((await p.get('a')).preferredModel?.modelId).toBe('MODEL_A');
    await p.flush();
    const file = JSON.parse(readFileSync(join(dir, 'employees.json'), 'utf8'));
    expect(file.profiles.b.preferredModel ?? null).toBeNull();
  });

  it('keeps the model when the conversation comes back in between (one bad poll)', async () => {
    const { p } = await setup();
    for (let i = 0; i < MISSING_POLLS - 1; i++) await p.forgetMissingModels(['a']);
    await p.forgetMissingModels(['a', 'b']);
    for (let i = 0; i < MISSING_POLLS - 1; i++) await p.forgetMissingModels(['a']);
    expect((await p.get('b')).preferredModel?.modelId).toBe('MODEL_B');
  });

  it('ignores an empty list (App hiccup), however often it happens', async () => {
    const { p } = await setup();
    for (let i = 0; i < MISSING_POLLS * 3; i++) await p.forgetMissingModels([]);
    expect((await p.get('a')).preferredModel?.modelId).toBe('MODEL_A');
    expect((await p.get('b')).preferredModel?.modelId).toBe('MODEL_B');
  });
});
