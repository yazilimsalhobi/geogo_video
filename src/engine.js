// GeoGo Video motoru: zamanın saf fonksiyonu olarak her kareyi canvas'a çizer.
// draw(t) aynı t için her zaman aynı kareyi üretir → tarayıcıda canlı önizleme,
// MediaRecorder kaydı ve headless (Puppeteer + ffmpeg) MP4 üretimi aynı kodu kullanır.
import { gameById, SITE_URL } from './games.js';
import { buildScript, FORMATS, CHANNELS, mulberry32, trackingUrl } from './presets.js';

export const DURATION = 60;
export const FPS = 30;
export const SCENES = [
  { id: 'hook', start: 0, end: 6 },
  { id: 'brand', start: 6, end: 10 },
  { id: 'montage', start: 10, end: 42 },
  { id: 'pillars', start: 42, end: 51 },
  { id: 'features', start: 51, end: 54 },
  { id: 'cta', start: 54, end: 60 },
];
export const CARD_LEN = 4; // montajda oyun başına saniye

// Geogo pozları (assets/mascot/<ad>.webp, şeffaf arka plan)
export const MASCOTS = [
  'geogo-durbun', 'geogo-ogretmen', 'geogo-sol', 'geogo-sag', 'geogo-dusunen', 'geogo-harita',
  'geogo-mutlu', 'geogo-araba', 'geogo-kis', 'geogo-kamera', 'geogo-sirt',
];
// Montajda her oyun kartının yanında beliren Geogo (seed ile kaydırılır)
const CARD_MASCOTS = ['geogo-araba', 'geogo-kamera', 'geogo-harita', 'geogo-durbun', 'geogo-kis', 'geogo-sag', 'geogo-mutlu', 'geogo-sirt'];
const RAINBOW = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

const DISPLAY = "'Baloo 2', 'Nunito', system-ui, sans-serif";
const BODY = "'Nunito', system-ui, sans-serif";
const NAVY = '#0f1b3d';
const YELLOW = '#fde047';
const PALETTES = [
  ['#1e1b4b', '#6d28d9', '#db2777'],
  ['#0c1e4a', '#1d4ed8', '#0891b2'],
  ['#2e1065', '#7c3aed', '#f97316'],
];

