// Tarayıcıda standart MP4 üretimi (WebCodecs + mp4-muxer).
// MediaRecorder'ın ürettiği dosyalarda süre/indeks bilgisi eksik olduğu için telefonlar ve
// Instagram yalnızca ilk saniyeleri okuyabiliyordu. Burada her kare draw(t) ile çizilip H.264'e,
// müzik AAC'ye kodlanır ve süre bilgisi dosyanın başına yazılır (faststart).
// Kare kare çalıştığı için gerçek zamandan hızlıdır ve sekme arka planda kalsa da bozulmaz.
import { DURATION, FPS } from './engine.js';
import { renderSoundtrack } from './music.js';

const AVC_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640033'];

export function canExportMp4() {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof window.Mp4Muxer !== 'undefined';
}

async function pickVideoConfig(width, height) {
  for (const codec of AVC_CODECS) {
    const cfg = { codec, width, height, bitrate: 6_000_000, bitrateMode: 'variable', framerate: FPS, avc: { format: 'avc' } };
    try {
      const { supported } = await VideoEncoder.isConfigSupported(cfg);
      if (supported) return cfg;
    } catch {}
  }
  return null;
}

async function pickAudioConfig() {
  const cfg = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 160_000 };
  try {
    const { supported } = await AudioEncoder.isConfigSupported(cfg);
    return supported ? cfg : null;
  } catch {
    return null;
  }
}

// video: yüklenmiş GeoGoVideo örneği. onProgress(0..1)
export async function exportMp4(video, { onProgress = () => {} } = {}) {
  const { width, height } = video.canvas;
  const vcfg = await pickVideoConfig(width, height);
  if (!vcfg) throw new Error('Bu tarayıcı H.264 video kodlamayı desteklemiyor.');
  const acfg = await pickAudioConfig();
  if (!acfg) throw new Error('Bu tarayıcı AAC ses kodlamayı desteklemiyor.');

  const { Muxer, ArrayBufferTarget } = window.Mp4Muxer;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height, frameRate: FPS },
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate: acfg.sampleRate },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let failed = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (failed = e) });
  venc.configure(vcfg);
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (failed = e) });
  aenc.configure(acfg);

  // ses: müziği tamamen çevrimdışı üret, 1024 örneklik parçalar halinde kodla
  const buf = await renderSoundtrack(acfg.sampleRate);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const step = 1024;
  for (let i = 0; i < buf.length; i += step) {
    const n = Math.min(step, buf.length - i);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(i, i + n), 0);
    data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: acfg.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / acfg.sampleRate) * 1e6), data });
    aenc.encode(ad);
    ad.close();
  }

  // görüntü: her kareyi çiz → kodla (kuyruk dolarsa bekle)
  const total = Math.round(DURATION * FPS);
  const frameDur = 1e6 / FPS;
  for (let f = 0; f < total; f++) {
    if (failed) throw failed;
    video.draw(f / FPS);
    const frame = new VideoFrame(video.canvas, { timestamp: Math.round(f * frameDur), duration: Math.round(frameDur) });
    venc.encode(frame, { keyFrame: f % (FPS * 2) === 0 });
    frame.close();
    while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 1));
    if (f % 10 === 0) {
      onProgress(f / total);
      await new Promise((r) => setTimeout(r, 0)); // arayüz donmasın
    }
  }
  await venc.flush();
  await aenc.flush();
  if (failed) throw failed;
  muxer.finalize();
  onProgress(1);
  return new Blob([target.buffer], { type: 'video/mp4' });
}
