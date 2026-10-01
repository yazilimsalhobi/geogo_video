import { GAMES } from './games.js';

// Her kurgu (preset) = aynı 60 sn iskelet + farklı kanca, oyun seçimi ve vurgu.
export const PRESETS = {
  genel: {
    label: 'Genel Tanıtım',
    hook: { q: ['Coğrafya dersi', 'sıkıcı mı?'], stamp: 'ARTIK DEĞİL!', a: 'Oyna • Keşfet • Öğren' },
    games: ['turkiye-il-bulma', 'harita-royale', 'sinif-duellosu', 'iklim-grafigi', 'hafizadan-ciz', 'gercek-boyut', 'episantr-avcisi', 'kervan-yolu'],
    cta: 'Hemen ücretsiz oyna!',
  },
  ogretmen: {
    label: 'Öğretmenler İçin',
    hook: { q: ['Sınıfın dikkatini', 'toplamak zor mu?'], stamp: 'ÇÖZÜM BURADA!', a: 'Akıllı tahtaya bir oyun aç!' },
    games: ['sinif-duellosu', 'harita-royale', 'rota-kur', 'hafizadan-ciz', 'episantr-avcisi', 'uretim-kartlari', 'sirala', 'iklim-grafigi'],
    cta: 'Bugünkü derste deneyin!',
  },
  sinav: {
    label: 'KPSS • YKS • LGS',
    hook: { q: ['Coğrafya ezberi', 'bitmiyor mu?'], stamp: 'OYNAYARAK ÖĞREN!', a: 'Haritada gör, kalıcı öğren' },
    games: ['kpss-cografya', 'iklim-grafigi', 'uretim-kartlari', 'sirala', 'turkiye-il-bulma', 'episantr-avcisi', 'gercek-boyut', 'rota-kur'],
    cta: 'Sınava oynayarak hazırlan!',
  },
  kesif: {
    label: 'Çocuklar & Keşif',
    hook: { q: ['Dünyayı gezmeye', 'hazır mısın?'], stamp: 'HADİ BAŞLAYALIM!', a: 'Geogo ile keşfe çık!' },
    games: ['geogo-nerede', 'seyahat-acentesi', 'adam-asmaca', 'bayrak', 'avrupa', 'gercek-boyut', 'kervan-yolu', 'hafizadan-ciz'],
    cta: 'Maceraya şimdi katıl!',
  },
  rastgele: {
    label: 'Rastgele (seed)',
    hook: null, // seed ile diğer kurgulardan seçilir
    games: null, // seed ile 8 oyun seçilir
    cta: null,
  },
};

export const FORMATS = {
  '16x9': { w: 1920, h: 1080, label: 'Yatay 16:9 (YouTube, akıllı tahta)' },
  '9x16': { w: 1080, h: 1920, label: 'Dikey 9:16 (Reels, Shorts, TikTok)' },
  '1x1': { w: 1080, h: 1080, label: 'Kare 1:1 (Instagram gönderi)' },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Kurgu + seed → çizilecek somut senaryo
export function buildScript({ preset = 'genel', seed = 1, games = null } = {}) {
  const rnd = mulberry32(seed * 9973 + 17);
  const base = PRESETS[preset] || PRESETS.genel;
  const named = Object.values(PRESETS).filter((p) => p.hook);
  const pick = named[Math.floor(rnd() * named.length)];
  let list = games && games.length ? games : base.games;
  if (!list) {
    const ids = GAMES.map((g) => g.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    list = ids.slice(0, 8);
  }
  list = list.slice(0, 8);
  while (list.length < 8) list = list.concat(list).slice(0, 8);
  return {
    preset,
    seed,
    hook: base.hook || pick.hook,
    cta: base.cta || pick.cta,
    games: list,
    gameCount: GAMES.length,
    palette: Math.floor(rnd() * 3),
  };
}
