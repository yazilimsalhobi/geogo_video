// Headless MP4 üretimi: render.html'i Puppeteer ile açar, her kareyi alır,
// ffmpeg ile H.264 + AAC MP4'e çevirir.
//   node scripts/render.mjs --preset genel,ogretmen --format 16x9,9x16 --seed 1 --out out
//   node scripts/render.mjs --preset all --format all
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const ALL_PRESETS = ['genel', 'ogretmen', 'sinav', 'kesif', 'rastgele'];
const ALL_FORMATS = ['16x9', '9x16', '1x1'];

const argv = process.argv.slice(2);
const args = Object.fromEntries(
  argv.flatMap((a, i) => (a.startsWith('--') ? [[a.slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true']] : []))
);
const list = (v, all, def) => (!v ? def : v === 'all' ? all : v.split(',').map((s) => s.trim()).filter(Boolean));
const presets = list(args.preset, ALL_PRESETS, ['genel']);
const formats = list(args.format, ALL_FORMATS, ['16x9']);
const seed = Number(args.seed || 1);
const channels = list(args.channel, ['genel', 'instagram', 'youtube', 'tiktok', 'facebook', 'whatsapp', 'telegram', 'reklam'], ['genel']);
const outDir = resolve(args.out || 'out');
const quick = args.quick === 'true'; // hızlı test: 10 sn, 15 fps
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

await mkdir(outDir, { recursive: true });
const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/render.html`;
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

function ffmpegJob(file, wav, fps) {
  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest',
    file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg çıkış kodu ' + c)))));
  return { ff, done };
}

const results = [];
try {
  for (const channel of channels) for (const preset of presets) {
    for (const format of formats) {
      const name = `geogo_${preset}_${format}${channel === 'genel' ? '' : '_' + channel}_s${seed}`;
      const t0 = Date.now();
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[sayfa]', e.message));
      await page.goto(`${base}?preset=${preset}&format=${format}&seed=${seed}&channel=${channel}`, { waitUntil: 'networkidle0' });
      const script = await page.evaluate(() => window.GV.ready);
      const { DURATION, FPS } = await page.evaluate(() => ({ DURATION: window.GV.DURATION, FPS: window.GV.FPS }));
      const fps = quick ? 15 : FPS;
      const dur = quick ? 10 : DURATION;
      const wavB64 = await page.evaluate(() => window.GV.audio());
      const wav = join(outDir, `${name}.wav`);
      await writeFile(wav, Buffer.from(wavB64, 'base64'));
      const file = join(outDir, `${name}.mp4`);
      const { ff, done } = ffmpegJob(file, wav, fps);
      const total = Math.round(dur * fps);
      for (let f = 0; f < total; f++) {
        const url = await page.evaluate((t) => window.GV.frame(t), f / fps);
        const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        if (f % (fps * 5) === 0) process.stdout.write(`\r${name}: ${Math.round((f / total) * 100)}%   `);
      }
      ff.stdin.end();
      await done;
      // kapak görseli (montajın ortasından)
      const thumb = await page.evaluate(() => window.GV.frame(13.2, 0.9));
      await writeFile(join(outDir, `${name}.jpg`), Buffer.from(thumb.split(',')[1], 'base64'));
      await rm(wav);
      await page.close();
      const sec = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`\r✅ ${file} (${sec} sn) — oyunlar: ${script.games.join(', ')}`);
      results.push({ name, file, channel, games: script.games, link: script.shareUrl });
      await writeFile(join(outDir, `${name}.link.txt`), `${script.shareUrl}\n`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
await writeFile(join(outDir, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), seed, results }, null, 2));
