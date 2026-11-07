/// <reference lib="dom" />
// SC-004 / quality gate 4: run the /bench scene for 60 s at 1920×1080 and fail if average FPS < 60.
// Usage: npm run bench:fps [-- --seconds 60 --headed]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

declare global {
  interface Window {
    __bench?: { frames: number[]; startedAt: number };
  }
}

const seconds = Number(process.argv[process.argv.indexOf('--seconds') + 1]) || 60;
const headed = process.argv.includes('--headed');
const detailArg = process.argv.indexOf('--detail');
const detail = detailArg > 0 ? process.argv[detailArg + 1] : 'medium';
const port = 4398;

if (!existsSync('dist/web/index.html')) {
  console.error('Build the web UI first: npm run build');
  process.exit(2);
}
const server = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts', '--no-open'], {
  env: { ...process.env, AGENT_OFFICE_PORT: String(port), AGENT_OFFICE_DATA_DIR: '/tmp/agent-office-bench' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise<void>((resolve, reject) => {
  server.stdout!.on('data', (d: Buffer) => d.toString().includes('running at') && resolve());
  setTimeout(() => reject(new Error('server did not start')), 20_000);
});

const browser = await chromium.launch({ headless: !headed, args: [
    '--use-angle=metal',
    '--enable-gpu-rasterization',
    '--ignore-gpu-blocklist',
    // Uncap from the 60 Hz vsync so we measure real headroom, not the display refresh rate.
    '--disable-frame-rate-limit',
    '--disable-gpu-vsync',
  ] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://127.0.0.1:${port}/bench?detail=${detail}`);
  await page.waitForFunction(() => (window.__bench?.frames.length ?? 0) > 30, null, { timeout: 30_000 });
  await page.evaluate(() => (window.__bench!.frames = []));
  await page.waitForTimeout(seconds * 1000);
  const frames = await page.evaluate(() => window.__bench!.frames);
  const dts = frames.slice(1).map((t: number, i: number) => t - frames[i]!);
  const avg = (dts.length * 1000) / (frames.at(-1)! - frames[0]!);
  const sorted = [...dts].sort((a, b) => b - a);
  const p1 = 1000 / (sorted[Math.floor(sorted.length * 0.01)] ?? 16.7);
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
  console.log(`renderer: ${renderer} · detail: ${detail}`);
  console.log(`frames: ${frames.length} over ${seconds}s — average ${avg.toFixed(1)} FPS, 1% low ${p1.toFixed(1)} FPS`);
  if (avg < 60) {
    console.error('✗ SC-004 failed: average FPS below 60');
    process.exitCode = 1;
  } else console.log('✓ SC-004: average FPS ≥ 60');
} finally {
  await browser.close();
  server.kill();
}
