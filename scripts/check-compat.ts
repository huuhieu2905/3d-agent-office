// Read-only compatibility check against the running Antigravity App (spec 003 US4, FR-015/016).
// Usage: npm run check:compat [-- --json] [-- --out <file>] [-- --baseline <version>]
// Only imports inspectCompat (guarded by scripts/check-guards.sh). Never writes to the App.
import { writeFile } from 'node:fs/promises';
import { inspectCompat } from '../src/server/app-adapter/index';

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const report = await inspectCompat({ baseline: flag('--baseline') });
const missing = report.rpcs.filter((r) => !r.present);

function markdown(): string {
  const out: string[] = [];
  out.push(`# Antigravity App ${report.appVersion} — ${report.verified ? 'đã kiểm chứng' : 'CHƯA kiểm chứng'}`);
  out.push(`So sánh với bộ fixture: ${report.baseline ?? '(không có)'} · ${report.scannedConversations} conversation · ${(report.durationMs / 1000).toFixed(1)} s`);
  out.push('', `## RPC đang dùng: ${report.rpcs.length - missing.length}/${report.rpcs.length} còn`);
  out.push(missing.length ? missing.map((r) => `- ✗ MẤT: ${r.name}`).join('\n') : '- ✓ tất cả còn');
  out.push('', '## Trường thêm / bớt');
  for (const d of report.fieldDiff) {
    const note = d.contentDependent ? ' (phụ thuộc nội dung conversation: "bớt" có thể chỉ vì không có loại bước đó)' : '';
    out.push(`### ${d.rpc}${note}`);
    if (!d.added.length && !d.removed.length) out.push('- không khác');
    for (const p of d.added) out.push(`- + ${p}`);
    for (const p of d.removed) out.push(`- − ${p}`);
  }
  out.push('', '## Loại bước chưa nhận ra');
  out.push(report.unknownStepTypes.length ? report.unknownStepTypes.map((u) => `- ${u.rawType}: ${u.count}`).join('\n') : '- không có');
  return out.join('\n') + '\n';
}

const text = argv.includes('--json') ? JSON.stringify(report, null, 2) + '\n' : markdown();
const out = flag('--out');
if (out) await writeFile(out, text);
process.stdout.write(text);
process.exit(missing.length ? 1 : 0);
