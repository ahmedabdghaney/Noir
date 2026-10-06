/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Noir streams client — يتعامل مع خادم الأفلام والترجمة العربية
 * على api.aswad-iq.com. هذا هو نفس عقد الـ API المستخدم بتطبيق iOS:
 *
 *   GET /api/streams/movie/{tmdbId}
 *   GET /api/streams/series/{tmdbId}?season={s}&episode={e}
 *   GET /api/playback/arabic/prepare?type=&tmdbId=&imdbId=&stream=[&season=&episode=]
 *
 * ملاحظات أمان: ما نضع أي مفتاح TMDB/OpenSubtitles هنا. الطلبات بس GET
 * عامة عبر HTTPS للخادم العام. ما نطبع روابط/هيدرز حساسة بالـ console.
 */

import { fetchImdbId } from './tmdb';

// الرابط العام للخادم — لا نحوّله أبداً إلى localhost أو عنوان الماك.
export const NOIR_API_BASE = 'https://api.aswad-iq.com';

export interface NoirSubtitle {
  url: string;
  lang?: string;
  label?: string;
  format?: string;
}

export interface NoirStream {
  // رابط التشغيل. يمر عبر proxy الخادم (ts-proxy / m3u8-proxy) لإزالة قيود
  // Referer/Origin، فلا ينتهي بالضرورة بـ .m3u8.
  url: string;
  // هل الرابط HLS؟ نحدده من مسار m3u8-proxy أو امتداد .m3u8.
  isHls: boolean;
  // هل هو مصدر embed (iframe) بدل تشغيل native؟
  isEmbed: boolean;
  // مزوّد المصدر (StreamFlix / Vidlink / Vixsrc / Vidy / Vidcore ...).
  provider?: string;
  // الاسم/العنوان والجودة كما يرجّعها الخادم.
  name?: string;
  title?: string;
  quality?: string;
  // ترجمات مرفقة بالمصدر (قد تحتوي عربي).
  subtitles?: NoirSubtitle[];
  raw?: any;
}

export interface NoirStreamsResult {
  streams: NoirStream[];
  // IMDb لو رجّعه الخادم ضمن الاستجابة — يوفّر علينا طلب TMDB.
  imdbId?: string | null;
}

export interface ArabicPrepareResult {
  // رابط الـ master.m3u8 الجديد اللي يحتوي الفيديو + مسار الترجمة العربية.
  url: string;
}

// مزوّدات الـ embed (iframe) — تُعرف بالاسم. Vidy/Vidcore احتياط فقط.
const EMBED_PROVIDERS = ['vidcore', 'vidy', 'embed'];

/**
 * هل الرابط HLS؟ البنية الحقيقية تمرّر الروابط عبر proxy الخادم:
 *   m3u8-proxy?url=...  → HLS (playlist)
 *   ts-proxy?url=...     → ملف مباشر (mp4/mkv) أو مقطع
 * فالمؤشر الموثوق هو مسار m3u8-proxy، أو وجود .m3u8 بأي مكان بالرابط.
 */
function looksLikeHls(url: string): boolean {
  return /m3u8-proxy/i.test(url) || /\.m3u8(\?|$|&)/i.test(url);
}

function normalizeSubtitle(raw: any): NoirSubtitle | null {
  if (!raw) return null;
  const url = typeof raw === 'string' ? raw : raw.url || raw.file || raw.src || '';
  if (!url) return null;
  return {
    url,
    lang: raw.lang || raw.language || undefined,
    label: raw.label || undefined,
    format: raw.format || undefined,
  };
}

/**
 * يحوّل عنصر stream خام من الخادم إلى NoirStream موحّد.
 * مثبّت على البنية الحقيقية: { name, title, url, quality, provider, subtitles? }.
 */
function normalizeStream(raw: any): NoirStream | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return { url: raw, isHls: looksLikeHls(raw), isEmbed: false, raw };
  }
  const url: string = raw.url || raw.file || raw.link || raw.src || '';
  if (!url || typeof url !== 'string') return null;

  const provider: string | undefined = raw.provider || raw.name || undefined;
  const providerLc = (provider || '').toLowerCase();
  const isEmbed = raw.embed === true || EMBED_PROVIDERS.some((p) => providerLc.includes(p));
  const isHls = looksLikeHls(url);

  const subtitles = Array.isArray(raw.subtitles)
    ? raw.subtitles.map(normalizeSubtitle).filter((s: NoirSubtitle | null): s is NoirSubtitle => s !== null)
    : undefined;

  return {
    url,
    isHls,
    isEmbed,
    provider,
    name: raw.name || undefined,
    title: raw.title || undefined,
    quality: raw.quality || undefined,
    subtitles,
    raw,
  };
}

