// Renders the ad frame by frame with headless Chromium and encodes it with ffmpeg.
// Usage: node marketing/video/render.mjs [lang=en] [format=landscape|vertical] [fps=30]
// Requires: playwright-core (+ a Chromium binary) and an ffmpeg with libx264 (FFMPEG env or ffmpeg-static).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const [lang = 'en', format = 'landscape', fpsArg = '30'] = process.argv.slice(2);
const FPS = +fpsArg;
const DURATION = 30;
const vertical = format === 'vertical';
const size = vertical ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const FFMPEG = process.env.FFMPEG || require('ffmpeg-static');
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium';

// Only the website's own, confirmed copy is used — plus a short hook line per language.
const t = (await import(pathToFileURL(path.join(ROOT, `src/i18n/${lang}.js`)))).default;
const { BONAIRE, REGIONS } = await import(pathToFileURL(path.join(ROOT, 'src/data/places.js')));
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/map.json'), 'utf8'));
const project = ([lon, lat]) => [(lon - map.lon0) * map.cos, -(lat - map.lat0)];
const HOOK = { en: 'Sound familiar?', es: '¿Le resulta familiar?', nl: 'Herkenbaar?', pap: 'Bo ta rekonosé esaki?' };
const strings = {
  problems: [t.problems.items[0].t, t.problems.items[1].t, t.problems.items[5].t],
  familiar: HOOK[lang],
  from1: t.hero.sub.split('. ')[0] + '.',
  from2: t.hero.sub.split('. ').slice(1).join('. '),
  line1: t.hero.line1,
  line2: t.hero.line2,
  tags: t.hero.tags,
  svcKicker: t.services.kicker,
  svcTitle: t.services.title,
  services: t.services.items.map((s) => ({ name: s.name, desc: s.points.slice(0, 3).join(' · ') })),
  prKicker: t.process.kicker,
  prTitle: t.process.title,
  steps: t.process.steps.map((s) => s.name),
  ctaHead: `${t.hero.line1} <span class="it">${t.hero.line2}</span>`,
  cta: t.hero.cta1,
  bonaire: t.ui.bonaire,
  url: process.env.AD_URL || '', // add the confirmed web address when available
};

const outDir = path.join(ROOT, 'marketing', 'video', 'out');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `cps-ad-${lang}-${vertical ? '9x16' : '16x9'}.mp4`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(ROOT, 'marketing/video/ad.html')).href);
await page.evaluate((a) => window.init(a), {
  strings, map: { size: map.size, hi: map.hi }, bonaire: project(BONAIRE),
  targets: Object.values(REGIONS).flat().map((p) => ({ p: project(p) })), vertical,
});

const ff = spawn(FFMPEG, [
  '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-movflags', '+faststart', '-r', String(FPS), out,
], { stdio: ['pipe', 'ignore', 'inherit'] });

const frames = DURATION * FPS;
const started = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((s) => window.renderFrame(s), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`${lang} ${format}: frame ${i}/${frames} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log('wrote', path.relative(ROOT, out));
