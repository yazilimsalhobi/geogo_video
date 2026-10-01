// geogames.site oyun kataloğu (geogames-main/constants.ts ile senkron tutulur)
// tags: videoda kartın altında çıkan rozetler
export const SITE_URL = 'geogames.site';

export const GAMES = [
  { id: 'turkiye-il-bulma', title: 'Türkiye İl Bulma', hook: "81 ilin yerini haritada bul, rekor kır!", color: '#e11d48', tags: ['Harita', 'Süreli', 'Akıllı tahta'] },
  { id: 'avrupa', title: 'Avrupa Ülkeleri', hook: 'Avrupa haritasında ülkelerin yerini bul!', color: '#2563eb', tags: ['Harita', 'Dünya', 'Tüm sınıflar'] },
  { id: 'bayrak', title: 'Bayrak Bulmaca', hook: 'Bayrağı tanı, doğru ülkeyi seç!', color: '#dc2626', tags: ['Bayraklar', 'Kültür', 'Hızlı'] },
  { id: 'kpss-cografya', title: 'KPSS Coğrafya', hook: 'KPSS & YKS için yüzlerce coğrafya sorusu!', color: '#0891b2', tags: ['KPSS', 'YKS', 'Sınav'] },
  { id: 'adam-asmaca', title: 'Bayraklı Adam Asmaca', hook: 'Bayrağı gör, ülkenin adını harf harf bul!', color: '#db2777', tags: ['Kelime', '193 ülke', 'Dokunmatik'] },
  { id: 'rota-kur', title: 'Rota Kur', hook: 'Komşu illerden geçerek en kısa rotayı kur!', color: '#16a34a', tags: ['Komşu iller', '7 bölge', 'Strateji'] },
  { id: 'iklim-grafigi', title: 'Günün İklim Grafiği', hook: 'Sıcaklık ve yağış grafiğinden şehri bul!', color: '#ea580c', tags: ['İklim', 'MGM verisi', 'Her gün yeni'] },
  { id: 'hafizadan-ciz', title: 'Hafızadan Çiz', hook: "Türkiye'yi çiz, yüzde kaç doğru olduğunu gör!", color: '#7c3aed', tags: ['Çizim', 'Harita', 'Akıllı tahta'] },
  { id: 'gercek-boyut', title: 'Gerçek Boyut', hook: 'Grönland gerçekten Afrika kadar büyük mü?', color: '#0d9488', tags: ['Projeksiyon', 'Sürükle-bırak', 'Keşif'] },
  { id: 'episantr-avcisi', title: 'Episantr Avcısı', hook: 'Sismogramı oku, depremin merkezini bul!', color: '#b45309', tags: ['Deprem', 'Gerçek veri', 'Bilim'] },
  { id: 'harita-royale', title: 'Harita Royale', hook: 'Güvenli bölge daralıyor, son kalan kazanır!', color: '#9333ea', tags: ['Canlı sınıf', '150 kişi', 'Telefonla katıl'] },
  { id: 'kervan-yolu', title: 'Kervan Yolu', hook: 'Çağlar boyu ticaret yollarında zenginleş!', color: '#a16207', tags: ['Tarih', 'Strateji', '14 dönem'] },
  { id: 'sinif-duellosu', title: 'Sınıf Düellosu', hook: 'Tek ekranda iki takım, ilk doğru cevap kazanır!', color: '#4f46e5', tags: ['İki takım', 'Akıllı tahta', 'Sınıf'] },
  { id: 'seyahat-acentesi', title: 'Seyahat Acentesi', hook: 'Müşterinin isteğine uyan ülkeyi bul!', color: '#0284c7', tags: ['Ülkeler', 'İpucu', 'Keşif'] },
  { id: 'geogo-nerede', title: 'Geogo Nerede?', hook: 'Kartpostal ipuçlarından ülkeyi tahmin et!', color: '#059669', tags: ['Kültür', '65 ülke', 'Keşif'] },
  { id: 'uretim-kartlari', title: 'Tarım Kartları', hook: 'Fındık, çay, pamuk… Hangi ürün nerede?', color: '#65a30d', tags: ['TÜİK verisi', 'Ekonomi', 'KPSS'] },
  { id: 'sirala', title: 'Sırala!', hook: 'İlleri nüfusa ve büyüklüğe göre sırala!', color: '#c026d3', tags: ['TÜİK 2025', 'Mantık', 'İller'] },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