function parseStreamsResponse(data: any): NoirStreamsResult {
  const arr: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.streams)
      ? data.streams
      : Array.isArray(data?.sources)
        ? data.sources
        : [];
  const streams = arr
    .map(normalizeStream)
    .filter((s): s is NoirStream => s !== null);
  const imdbId = data?.imdbId || data?.imdb_id || data?.imdb || null;
  return { streams, imdbId };
}

async function getJson(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Noir API ${res.status}`);
  return res.json();
}

/** يجيب مصادر فيلم. */
export async function fetchMovieStreams(
  tmdbId: number,
  signal?: AbortSignal,
): Promise<NoirStreamsResult> {
  const data = await getJson(`${NOIR_API_BASE}/api/streams/movie/${tmdbId}`, signal);
  return parseStreamsResponse(data);
}

/** يجيب مصادر حلقة مسلسل. */
export async function fetchSeriesStreams(
  tmdbId: number,
  season: number,
  episode: number,
  signal?: AbortSignal,
): Promise<NoirStreamsResult> {
  const qs = new URLSearchParams({
    season: String(season),
    episode: String(episode),
  });
  const data = await getJson(
    `${NOIR_API_BASE}/api/streams/series/${tmdbId}?${qs}`,
    signal,
  );
  return parseStreamsResponse(data);
}

/**
 * يرتّب المصادر القابلة للتشغيل native (غير embed) للتجربة بالتسلسل:
 * HLS (m3u8-proxy) أولاً، بعدها بقية المصادر المباشرة (ts-proxy/mp4/mkv).
 * المشغل يجرّب الأول، وعند فشله ينتقل للتالي، وهكذا — وإذا فشل الكل ينتقل لـ embed.
 */
export function orderNativeStreams(streams: NoirStream[]): NoirStream[] {
  const native = streams.filter((s) => !s.isEmbed);
  return [
    ...native.filter((s) => s.isHls),
    ...native.filter((s) => !s.isHls),
  ];
}

/** أول رابط HLS native (للتوافق/الاستخدام المباشر). */
export function pickFirstHlsStream(streams: NoirStream[]): NoirStream | null {
  return streams.find((s) => !s.isEmbed && s.isHls) || null;
}

/** يرجّع مصادر الـ embed الاحتياطية بالترتيب (Vidcore ثم Vidy). */
export function pickEmbedStreams(streams: NoirStream[]): NoirStream[] {
  const embeds = streams.filter((s) => s.isEmbed);
  const order = ['vidcore', 'vidy'];
  return embeds.sort((a, b) => {
    const ai = order.findIndex((p) => (a.provider || '').toLowerCase().includes(p));
    const bi = order.findIndex((p) => (b.provider || '').toLowerCase().includes(p));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

export interface PrepareArabicParams {
  type: 'movie' | 'tv';
  tmdbId: number;
  imdbId?: string | null;
  stream: string;   // رابط HLS المختار
  season?: number;
  episode?: number;
}

/**
 * يطلب من الخادم تجهيز نسخة HLS فيها مسار ترجمة عربية متزامنة.
 * يرجّع { url } لرابط master.m3u8 الجديد. يرمي خطأ لو فشل التجهيز —
 * المتصل يتعامل مع الفشل بتشغيل الرابط الأصلي بدون ادعاء وجود العربية.
 *
 * نرسل type بقيمة 'movie' أو 'series' حسب عقد الخادم.
 */
export async function prepareArabicSubtitles(
  params: PrepareArabicParams,
  signal?: AbortSignal,
): Promise<ArabicPrepareResult> {
  const qs = new URLSearchParams();
  qs.set('type', params.type === 'tv' ? 'series' : 'movie');
  qs.set('tmdbId', String(params.tmdbId));
  if (params.imdbId) qs.set('imdbId', params.imdbId);
  qs.set('stream', params.stream);
  if (params.type === 'tv') {
    if (params.season != null) qs.set('season', String(params.season));
    if (params.episode != null) qs.set('episode', String(params.episode));
  }
  const data = await getJson(
    `${NOIR_API_BASE}/api/playback/arabic/prepare?${qs}`,
    signal,
  );
  const url = data?.url;
  if (!url || typeof url !== 'string') {
    throw new Error('Arabic prepare: no url in response');
  }
  return { url };
}

export interface PlayableSource {
  // الرابط النهائي للتشغيل.
  url: string;
  // هل الترجمة العربية مُجهّزة فعلاً بهذا الرابط (عبر prepare)؟
  arabicReady: boolean;
  // المصدر الأصلي (قبل تجهيز العربية) — للمرجع.
  origin: NoirStream;
}

export interface ResolvedPlayback {
  // قائمة المصادر native القابلة للتشغيل، مرتّبة للتجربة بالتسلسل.
  // أول عنصر هو المفضّل (HLS مع العربية لو تجهّزت).
  sources: PlayableSource[];
  // مصادر embed احتياطية (Vidcore ثم Vidy) لو فشلت كل مصادر native.
  embeds: NoirStream[];
  imdbId: string | null;
}

/**
 * التدفق الكامل لتحديد ما يُشغَّل، مطابق لتطبيق iOS:
 * 1) يجيب المصادر من الخادم.
 * 2) يرتّب مصادر native (HLS أولاً، بعدها المباشرة) للتجربة بالتسلسل.
 * 3) يجيب IMDb (من الخادم لو رجّعه، وإلا من TMDB).
 * 4) للمصدر HLS المفضّل يطلب تجهيز الترجمة العربية؛ لو نجح يصير رابط التشغيل
 *    هو master.m3u8 الجديد (عربية جاهزة)، ولو فشل يبقى الرابط الأصلي بلا ادعاء.
 *    بقية المصادر تبقى كما هي للتجربة عند فشل الأول.
 * 5) المشغل يجرّب المصادر بالترتيب؛ إذا فشلت كلها ينتقل لـ embeds (Vidy).
 *
 * فشل الخادم نفسه (شبكة/خطأ) يُرمى للمتصل (خطأ + إعادة محاولة) ولا يتحوّل
 * تلقائياً لـ embed.
 */
export async function resolvePlayback(
  type: 'movie' | 'tv',
  tmdbId: number,
  opts: { season?: number; episode?: number; signal?: AbortSignal } = {},
): Promise<ResolvedPlayback> {
  const { season = 1, episode = 1, signal } = opts;

  const streamsResult =
    type === 'tv'
      ? await fetchSeriesStreams(tmdbId, season, episode, signal)
      : await fetchMovieStreams(tmdbId, signal);

  const embeds = pickEmbedStreams(streamsResult.streams);
  const native = orderNativeStreams(streamsResult.streams);

  // IMDb: من الخادم لو موجود، وإلا من TMDB.
  let imdbId = streamsResult.imdbId || null;
  if (!imdbId) {
    imdbId = await fetchImdbId(type, tmdbId).catch(() => null);
  }

  if (native.length === 0) {
    return { sources: [], embeds, imdbId };
  }

  // نجهّز الترجمة العربية للمصدر المفضّل (الأول). فشلها لا يكسر التشغيل.
  const preferred = native[0];
  let sources: PlayableSource[];
  try {
    const prepared = await prepareArabicSubtitles(
      {
        type,
        tmdbId,
        imdbId,
        stream: preferred.url,
        season: type === 'tv' ? season : undefined,
        episode: type === 'tv' ? episode : undefined,
      },
      signal,
    );
    // المصدر المفضّل يصير رابط العربية الجاهز، وبعده بقية المصادر الأصلية.
    sources = [
      { url: prepared.url, arabicReady: true, origin: preferred },
      ...native.map((s) => ({ url: s.url, arabicReady: false, origin: s })),
    ];
  } catch {
    // الترجمة ما تجهّزت — نشغّل المصادر الأصلية بالترتيب بلا ادعاء عربية.
    sources = native.map((s) => ({ url: s.url, arabicReady: false, origin: s }));
  }

  return { sources, embeds, imdbId };
}
