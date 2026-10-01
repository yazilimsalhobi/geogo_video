// Post yazısı üretici: kurgu + kanal + videodaki oyunlara göre emojili, hashtag'li,
// her seferinde farklı paylaşım metinleri üretir. Tamamen şablon tabanlıdır (API gerekmez).
import { gameById, SITE_URL } from './games.js';
import { mulberry32 } from './presets.js';

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const shuffle = (r, arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Oyun başına emoji
const GAME_EMOJI = {
  'turkiye-il-bulma': '🗺️', avrupa: '🇪🇺', bayrak: '🚩', 'kpss-cografya': '📝', 'adam-asmaca': '🎈',
  'rota-kur': '🛣️', 'iklim-grafigi': '🌦️', 'hafizadan-ciz': '✏️', 'gercek-boyut': '🌍', 'episantr-avcisi': '🌋',
  'harita-royale': '👑', 'kervan-yolu': '🐫', 'sinif-duellosu': '⚔️', 'seyahat-acentesi': '✈️',
  'geogo-nerede': '🧭', 'uretim-kartlari': '🌾', sirala: '📊',
};

const HOOKS = {
  genel: [
    'Coğrafya dersi sıkıcı mı? Artık değil! 🎉',
    'Haritalar hiç bu kadar eğlenceli olmamıştı 🗺️✨',
    'Oyna, keşfet, öğren! 🌍🎮',
    'Ders çalışmak mı, oyun oynamak mı? İkisi birden! 😎',
    'Dünyayı ekrandan keşfetmeye hazır mısın? 🚀',
  ],
  ogretmen: [
    'Öğretmenler, sınıfın dikkatini 1 dakikada toplamanın yolu burada 👩‍🏫👨‍🏫',
    'Akıllı tahtaya bir oyun açın, sınıf bir anda canlansın! 🖥️⚡',
    'Ders sonu 10 dakika kaldı mı? İşte sınıfça oynanacak coğrafya oyunları 🏆',
    'İki takım, tek ekran, kocaman bir heyecan! ⚔️🎉',
    'Kurulum yok, indirme yok: akıllı tahtada aç ve oyna! 🙌',
  ],
  sinav: [
    'KPSS, YKS, LGS coğrafyası ezberle bitmiyor mu? 📚😩',
    'Haritada gör, kalıcı öğren! Sınava oynayarak hazırlan 🎯',
    'Coğrafya netlerini oyunla artırmaya ne dersin? 📈',
    'İklim grafikleri, tarım ürünleri, il sıralamaları… Hepsi oyun olarak burada! 🧠',
    'Sınav stresi yerine oyun keyfi 😌 Coğrafyayı eğlenerek tekrar et!',
  ],
  kesif: [
    'Dünyayı gezmeye hazır mısın? Geogo seni bekliyor! 🧭🌍',
    'Bayraklar, ülkeler, kartpostallar… Haydi keşfe çıkalım! ✈️',
    'Çocuklar için hem eğlenceli hem öğretici oyunlar 🧒👧🎈',
    'Ekran süresi öğrenme süresine dönüşsün! 💡',
    'Geogo dünyayı geziyor, sen de katıl! 📸🌎',
  ],
};

const BENEFITS = [
  '✅ Tamamen ücretsiz',
  '✅ İndirme ve kurulum yok, tarayıcıda açılır',
  '✅ Akıllı tahta, tablet ve telefonla uyumlu',
  '✅ Ders konularıyla uyumlu içerik',
  '✅ Puan topla, rekor kır, sınıfça yarış',
  '✅ TÜİK ve MGM verileriyle gerçek bilgiler',
  '✅ Okul öncesinden KPSS’ye her seviyeye uygun',
];

const CTAS = [
  '👉 Hemen dene: {url}',
  '🎮 Şimdi oyna: {url}',
  '🔗 Ücretsiz oyunlar: {url}',
  '🚀 Hadi başla: {url}',
  '📲 Tıkla ve oyna: {url}',
];

const ENGAGE = [
  'Sen hangisini ilk denerdin? Yorumlara yaz 👇',
  'Sınıfında denemek isteyen öğretmen arkadaşını etiketle 🏷️',
  'Kaydet, derste lazım olacak 📌',
  'Rekorunu yorumlara bırak! 🏆',
  'Bu oyunlardan hangisi senin favorin? 💬',
];

const TAGS = {
  base: ['#geogames', '#coğrafya', '#eğitim', '#eğiticioyunlar', '#oyunlaöğren', '#harita'],
  genel: ['#öğrenci', '#ders', '#türkiye', '#dünya', '#bilgiyarışması', '#eğlenceliöğrenme'],
  ogretmen: ['#öğretmen', '#öğretmenler', '#akıllıtahta', '#sınıfetkinliği', '#sosyalbilgiler', '#coğrafyaöğretmeni', '#eğitimteknolojileri', '#dersmateryali'],
  sinav: ['#kpss', '#yks', '#lgs', '#ayt', '#tyt', '#kpsscoğrafya', '#sınavahazırlık', '#netartır'],
  kesif: ['#çocuk', '#çocukoyunları', '#bayraklar', '#ülkeler', '#keşfet', '#evdeöğrenme', '#ebeveyn'],
};

// Kanal biçimleri
const CHANNEL_STYLE = {
  genel: { tags: 10, len: 'medium' },
  instagram: { tags: 15, len: 'long', linkInBio: true },
  tiktok: { tags: 5, len: 'short' },
  youtube: { tags: 8, len: 'long', title: true },
  facebook: { tags: 4, len: 'long' },
  whatsapp: { tags: 0, len: 'short' },
  telegram: { tags: 3, len: 'medium' },
  reklam: { tags: 0, len: 'short', ad: true },
};

const YT_TITLES = {
  genel: ['Coğrafyayı Oyunla Öğren! 🌍 Ücretsiz Eğitici Oyunlar | GeoGames', '17 Ücretsiz Coğrafya Oyunu 🎮 Haritalar Hiç Bu Kadar Eğlenceli Olmamıştı'],
  ogretmen: ['Akıllı Tahta İçin Ücretsiz Coğrafya Oyunları 🖥️ Sınıf Etkinliği | GeoGames', 'Sınıfça Oynanan Coğrafya Yarışması ⚔️ Öğretmenler İçin Ücretsiz'],
  sinav: ['KPSS YKS LGS Coğrafya: Oynayarak Tekrar Et 🎯 | GeoGames', 'Coğrafya Netlerini Oyunla Artır 📈 Ücretsiz Sınav Hazırlık Oyunları'],
  kesif: ['Çocuklar İçin Eğitici Dünya Oyunları 🧭 Bayraklar, Ülkeler, Haritalar', 'Geogo ile Dünyayı Keşfet! ✈️ Ücretsiz Çocuk Coğrafya Oyunları'],
};

function gameLines(r, ids, n) {
  return shuffle(r, ids).slice(0, n).map((id) => {
    const g = gameById(id);
    return `${GAME_EMOJI[id] || '🎮'} ${g.title} → ${g.hook}`;
  });
}

function hashtags(r, preset, n) {
  if (!n) return '';
  const pool = [...new Set([...TAGS.base, ...(TAGS[preset] || TAGS.genel), ...shuffle(r, TAGS.genel)])];
  const head = TAGS.base.slice(0, 2);
  const rest = shuffle(r, pool.filter((t) => !head.includes(t)));
  return [...head, ...rest].slice(0, n).join(' ');
}

// Tek bir post metni üretir
export function generateCaption({ preset = 'genel', channel = 'genel', games = [], link = `https://${SITE_URL}`, seed = 1, hookIndex = null }) {
  const r = mulberry32(seed * 7919 + 13);
  const st = CHANNEL_STYLE[channel] || CHANNEL_STYLE.genel;
  const hookKey = HOOKS[preset] ? preset : pick(r, Object.keys(HOOKS));
  const hook = hookIndex == null ? pick(r, HOOKS[hookKey]) : HOOKS[hookKey][hookIndex % HOOKS[hookKey].length];
  const url = st.linkInBio ? `${SITE_URL} (bağlantı profilde)` : link;
  const cta = pick(r, CTAS).replace('{url}', url);
  const parts = [];

  if (st.title) parts.push(`📺 Başlık: ${pick(r, YT_TITLES[hookKey])}`, '');
  parts.push(hook);

  if (st.len === 'short') {
    const g = gameLines(r, games, st.ad ? 1 : 2);
    parts.push('', ...g, '', cta);
  } else if (st.len === 'medium') {
    parts.push('', ...gameLines(r, games, 3), '', ...shuffle(r, BENEFITS).slice(0, 2), '', cta);
  } else {
    parts.push('', ...gameLines(r, games, 4), '', ...shuffle(r, BENEFITS).slice(0, 3), '', cta, '', pick(r, ENGAGE));
  }
  if (st.ad) parts.push('', '🎁 Ücretsiz • İndirme yok • Her ekranda çalışır');
  const tags = hashtags(r, hookKey, st.tags);
  if (tags) parts.push('', tags);
  if (channel === 'youtube') parts.push('', '🏷️ Etiketler: ' + hashtags(r, hookKey, 15).replace(/#/g, '').split(' ').join(', '));
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Aynı ayarlarla birbirinden farklı n metin
export function generateCaptions(opts, n = 3) {
  const base = (opts.seed || 1) * 101;
  const start = ((opts.seed || 1) * 3) % 5; // her yenilemede kanca sırası kayar
  return Array.from({ length: n }, (_, i) => generateCaption({ ...opts, seed: base + i * 7, hookIndex: start + i }));
}
