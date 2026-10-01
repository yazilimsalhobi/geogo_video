# GeoGo Video

[geogames.site](https://geogames.site) için **60 saniyelik reklam videolarını** otomatik üreten sistem.
Videolar oyunların **eğitici**, **akıllı tahta uyumlu** ve **eğlenceli** olduğunu sıkmadan anlatır.

- **Stüdyo (canlı):** Vercel'deki `geogo_video` projesi — tarayıcıda önizle, kurgu/format seç, tek tıkla kaydet.
- **Otomasyon:** GitHub Actions her pazartesi tüm kurguları 1080p MP4 olarak üretir ve **Releases**'a yükler.

## Video kurgusu (60 sn)

| Zaman | Sahne | İçerik |
|---|---|---|
| 0–6 sn | Kanca | Soru → kırmızı damga → cevap, maskot Geogo zıplar |
| 6–10 sn | Marka | GeoGames logosu, "17 ücretsiz eğitici oyun" |
| 10–42 sn | Oyunlar | 8 oyun × 4 sn: afiş, ad, tek cümle, rozetler, bağlantı |
| 42–51 sn | 3 vaat | Eğitici • Akıllı tahta uyumlu (dokunmatik demo) • Eğlenceli |
| 51–54 sn | Özellikler | Ücretsiz, indirme yok, her ekranda, 17 oyun |
| 54–60 sn | Çağrı | geogames.site + QR kod (UTM'li) |

Müzik ve efektler koddan üretilir (120 BPM, telifsiz); sahne geçişleriyle senkrondur.

Her sahnenin altında kayan gökkuşağı şeritli, harfleri zıplayan **geogames.site** bandı vardır; her oyun kartında da sarı `geogames.site` etiketi bulunur.

**Geogo pozları** (`assets/mascot/`): düşünen (kanca sorusu), mutlu (cevap, Eğlenceli), sırt çantalı (marka), harita (Eğitici), öğretmen (akıllı tahta), dürbün (çağrı, yatay/kare), araba (çağrı, dikey) ve oyun kartlarının köşesinde dönüşümlü olarak araba, kamera, harita, dürbün, kışlık, işaret eden, mutlu, sırt çantalı.

## Kanal takibi

Stüdyoda **Paylaşılacak kanal** seçilince (Instagram, YouTube, TikTok, Facebook, WhatsApp, Telegram, Ücretli reklam) videodaki QR kod ve **paylaşım bağlantısı** o kanala göre UTM etiketi alır:

```
https://geogames.site/?utm_source=whatsapp&utm_medium=messaging&utm_campaign=geogo_video_ogretmen&utm_content=9x16_link
```

- `utm_source` / `utm_medium`: kanal
- `utm_campaign`: kurgu (genel, ogretmen, sinav, kesif, rastgele)
- `utm_content`: format + QR mı bağlantı mı (`9x16_qr`, `9x16_link`)

Google Analytics 4 → **Raporlar → Edinme → Trafik edinme** ekranında boyutu *Oturum kaynağı/aracı* ya da *Oturum kampanyası* yapın; hangi kanalın ve kurgunun ziyaretçi getirdiği görünür. Komut satırında: `--channel whatsapp,instagram` (her video için `.link.txt` dosyası da üretilir).

## Kurgular ve formatlar

| Kurgu | Hedef |
|---|---|
| `genel` | Genel tanıtım |
| `ogretmen` | Öğretmenler, akıllı tahta / sınıf yarışmaları |
| `sinav` | KPSS • YKS • LGS öğrencileri |
| `kesif` | Çocuklar ve aileler |
| `rastgele` | Seed'e göre rastgele 8 oyun + kanca |

Formatlar: `16x9` (YouTube, akıllı tahta), `9x16` (Reels/Shorts/TikTok), `1x1` (Instagram gönderi).

## Komutlar

```bash
npm install            # Puppeteer (headless Chrome) kurar
npm run dev            # Stüdyo: http://127.0.0.1:5173
npm run render         # out/geogo_genel_16x9_s1.mp4
npm run render:all     # tüm kurgular, 16:9 + 9:16
node scripts/render.mjs --preset ogretmen,sinav --format 9x16 --seed 42
```

`ffmpeg` PATH'te olmalıdır (veya `FFMPEG` ortam değişkeniyle yolu verin).

## Otomasyon

`.github/workflows/render.yml`

- **Zamanlı:** her pazartesi 06:00 UTC; seed = ISO hafta numarası, renk ve rastgele kurgu her hafta değişir.
- **Elle:** Actions → *Render videos* → *Run workflow* (kurgu, format, seed seçilebilir).
- Her kurgu × format ayrı bir işte paralel üretilir, sonra tek bir Release'te toplanır. Stüdyo sayfası son Release'teki videoları listeler.

## Yeni oyun eklemek

1. Afişi `assets/posters/<oyun-id>.webp` olarak ekleyin.
2. `src/games.js` içine oyunu ekleyin (başlık, tek cümlelik kanca, renk, 3 rozet).
3. İsterseniz `src/presets.js` içindeki kurguların oyun listelerine ekleyin.

## Yapı

```
index.html          Stüdyo arayüzü (önizleme + MediaRecorder kaydı)
render.html         Headless üretim sayfası
src/engine.js       Kare kare çizim motoru (draw(t) saf fonksiyon)
src/music.js        WebAudio müzik/efekt + WAV dışa aktarma
src/presets.js      Kurgular, formatlar, seed
src/games.js        Oyun kataloğu
scripts/render.mjs  Puppeteer + ffmpeg → MP4
scripts/serve.mjs   Bağımlılıksız statik sunucu
```