// ---------- yardımcılar ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const outCubic = (p) => 1 - Math.pow(1 - p, 3);
const inCubic = (p) => p * p * p;
const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const outBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const outElastic = (p) =>
  p === 0 || p === 1 ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, p) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], p))).join(',')})`;
}
function shade(h, p) {
  return p < 0 ? mix(h, '#000000', -p) : mix(h, '#ffffff', p);
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Görsel yüklenemedi: ' + src));
    im.src = src;
  });
}

export class GeoGoVideo {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = {};
  }

  async load(opts = {}) {
    const fmt = FORMATS[opts.format] || FORMATS['16x9'];
    this.format = opts.format in FORMATS ? opts.format : '16x9';
    this.canvas.width = fmt.w;
    this.canvas.height = fmt.h;
    this.W = fmt.w;
    this.H = fmt.h;
    this.u = Math.min(fmt.w, fmt.h) / 1080;
    const ar = fmt.h / fmt.w;
    this.mode = ar > 1.2 ? 'port' : ar > 0.8 ? 'square' : 'land';
    this.script = buildScript(opts);
    this.pal = PALETTES[this.script.palette];

    const base = opts.assetBase || new URL('../assets/', import.meta.url).href;
    const jobs = [];
    const want = new Set([...this.script.games, 'sinif-duellosu', 'harita-royale']);
    for (const id of want) {
      if (this.images[id]) continue;
      jobs.push(loadImage(`${base}posters/${id}.webp`).then((im) => (this.images[id] = im)));
    }
    for (const k of MASCOTS) {
      if (!this.images[k]) jobs.push(loadImage(`${base}mascot/${k}.webp`).then((im) => (this.images[k] = im)));
    }
    // alt bant yüksekliği ve maskotların bastığı "zemin"
    this.bh = Math.round(fmt.h * (this.mode === 'port' ? 0.07 : this.mode === 'square' ? 0.1 : 0.11));
    this.floor = fmt.h - this.bh * 0.82;
    if (document.fonts) {
      jobs.push(
        Promise.all([
          document.fonts.load(`800 100px 'Baloo 2'`, 'ĞÜŞİÖÇğüşıöç'),
          document.fonts.load(`700 100px 'Baloo 2'`, 'ĞÜŞİÖÇğüşıöç'),
          document.fonts.load(`800 100px 'Nunito'`, 'ĞÜŞİÖÇğüşıöç'),
          document.fonts.load(`700 100px 'Nunito'`, 'ĞÜŞİÖÇğüşıöç'),
        ]).catch(() => {})
      );
    }
    await Promise.all(jobs);

    this.channel = opts.channel in CHANNELS ? opts.channel : 'genel';
    const track = { host: SITE_URL, preset: this.script.preset, format: this.format, channel: this.channel };
    this.qrUrl = trackingUrl({ ...track, via: 'qr' });
    this.shareUrl = trackingUrl({ ...track, via: 'link' });
    this.qr = null;
    if (typeof window !== 'undefined' && window.qrcode) {
      const q = window.qrcode(0, 'M');
      q.addData(this.qrUrl);
      q.make();
      this.qr = q;
    }
    this.particles = this.makeParticles();
    this.confetti = this.makeConfetti();
    return this;
  }

  makeParticles() {
    const r = mulberry32(7 + this.script.seed);
    return Array.from({ length: 26 }, () => ({ x: r(), y: r(), s: 0.4 + r(), v: 0.02 + r() * 0.05, a: r() * 6.28 }));
  }

  makeConfetti() {
    const r = mulberry32(99 + this.script.seed);
    const cols = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#fb923c', '#a78bfa', '#ffffff'];
    return Array.from({ length: 90 }, () => {
      const ang = -Math.PI / 2 + (r() - 0.5) * 2.2;
      const sp = 0.6 + r() * 1.1;
      return { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: r() * 6.28, vr: (r() - 0.5) * 12, c: cols[Math.floor(r() * cols.length)], w: 0.6 + r() * 0.8, delay: r() * 0.25 };
    });
  }

  // ---------- çizim temelleri ----------
  text(s, x, y, o = {}) {
    const { ctx, u } = this;
    const size = o.size || 60 * u;
    ctx.font = `${o.weight || 800} ${size}px ${o.font || DISPLAY}`;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const sw = o.stroke ? o.strokeW || size * 0.12 : 0;
    if (o.shadow !== false) {
      ctx.fillStyle = o.shadowColor || 'rgba(8,10,40,0.35)';
      ctx.strokeStyle = o.shadowColor || 'rgba(8,10,40,0.35)';
      const d = size * 0.07;
      if (sw) {
        ctx.lineWidth = sw;
        ctx.strokeText(s, x, y + d);
      }
      ctx.fillText(s, x, y + d);
    }
    if (sw) {
      ctx.lineWidth = sw;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = o.fill || '#fff';
    ctx.fillText(s, x, y);
  }

  fit(s, maxW, size, weight = 800, font = DISPLAY) {
    this.ctx.font = `${weight} ${size}px ${font}`;
    const w = this.ctx.measureText(s).width;
    return w > maxW ? (size * maxW) / w : size;
  }

  wrap(s, maxW, size, weight = 800, font = BODY) {
    const { ctx } = this;
    ctx.font = `${weight} ${size}px ${font}`;
    const words = s.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (ctx.measureText(next).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // Ortalanmış hap/rozet; genişliği döndürür
  pill(label, cx, cy, o = {}) {
    const { ctx, u } = this;
    const size = o.size || 34 * u;
    ctx.font = `${o.weight || 800} ${size}px ${o.font || BODY}`;
    const w = ctx.measureText(label).width + size * 1.4;
    const h = size * 1.8;
    const x = o.align === 'left' ? cx : cx - w / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 18 * u;
    ctx.shadowOffsetY = 6 * u;
    ctx.fillStyle = o.bg || YELLOW;
    rr(ctx, x, cy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
    if (o.border) {
      ctx.lineWidth = 4 * u;
      ctx.strokeStyle = o.border;
      rr(ctx, x, cy - h / 2, w, h, h / 2);
      ctx.stroke();
    }
    ctx.fillStyle = o.fg || NAVY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, cy + size * 0.04);
    return w;
  }

  pillWidth(label, size, weight = 800) {
    this.ctx.font = `${weight} ${size}px ${BODY}`;
    return this.ctx.measureText(label).width + size * 1.4;
  }

  background(t, c1, c2, c3, o = {}) {
    const { ctx, W, H, u } = this;
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, c1);
    g.addColorStop(0.6, c2);
    g.addColorStop(1, c3 || c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // güneş ışınları (afişlerdeki gibi)
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
    const R = Math.hypot(W, H);
    const n = 18;
    const rot = t * (o.spin ?? 0.12);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = `rgba(255,255,255,${o.rayAlpha ?? 0.07})`;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.lineTo(Math.cos(a + Math.PI / n) * R, Math.sin(a + Math.PI / n) * R);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // vinyet
    const vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, R * 0.6);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // yüzen noktalar
    for (const p of this.particles) {
      const y = ((p.y - t * p.v) % 1 + 1) % 1;
      const x = p.x + Math.sin(t * 0.8 + p.a) * 0.01;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.arc(x * W, y * H, p.s * 14 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  mascot(key, cx, bottom, h, t, o = {}) {
    const im = this.images[key];
    if (!im) return;
    const { ctx } = this;
    const bounce = Math.abs(Math.sin(t * Math.PI * (o.bpm ?? 2))) * (o.amp ?? 0.03) * h;
    const sq = 1 + Math.sin(t * Math.PI * 2 * (o.bpm ?? 2) / 2) * 0.015;
    const w = (h * im.width) / im.height;
    ctx.save();
    ctx.translate(cx, bottom - bounce);
    ctx.rotate((o.rot ?? 0) + Math.sin(t * 2.2) * 0.03);
    ctx.scale((o.flip ? -1 : 1) * (o.scale ?? 1) * sq, (o.scale ?? 1) / sq);
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
  }

  card(img, cx, cy, h, rot = 0, scale = 1, o = {}) {
    if (!img) return;
    const { ctx, u } = this;
    const w = (h * img.width) / img.height;
    const r = 30 * u, b = 10 * u;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 50 * u;
    ctx.shadowOffsetY = 24 * u;
    ctx.fillStyle = '#fff';
    rr(ctx, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, r + b);
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, -w / 2, -h / 2, w, h, r);
    ctx.clip();
    const k = o.zoom ?? 1;
    ctx.drawImage(img, (-w * k) / 2, (-h * k) / 2, w * k, h * k);
    // parlama süpürmesi
    if (o.shine != null && o.shine > 0 && o.shine < 1) {
      const sx = lerp(-w * 1.2, w * 1.2, o.shine);
      const g = ctx.createLinearGradient(sx - w * 0.3, -h / 2, sx + w * 0.3, h / 2);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
    if (o.label) {
      // kartın alt kenarına yapışık geogames.site etiketi
      const ls = 26 * u * (h / (700 * u));
      const k = 1 + Math.sin((o.t || 0) * 6) * 0.04;
      ctx.save();
      ctx.translate(w * (o.labelX ?? -0.2), h / 2 + b * 0.2);
      ctx.rotate(-0.03);
      ctx.scale(k, k);
      this.pill(SITE_URL, 0, 0, { size: Math.max(ls, 22 * u), bg: YELLOW, fg: NAVY, border: '#fff' });
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- ana çizim ----------
  draw(t) {
    t = clamp(t, 0, DURATION - 1e-6);
    const { ctx, W, H } = this;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const sc = SCENES.find((s) => t >= s.start && t < s.end) || SCENES[SCENES.length - 1];
    const s = t - sc.start;
    this[sc.id](s, t, sc.end - sc.start);
    this.transitions(t);
    this.banner(t);
    // açılış/kapanış kararması
    const fade = Math.max(1 - t / 0.25, prog(t, DURATION - 0.35, DURATION));
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // Her sahnede altta duran renkli, hareketli geogames.site bandı
  banner(t) {
    const { ctx, W, H, u, bh, mode } = this;
    const enter = outBack(prog(t, 0.15, 0.75));
    const y0 = H - bh * enter;
    const beat = Math.pow(1 - ((t * 2) % 1), 4); // 120 BPM nabız
    ctx.save();
    // şeker çubuğu şeritler (kayan)
    ctx.beginPath();
    ctx.rect(0, y0, W, bh);
    ctx.clip();
    const sw = bh * 0.9, sk = bh * 0.6;
    const off = (t * 160 * u) % (sw * RAINBOW.length);
    for (let x = -sw * RAINBOW.length - sk + off, k = 0; x < W + sw; x += sw, k++) {
      ctx.fillStyle = RAINBOW[k % RAINBOW.length];
      ctx.beginPath();
      ctx.moveTo(x, y0 + bh);
      ctx.lineTo(x + sk, y0);
      ctx.lineTo(x + sk + sw, y0);
      ctx.lineTo(x + sw, y0 + bh);
      ctx.closePath();
      ctx.fill();
    }
    // parlak üst kenar + hafif gölge
    const g = ctx.createLinearGradient(0, y0, 0, y0 + bh);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.35, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, bh);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, y0, W, 6 * u);
    ctx.restore();

    const cy = y0 + bh * 0.52;
    // yan rozetler (yatay/kare)
    if (mode !== 'port') {
      const cs = bh * 0.26;
      const l = 'ÜCRETSİZ', r = 'HEMEN OYNA ▶';
      const wob = (ph) => 1 + Math.sin(t * 6 + ph) * 0.05;
      ctx.save();
      ctx.translate(W * (mode === 'square' ? 0.13 : 0.12), cy);
      ctx.rotate(-0.06);
      ctx.scale(wob(0), wob(0));
      this.pill(l, 0, 0, { size: cs, bg: YELLOW, fg: NAVY, border: '#fff' });
      ctx.restore();
      ctx.save();
      ctx.translate(W * (mode === 'square' ? 0.86 : 0.87), cy);
      ctx.rotate(0.06);
      ctx.scale(wob(2), wob(2));
      this.pill(r, 0, 0, { size: cs, bg: '#fff', fg: '#db2777', border: '#db2777' });
      ctx.restore();
    }
    // orta: gökkuşağı harfli geogames.site
    const size = bh * (mode === 'port' ? 0.56 : 0.5);
    ctx.font = `800 ${size}px ${DISPLAY}`;
    const letters = [...SITE_URL];
    const widths = letters.map((ch) => ctx.measureText(ch).width);
    const tw = widths.reduce((a, b) => a + b, 0);
    const pw = tw + size * 1.3, ph = bh * 0.78;
    ctx.save();
    ctx.translate(W / 2, cy);
    const k = 1 + beat * 0.05;
    ctx.scale(k, k);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18 * u;
    ctx.shadowOffsetY = 6 * u;
    ctx.fillStyle = '#fff';
    rr(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = NAVY;
    rr(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2);
    ctx.stroke();
    let x = -tw / 2;
    letters.forEach((ch, i) => {
      const dy = Math.sin(t * 7 - i * 0.55) * size * 0.08;
      const col = ch === '.' ? NAVY : RAINBOW[(i + Math.floor(t * 4)) % RAINBOW.length];
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.14;
      ctx.strokeStyle = NAVY;
      ctx.strokeText(ch, x, dy + size * 0.05);
      ctx.fillStyle = col;
      ctx.fillText(ch, x, dy + size * 0.05);
      x += widths[i];
    });
    ctx.restore();
    // pırıltılar
    const sp = [[-0.55, -0.45, 0], [0.56, -0.4, 1.3], [-0.6, 0.35, 2.1], [0.6, 0.38, 0.7]];
    sp.forEach(([fx, fy, ph2]) => {
      const a = Math.max(0, Math.sin(t * 5 + ph2 * 3));
      if (a <= 0.05) return;
      this.sparkle(W / 2 + fx * pw * 1.05, cy + fy * bh, bh * 0.16 * a, `rgba(255,255,255,${a})`);
    });
  }

  sparkle(x, y, r, col) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 ? r * 0.28 : r;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  transitions(t) {
    const { ctx, W, H } = this;
    const cols = [YELLOW, '#f472b6', NAVY];
    for (const sc of SCENES.slice(1)) {
      const B = sc.start;
      if (t < B - 0.5 || t > B + 0.5) continue;
      const s = H * 0.45;
      const bw = W + 3 * s;
      cols.forEach((c, i) => {
        const off = (i - 1) * 0.07;
        const p = inOut(prog(t, B - 0.35 + off, B + 0.35 + off));
        if (p <= 0 || p >= 1) return;
        const x0 = lerp(-bw - s, W + s, p);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x0, H);
        ctx.lineTo(x0 + s, 0);
        ctx.lineTo(x0 + s + bw, 0);
        ctx.lineTo(x0 + bw, H);
        ctx.closePath();
        ctx.fill();
      });
    }
  }

  // ---------- 1) Kanca: 0–6 sn ----------
  hook(s) {
    const { W, H, u, mode, ctx } = this;
    const [c1, c2, c3] = this.pal;
    this.background(s, NAVY, c1, c2, { cy: H * 0.45 });
    const hk = this.script.hook;
    const port = mode === 'port';
    const maxW = W * (port ? 0.88 : 0.8);

    // soru
    const out = outCubic(prog(s, 3.4, 3.8));
    let shake = 0;
    if (s > 2.4 && s < 2.75) shake = Math.sin(s * 90) * 14 * u * (1 - prog(s, 2.4, 2.75));
    ctx.save();
    ctx.translate(shake, -out * H * 0.6);
    ctx.globalAlpha = 1 - out;
    const qs = this.fit(hk.q[0], maxW, (port ? 140 : 150) * u);
    const qs2 = this.fit(hk.q[1], maxW, (port ? 165 : 170) * u);
    const qy = H * (port ? 0.4 : 0.42);
    [hk.q[0], hk.q[1]].forEach((line, i) => {
      const p = prog(s, 0.25 + i * 0.5, 0.75 + i * 0.5);
      if (p <= 0) return;
      ctx.save();
      ctx.translate(W / 2, qy + (i ? qs * 0.62 : -qs * 0.62));
      const k = outBack(p);
      ctx.scale(k, k);
      this.text(line, 0, 0, { size: i ? qs2 : qs, fill: i ? YELLOW : '#fff', stroke: NAVY });
      ctx.restore();
    });
    // damga
    const sp = prog(s, 2.35, 2.7);
    if (sp > 0) {
      const k = lerp(2.6, 1, outCubic(sp));
      const ss = this.fit(hk.stamp, maxW * 0.8, (port ? 96 : 120) * u);
      ctx.font = `800 ${ss}px ${DISPLAY}`;
      const tw = ctx.measureText(hk.stamp).width + ss;
      ctx.save();
      ctx.translate(W / 2, qy + qs * 1.6);
      ctx.rotate(-0.09);
      ctx.scale(k, k);
      ctx.globalAlpha *= clamp(sp * 3);
      ctx.fillStyle = '#ef4444';
      rr(ctx, -tw / 2, -ss * 0.75, tw, ss * 1.5, 22 * u);
      ctx.fill();
      ctx.lineWidth = 8 * u;
      ctx.strokeStyle = '#fff';
      rr(ctx, -tw / 2 + 10 * u, -ss * 0.75 + 10 * u, tw - 20 * u, ss * 1.5 - 20 * u, 16 * u);
      ctx.stroke();
      this.text(hk.stamp, 0, ss * 0.05, { size: ss, fill: '#fff', shadow: false });
      ctx.restore();
    }
    ctx.restore();

    // cevap + maskot
    const ap = prog(s, 3.55, 4.05);
    if (ap > 0) {
      const as = this.fit(hk.a, port || mode === 'square' ? W * 0.88 : W * 0.52, (port ? 110 : 120) * u);
      const sqm = mode === 'square';
      const ax = port || sqm ? W / 2 : W * 0.35;
      const ay = port ? H * 0.3 : sqm ? H * 0.24 : H * 0.42;
      ctx.save();
      ctx.translate(ax, ay);
      const k = outElastic(ap);
      ctx.scale(k, k);
      this.text(hk.a, 0, 0, { size: as, fill: YELLOW, stroke: NAVY });
      ctx.restore();
    }
    // düşünen Geogo soruyla birlikte gelir, cevapta sevinçle zıplayan Geogo'ya döner
    const tin = outBack(prog(s, 0.7, 1.2)), tout = inCubic(prog(s, 3.1, 3.45));
    if (tin > 0 && tout < 1) {
      const mh = port ? H * 0.24 : mode === 'square' ? H * 0.36 : H * 0.44;
      const mx = port ? W / 2 : W * 0.88;
      this.mascot('geogo-dusunen', mx + (1 - tin) * W * 0.3, this.floor + tout * mh * 1.3, mh, s, { amp: 0.01 });
    }
    const mp = prog(s, 3.3, 3.9);
    if (mp > 0) {
      const mh = port ? H * 0.4 : mode === 'square' ? H * 0.5 : H * 0.58;
      const mx = port || mode === 'square' ? W / 2 : W * 0.83;
      const by = lerp(H + mh, this.floor, outBack(mp));
      this.mascot('geogo-mutlu', mx, by, mh, s, { amp: 0.06 });
    }
  }

  // ---------- 2) Marka: 6–10 sn ----------
  brand(s) {
    const { W, H, u, mode, ctx } = this;
    const [c1, c2, c3] = this.pal;
    this.background(s + 6, c1, c2, c3, { spin: 0.25 });
    const port = mode === 'port' || mode === 'square';
    const sqb = mode === 'square';
    const tx = port ? W / 2 : W * 0.6;
    const ty = sqb ? H * 0.19 : port ? H * 0.24 : H * 0.36;
    const title = 'GeoGames';
    const size = this.fit(title, port ? W * 0.86 : W * 0.56, 240 * u);
    ctx.font = `800 ${size}px ${DISPLAY}`;
    const total = ctx.measureText(title).width;
    let x = tx - total / 2;
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const cw = ctx.measureText(ch).width;
      const p = prog(s, 0.1 + i * 0.06, 0.55 + i * 0.06);
      if (p > 0) {
        const y = ty - (1 - outBack(p)) * 160 * u + Math.sin(s * 5 + i * 0.7) * 6 * u * p;
        ctx.save();
        ctx.globalAlpha = clamp(p * 2);
        this.text(ch, x + cw / 2, y, { size, fill: i < 3 ? '#fff' : YELLOW, stroke: NAVY, strokeW: size * 0.1 });
        ctx.restore();
        ctx.font = `800 ${size}px ${DISPLAY}`;
      }
      x += cw;
    }
    const sp = prog(s, 0.9, 1.3);
    if (sp > 0) {
      ctx.globalAlpha = sp;
      const ss = this.fit('Haritaları Keşfet, Dünyayı Öğren', port ? W * 0.86 : W * 0.48, 58 * u, 800, BODY);
      this.text('Haritaları Keşfet, Dünyayı Öğren', tx, ty + size * 0.62 + (1 - sp) * 30 * u, { size: ss, font: BODY, fill: '#fff' });
      ctx.globalAlpha = 1;
    }
    const bp = prog(s, 1.4, 1.8);
    if (bp > 0) {
      ctx.save();
      ctx.translate(tx, ty + size * 1.2);
      const k = outBack(bp);
      ctx.scale(k, k);
      this.pill(`${this.script.gameCount} ücretsiz eğitici oyun`, 0, 0, { size: 46 * u });
      ctx.restore();
    }
    const mp = prog(s, 0.3, 0.9);
    const mh = sqb ? H * 0.44 : port ? H * 0.36 : H * 0.58;
    const mx = port ? W / 2 : W * 0.17;
    this.mascot('geogo-sirt', lerp(-W * 0.4, mx, outBack(mp)), this.floor, mh, s);
  }

  // ---------- 3) Oyun montajı: 10–42 sn ----------
  montage(s) {
    const { W, H, u, mode, ctx } = this;
    const games = this.script.games;
    const i = Math.min(games.length - 1, Math.floor(s / CARD_LEN));
    const ls = s - i * CARD_LEN;
    const g = gameById(games[i]);
    const prev = gameById(games[Math.max(0, i - 1)]);
    const cp = i === 0 ? 1 : outCubic(prog(ls, 0, 0.45));
    const col = mix(prev.color, g.color, cp);
    const colHex = cp >= 1 ? g.color : prev.color;
    this.background(s + 10, shade(colHex === g.color ? g.color : prev.color, -0.55), col, shade(g.color, -0.25), {
      cx: mode === 'port' ? W / 2 : W * 0.3,
      cy: mode === 'port' ? H * 0.33 : H / 2,
      rayAlpha: 0.09,
    });

    const port = mode === 'port';
    const sq = mode === 'square';
    const img = this.images[g.id];
    const ph = port ? H * 0.45 : sq ? H * 0.54 : H * 0.68;
    const pcx = port ? W / 2 : sq ? W * 0.29 : W * 0.29;
    const pcy = port ? H * 0.34 : sq ? H * 0.47 : H * 0.46;
    const ein = prog(ls, 0, 0.55);
    const eout = prog(ls, CARD_LEN - 0.4, CARD_LEN);
    const last = i === games.length - 1;
    const ox = (1 - outBack(ein)) * W * 0.7 - (last ? 0 : inCubic(eout) * W * 0.8);
    const rot = (1 - outCubic(ein)) * 0.25 - (last ? 0 : inCubic(eout) * 0.2) + Math.sin(ls * 1.3) * 0.015;
    // arkada hafif ikinci kart (derinlik)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.translate(pcx + ox * 0.9 + 30 * u, pcy + 20 * u);
    ctx.rotate(rot + 0.08);
    const pw = (ph * (img ? img.width / img.height : 0.8));
    rr(ctx, -pw / 2, -ph / 2, pw, ph, 30 * u);
    ctx.fill();
    ctx.restore();
    this.card(img, pcx + ox, pcy - Math.sin(ls * 2) * 6 * u, ph, rot, 1, { zoom: 1 + ls * 0.012, shine: prog(ls, 0.6, 1.4), label: true, labelX: sq ? 0.2 : -0.2, t: ls });

    // kartın köşesinden bakan Geogo (her kartta farklı poz)
    const pose = CARD_MASCOTS[(i + this.script.seed) % CARD_MASCOTS.length];
    const mh = port ? H * 0.17 : sq ? H * 0.3 : H * 0.36;
    let mx = port ? W * 0.84 : sq ? W * 0.12 : pcx + pw * 0.42;
    const mb = port ? pcy + ph / 2 + H * 0.03 : this.floor;
    const pop = outBack(prog(ls, 0.45, 0.85));
    if (pop > 0) {
      if (pose === 'geogo-araba') mx -= (1 - outCubic(prog(ls, 0.3, 1.1))) * W * 0.8;
      const sc = pose === 'geogo-araba' ? 1 : pop;
      this.mascot(pose, mx + ox, mb, mh, ls, { scale: sc, amp: pose === 'geogo-araba' ? 0.015 : 0.05, flip: pose === 'geogo-sag' && sq });
    }

    // sayaç
    const cnt = `${i + 1} / ${games.length}`;
    const tp = outBack(prog(ls, 0.1, 0.4));
    // yazı bloğu
    const tx = port ? W / 2 : sq ? W * 0.55 : W * 0.55;
    const align = port ? 'center' : 'left';
    const maxW = port ? W * 0.88 : sq ? W * 0.41 : W * 0.4;
    const fadeOut = last ? 1 : 1 - prog(ls, CARD_LEN - 0.45, CARD_LEN - 0.15);
    ctx.save();
    ctx.globalAlpha = fadeOut;
    let y = port ? H * 0.62 : sq ? H * 0.3 : H * 0.3;
    if (tp > 0) {
      ctx.save();
      const cw = this.pillWidth(cnt, 30 * u);
      ctx.translate(port ? tx : tx + cw / 2, y);
      ctx.scale(tp, tp);
      this.pill(cnt, 0, 0, { size: 30 * u, bg: 'rgba(255,255,255,0.95)', fg: g.color });
      ctx.restore();
    }
    y += 100 * u;
    const titleSize = this.fit(g.title, maxW, (port ? 104 : sq ? 80 : 115) * u);
    const ttp = outCubic(prog(ls, 0.25, 0.65));
    if (ttp > 0) {
      ctx.globalAlpha = fadeOut * ttp;
      this.text(g.title, tx, y + (1 - ttp) * 50 * u, { size: titleSize, align, fill: '#fff', stroke: NAVY, strokeW: titleSize * 0.12 });
    }
    y += titleSize * 0.95;
    // kanca cümlesi: daktilo efekti
    const hs = (port ? 56 : sq ? 42 : 56) * u;
    const lines = this.wrap(g.hook, maxW, hs, 800, BODY);
    let n = Math.floor(Math.max(0, ls - 0.55) * 50);
    ctx.globalAlpha = fadeOut;
    for (const line of lines) {
      if (n <= 0) break;
      this.text(line.slice(0, n), tx, y, { size: hs, align, font: BODY, fill: YELLOW, shadow: true });
      n -= line.length + 1;
      y += hs * 1.25;
    }
    y = Math.max(y, (port ? H * 0.62 : sq ? H * 0.3 : H * 0.3) + 100 * u + titleSize * 0.95 + hs * 1.25 * lines.length);
    y += hs * 0.9;
    // rozetler
    const cs = (port ? 36 : sq ? 30 : 36) * u;
    const widths = g.tags.map((t) => this.pillWidth(t, cs));
    const gap = 16 * u;
    let rowW = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    let cx = port ? W / 2 - rowW / 2 : tx;
    let cy = y;
    g.tags.forEach((tag, k) => {
      if (!port && cx + widths[k] > tx + maxW) {
        cx = tx;
        cy += cs * 2.3;
      }
      const p = prog(ls, 1.0 + k * 0.15, 1.35 + k * 0.15);
      if (p > 0) {
        ctx.save();
        ctx.translate(cx + widths[k] / 2, cy);
        const k2 = outBack(p);
        ctx.scale(k2, k2);
        const smart = /tahta|Dokunmatik|sınıf|Sınıf/.test(tag);
        this.pill(tag, 0, 0, { size: cs, bg: smart ? YELLOW : '#fff', fg: NAVY });
        ctx.restore();
      }
      cx += widths[k] + gap;
    });
    // bağlantı
    const lp = prog(ls, 1.6, 2.0);
    if (lp > 0) {
      ctx.globalAlpha = fadeOut * lp;
      const url = `${SITE_URL}/oyun/${g.id}`;
      const us = this.fit('▶ ' + url, maxW, (port ? 34 : 30) * u, 700, BODY);
      this.text('▶ ' + url, tx, cy + cs * 2.4, { size: us, align, font: BODY, weight: 700, fill: 'rgba(255,255,255,0.9)', shadow: false });
    }
    ctx.restore();
  }

  // ---------- 4) Üç sütun: 42–51 sn ----------
  pillars(s) {
    const { W, H, u, mode, ctx } = this;
    const k = Math.min(2, Math.floor(s / 3));
    const ls = s - k * 3;
    const P = [
      { title: 'EĞİTİCİ', color: '#15803d', c2: '#22c55e', lines: ['Ders konularıyla uyumlu', 'KPSS • YKS • LGS hazırlığı', "TÜİK ve MGM'den gerçek veriler"] },
      { title: 'AKILLI TAHTA UYUMLU', color: '#1d4ed8', c2: '#0ea5e9', lines: ['Dokunmatik, kocaman butonlar', 'Tek ekranda iki takım', 'Kurulum yok, tarayıcıda açılır'] },
      { title: 'EĞLENCELİ', color: '#c2410c', c2: '#f59e0b', lines: ['Puan topla, rekor kır', 'Sınıfça canlı yarış', 'Her gün yeni bulmaca'] },
    ][k];
    this.background(s + 42, shade(P.color, -0.5), P.color, P.c2, { spin: 0.2, cx: mode === 'port' ? W / 2 : W * 0.3 });
    const port = mode === 'port';
    const ein = prog(ls, 0, 0.45);
    const eout = k < 2 ? prog(ls, 2.65, 3) : 0;
    const vx = port ? W / 2 : W * 0.28;
    const vy = port ? H * 0.32 : H * 0.47;
    const slide = (1 - outBack(ein)) * -W * 0.5 - inCubic(eout) * W * 0.6;

    // görsel
    ctx.save();
    ctx.translate(slide, 0);
    if (k === 0) {
      // haritasını inceleyen Geogo + A+ rozeti
      const mh = port ? H * 0.36 : mode === 'square' ? H * 0.46 : H * 0.62;
      const mb = port ? vy + mh * 0.5 : this.floor;
      this.mascot('geogo-harita', vx, mb, mh, s);
      const bp = outElastic(prog(ls, 0.5, 1.3));
      ctx.save();
      ctx.translate(vx - mh * 0.36, mb - mh * 0.85);
      ctx.scale(bp, bp);
      ctx.rotate(0.15);
      ctx.fillStyle = YELLOW;
      ctx.beginPath();
      ctx.arc(0, 0, 80 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 8 * u;
      ctx.strokeStyle = NAVY;
      ctx.stroke();
      this.text('A+', 0, 4 * u, { size: 80 * u, fill: '#16a34a', shadow: false });
      ctx.restore();
    } else if (k === 1) {
      const bw = port ? W * 0.8 : W * 0.42;
      this.smartBoard(vx, vy, bw, ls);
      // tahtanın yanında çubuğuyla gösteren öğretmen Geogo
      const mh = port ? H * 0.17 : mode === 'square' ? H * 0.3 : H * 0.36;
      const mp = outBack(prog(ls, 0.3, 0.7));
      const mx = port ? W * 0.82 : vx + bw * 0.5;
      const mb = port ? vy + bw * 0.6 * 0.5 + H * 0.1 : this.floor;
      this.mascot('geogo-ogretmen', mx, mb, mh, s, { scale: mp, amp: 0.02 });
    } else {
      const mh = port ? H * 0.36 : mode === 'square' ? H * 0.46 : H * 0.62;
      const mb = port ? vy + mh * 0.5 : this.floor;
      this.confettiBurst(vx, mb - mh * 0.6, ls);
      this.mascot('geogo-mutlu', vx, mb, mh, s, { amp: 0.1 });
      // skor sayacı
      const sc = Math.round(9850 * outCubic(prog(ls, 0.3, 2)));
      const sp = outBack(prog(ls, 0.2, 0.6));
      ctx.save();
      ctx.translate(vx - mh * 0.3, mb - mh * 1.02);
      ctx.scale(sp, sp);
      ctx.rotate(-0.1);
      this.pill('★ ' + sc.toLocaleString('tr-TR'), 0, 0, { size: 52 * u, bg: '#fff', fg: '#c2410c', border: YELLOW });
      ctx.restore();
    }
    ctx.restore();

    // metin
    const tx = port ? W / 2 : mode === 'square' ? W * 0.54 : W * 0.55;
    const align = port ? 'center' : 'left';
    const maxW = port ? W * 0.88 : mode === 'square' ? W * 0.43 : W * 0.41;
    let y = port ? H * 0.6 : H * 0.3;
    ctx.save();
    ctx.globalAlpha = 1 - eout;
    const np = outBack(prog(ls, 0.1, 0.4));
    if (np > 0) {
      const lab = `${k + 1}`;
      ctx.save();
      ctx.translate(port ? tx : tx + 45 * u, y);
      ctx.scale(np, np);
      ctx.fillStyle = YELLOW;
      ctx.beginPath();
      ctx.arc(0, 0, 45 * u, 0, Math.PI * 2);
      ctx.fill();
      this.text(lab, 0, 3 * u, { size: 60 * u, fill: NAVY, shadow: false });
      ctx.restore();
    }
    y += 120 * u;
    const ts = this.fit(P.title, maxW, (port ? 110 : 110) * u);
    const tp = outCubic(prog(ls, 0.2, 0.55));
    ctx.globalAlpha = (1 - eout) * tp;
    this.text(P.title, tx + (1 - tp) * 60 * u * (port ? 0 : 1), y, { size: ts, align, fill: '#fff', stroke: NAVY });
    y += ts * 0.9 + 20 * u;
    const ls2 = (port ? 50 : 46) * u;
    P.lines.forEach((line, j) => {
      const p = outCubic(prog(ls, 0.6 + j * 0.25, 0.95 + j * 0.25));
      if (p <= 0) return;
      ctx.globalAlpha = (1 - eout) * p;
      const fs = this.fit('✓ ' + line, maxW, ls2, 800, BODY);
      this.text('✓ ' + line, tx + (1 - p) * 40 * u, y + j * ls2 * 1.45, { size: fs, align, font: BODY, fill: j === 0 ? YELLOW : '#fff' });
    });
    ctx.restore();
  }

  smartBoard(cx, cy, bw, ls) {
    const { ctx, u } = this;
    const bh = bw * 0.6;
    const x = cx - bw / 2, y = cy - bh / 2;
    // ayak
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - bw * 0.03, y + bh, bw * 0.06, bh * 0.28);
    rr(ctx, cx - bw * 0.22, y + bh * 1.26, bw * 0.44, bh * 0.05, 10 * u);
    ctx.fill();
    // çerçeve
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 50 * u;
    ctx.shadowOffsetY = 20 * u;
    ctx.fillStyle = '#111827';
    rr(ctx, x, y, bw, bh, 26 * u);
    ctx.fill();
    ctx.restore();
    const pad = bw * 0.035;
    const sx = x + pad, sy = y + pad, sw = bw - pad * 2, sh = bh - pad * 2;
    ctx.save();
    rr(ctx, sx, sy, sw, sh, 12 * u);
    ctx.clip();
    const g = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    g.addColorStop(0, '#4338ca');
    g.addColorStop(1, '#7c3aed');
    ctx.fillStyle = g;
    ctx.fillRect(sx, sy, sw, sh);
    // iki takım yarışma ekranı
    const im1 = this.images['sinif-duellosu'], im2 = this.images['harita-royale'];
    const ph = sh * 0.86;
    [im1, im2].forEach((im, i) => {
      if (!im) return;
      const pw = (ph * im.width) / im.height;
      const px = sx + sw * (i ? 0.73 : 0.27) - pw / 2;
      const lift = i === 0 && ls > 0.8 && ls < 1.3 ? -8 * u : i === 1 && ls > 1.8 && ls < 2.3 ? -8 * u : 0;
      ctx.drawImage(im, px, sy + (sh - ph) / 2 + lift, pw, ph);
    });
    // skor şeridi
    ctx.fillStyle = 'rgba(15,27,61,0.85)';
    ctx.fillRect(sx, sy + sh - sh * 0.1, sw, sh * 0.1);
    const s1 = ls > 1 ? 3 : 2, s2 = ls > 2.1 ? 3 : 2;
    this.text(`KIRMIZI ${s1}  :  ${s2} MAVİ`, sx + sw / 2, sy + sh * 0.95, { size: sh * 0.06, font: BODY, fill: '#fff', shadow: false });
    ctx.restore();
    // dokunma efektleri
    const taps = [
      { t: 0.8, x: sx + sw * 0.27, y: sy + sh * 0.55 },
      { t: 1.8, x: sx + sw * 0.73, y: sy + sh * 0.45 },
    ];
    for (const tp of taps) {
      const p = prog(ls, tp.t, tp.t + 0.6);
      if (p > 0 && p < 1) {
        for (let r = 0; r < 2; r++) {
          const pp = clamp(p * 1.3 - r * 0.3);
          ctx.strokeStyle = `rgba(253,224,71,${1 - pp})`;
          ctx.lineWidth = 8 * u;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 20 * u + pp * 90 * u, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    // parmak işaretçisi
    let fx, fy;
    if (ls < 0.8) {
      const p = inOut(prog(ls, 0.2, 0.8));
      fx = lerp(sx + sw * 0.5, taps[0].x, p);
      fy = lerp(sy + sh * 1.1, taps[0].y, p);
    } else if (ls < 1.8) {
      const p = inOut(prog(ls, 1.1, 1.8));
      fx = lerp(taps[0].x, taps[1].x, p);
      fy = lerp(taps[0].y, taps[1].y, p) - Math.sin(p * Math.PI) * sh * 0.2;
    } else {
      fx = taps[1].x;
      fy = taps[1].y;
    }
    const press = [0.8, 1.8].some((tt) => ls > tt - 0.05 && ls < tt + 0.15) ? 0.85 : 1;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(press, press);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 6 * u;
    ctx.beginPath();
    ctx.arc(0, 0, 28 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(0, 0, 12 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  confettiBurst(cx, cy, ls) {
    const { ctx, u, H } = this;
    for (const c of this.confetti) {
      const dt = ls - 0.2 - c.delay;
      if (dt <= 0) continue;
      const sp = H * 0.9;
      const x = cx + c.vx * sp * dt;
      const y = cy + c.vy * sp * dt + 0.5 * H * 0.9 * dt * dt;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c.rot + c.vr * dt);
      ctx.fillStyle = c.c;
      ctx.fillRect(-10 * u * c.w, -5 * u, 20 * u * c.w, 10 * u);
      ctx.restore();
    }
  }

  // ---------- 5) Özellikler: 51–54 sn ----------
  features(s) {
    const { W, H, u, mode, ctx } = this;
    const [c1, c2] = this.pal;
    this.background(s + 51, NAVY, c1, c2, { spin: 0.3 });
    const port = mode === 'port';
    const items = [
      ['%100', 'Ücretsiz'],
      ['0 MB', 'İndirme yok'],
      ['3 ekran', 'Tahta • Tablet • Telefon'],
      [`${this.script.gameCount} oyun`, 'Okul öncesinden KPSS’ye'],
    ];
    const hp = outCubic(prog(s, 0, 0.35));
    ctx.globalAlpha = hp;
    const hs = this.fit('Hepsi tek adreste', W * 0.9, (port ? 100 : 90) * u);
    this.text('Hepsi tek adreste', W / 2, H * (port ? 0.2 : 0.17) + (1 - hp) * 40 * u, { size: hs, fill: '#fff', stroke: NAVY });
    ctx.globalAlpha = 1;
    const cols = port ? 1 : 2;
    const cw = port ? W * 0.8 : Math.min(W * 0.4, 700 * u);
    const ch = port ? H * 0.13 : H * 0.24;
    const gap = 30 * u;
    const gx = W / 2 - (cols * cw + (cols - 1) * gap) / 2;
    const gy = port ? H * 0.29 : H * 0.29;
    const accents = [YELLOW, '#4ade80', '#38bdf8', '#f472b6'];
    items.forEach(([big, small], i) => {
      const p = prog(s, 0.2 + i * 0.18, 0.6 + i * 0.18);
      if (p <= 0) return;
      const col = i % cols, row = Math.floor(i / cols);
      const x = gx + col * (cw + gap) + cw / 2;
      const y = gy + row * (ch + gap) + ch / 2;
      ctx.save();
      ctx.translate(x, y);
      const k = outBack(p);
      ctx.scale(k, k);
      ctx.rotate((i % 2 ? 1 : -1) * 0.02);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 30 * u;
      ctx.shadowOffsetY = 12 * u;
      ctx.fillStyle = '#fff';
      rr(ctx, -cw / 2, -ch / 2, cw, ch, 30 * u);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = accents[i];
      rr(ctx, -cw / 2, -ch / 2, 22 * u, ch, 11 * u);
      ctx.fill();
      if (port) {
        const bs = this.fit(big, cw * 0.4, 80 * u);
        this.text(big, -cw / 2 + 50 * u, 0, { size: bs, align: 'left', fill: NAVY, shadow: false });
        const ss = this.fit(small, cw * 0.5, 40 * u, 800, BODY);
        this.text(small, cw / 2 - 30 * u, 0, { size: ss, align: 'right', font: BODY, fill: '#334155', shadow: false });
      } else {
        const bs = this.fit(big, cw * 0.85, 110 * u);
        this.text(big, 0, -ch * 0.12, { size: bs, fill: NAVY, shadow: false });
        const ss = this.fit(small, cw * 0.85, 42 * u, 800, BODY);
        this.text(small, 0, ch * 0.27, { size: ss, font: BODY, fill: '#334155', shadow: false });
      }
      ctx.restore();
    });
  }

  // ---------- 6) Çağrı: 54–60 sn ----------
  cta(s) {
    const { W, H, u, mode, ctx } = this;
    const [c1, c2, c3] = this.pal;
    const port = mode === 'port' || mode === 'square';
    const sqc = mode === 'square';
    this.background(s + 54, c1, c2, c3, { spin: 0.45, rayAlpha: 0.1 });
    const beat = Math.pow(1 - ((s * 2) % 1), 3) * 0.035; // 120 BPM nabız
    // maskot
    const mp = prog(s, 0, 0.5);
    // dikeyde Geogo arabasıyla gelir, diğerlerinde dürbünüyle adresi gösterir
    if (mode === 'port') {
      const mh = H * 0.27;
      const drive = outCubic(prog(s, 0, 0.9));
      this.mascot('geogo-araba', lerp(-W * 0.6, W * 0.5, drive), this.floor, mh, s, { amp: 0.012 });
    } else {
      const mh = sqc ? H * 0.4 : H * 0.6;
      const mx = sqc ? W * 0.25 : W * 0.17;
      this.mascot('geogo-durbun', mx, lerp(H + mh, this.floor, outBack(mp)), mh, s, { amp: 0.05 });
    }

    const tx = port ? W / 2 : W * 0.53;
    const maxW = port ? W * 0.88 : W * 0.56;
    const ty = sqc ? H * 0.11 : port ? H * 0.17 : H * 0.24;
    const cp = outBack(prog(s, 0.15, 0.55));
    const cs = this.fit(this.script.cta, maxW, (port ? 96 : 96) * u);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(cp, cp);
    this.text(this.script.cta, 0, 0, { size: cs, fill: '#fff', stroke: NAVY });
    ctx.restore();

    // URL kutusu
    const up = outElastic(prog(s, 0.5, 1.4));
    const us = this.fit(SITE_URL, maxW * 0.8, (port ? 110 : 120) * u);
    ctx.font = `800 ${us}px ${DISPLAY}`;
    const uw = ctx.measureText(SITE_URL).width + us * 1.2;
    const uh = us * 1.6;
    const uy = ty + cs * 0.6 + uh * 0.75;
    const click = prog(s, 1.9, 2.1);
    ctx.save();
    ctx.translate(tx, uy);
    const k = up * (1 + beat) * (click > 0 && click < 1 ? 0.94 : 1);
    ctx.scale(k, k);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 40 * u;
    ctx.shadowOffsetY = 16 * u;
    ctx.fillStyle = '#fff';
    rr(ctx, -uw / 2, -uh / 2, uw, uh, uh / 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 10 * u;
    ctx.strokeStyle = YELLOW;
    rr(ctx, -uw / 2, -uh / 2, uw, uh, uh / 2);
    ctx.stroke();
    this.text(SITE_URL, 0, us * 0.04, { size: us, fill: NAVY, shadow: false });
    ctx.restore();
    // imleç tıklaması
    const cur = prog(s, 1.1, 1.9);
    if (cur > 0) {
      const ex = tx + uw * 0.3, ey = uy + uh * 0.2;
      const x = lerp(ex + W * 0.25, ex, inOut(cur));
      const y = lerp(ey + H * 0.3, ey, inOut(cur));
      const rp = prog(s, 1.95, 2.6);
      if (rp > 0 && rp < 1) {
        ctx.strokeStyle = `rgba(253,224,71,${1 - rp})`;
        ctx.lineWidth = 10 * u;
        ctx.beginPath();
        ctx.arc(ex, ey, 20 * u + rp * 140 * u, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(2.2 * u * (click > 0 && click < 1 ? 0.85 : 1), 2.2 * u * (click > 0 && click < 1 ? 0.85 : 1));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 34);
      ctx.lineTo(9, 26);
      ctx.lineTo(16, 40);
      ctx.lineTo(22, 37);
      ctx.lineTo(15, 23);
      ctx.lineTo(27, 23);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = NAVY;
      ctx.stroke();
      ctx.restore();
    }
    // alt satır + QR
    const sp = prog(s, 2.3, 2.8);
    if (sp > 0) {
      ctx.globalAlpha = sp;
      const line = 'Eğitici • Akıllı tahta uyumlu • Eğlenceli';
      const ls = this.fit(line, maxW, (port ? 44 : 44) * u, 800, BODY);
      this.text(line, tx, uy + uh * 1.08, { size: ls, font: BODY, fill: YELLOW });
      ctx.globalAlpha = 1;
    }
    const qp = outBack(prog(s, 2.8, 3.3));
    if (this.qr && qp > 0) {
      const qs = sqc ? H * 0.3 : port ? W * 0.3 : H * 0.24;
      const qx = sqc ? W * 0.72 : port ? W / 2 : tx;
      const qy = sqc ? H * 0.7 : port ? uy + uh * 1.35 + qs * 0.7 : uy + uh * 1.4 + qs * 0.6;
      ctx.save();
      ctx.translate(qx, qy);
      ctx.scale(qp, qp);
      this.drawQR(qs);
      ctx.restore();
    }
  }

  drawQR(size) {
    const { ctx, u } = this;
    const n = this.qr.getModuleCount();
    const pad = size * 0.08;
    const cell = (size - pad * 2) / n;
    ctx.fillStyle = '#fff';
    rr(ctx, -size / 2, -size / 2, size, size, 20 * u);
    ctx.fill();
    ctx.fillStyle = NAVY;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (this.qr.isDark(r, c)) ctx.fillRect(-size / 2 + pad + c * cell, -size / 2 + pad + r * cell, Math.ceil(cell), Math.ceil(cell));
    this.pill('Tara ve oyna', 0, size / 2 + 6 * u, { size: 24 * u });
  }
}
