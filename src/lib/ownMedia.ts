/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ملفات الفيديو الخاصة بك (مثل طريقة Cinema Box: ملف MP4/HLS لكل جودة +
 * ملفات ترجمة). لو العنوان عنده ملفات هنا، المشغل يشغّلها مباشرة بمشغل Noir
 * بدل المصادر الخارجية. القراءة عامة والكتابة للأدمن فقط (firestore.rules).
 */

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface OwnQuality {
  label: string;   // "1080p" / "720p" / "480p"
  url: string;     // رابط مباشر MP4 أو m3u8
}

export interface OwnSubtitle {
  lang: string;    // "ar" / "en"
  label: string;   // "العربية"
  url: string;     // ملف .vtt أو .srt
}

export interface OwnMedia {
  key: string;
  type: 'movie' | 'tv';
  tmdbId: number;
  season?: number;
  episode?: number;
  title: string;
  qualities: OwnQuality[];
  subtitles: OwnSubtitle[];
  updatedAt: number;
}

export const ownMediaKey = (type: 'movie' | 'tv', id: number, season?: number, episode?: number) =>
  type === 'tv' ? `tv_${id}_s${season || 1}e${episode || 1}` : `movie_${id}`;

/** ارتفاع الجودة من الاسم ("1080p" → 1080) للترتيب. */
export const qualityHeight = (label: string) => {
  if (/4k|2160/i.test(label)) return 2160;
  const n = parseInt(label, 10);
  return Number.isFinite(n) ? n : 0;
};

export const isHlsUrl = (url: string) => /\.m3u8(\?|$|#)/i.test(url);

// اشتراك واحد مشترك لكل التطبيق — القائمة صغيرة (وثيقة لكل فلم/حلقة).
let cache: Map<string, OwnMedia> | null = null;
let unsub: (() => void) | null = null;
const listeners = new Set<(m: Map<string, OwnMedia>) => void>();

function ensureSubscribed() {
  if (unsub) return;
  unsub = onSnapshot(
    collection(db, 'ownMedia'),
    (snap) => {
      const next = new Map<string, OwnMedia>();
      snap.docs.forEach((d) => next.set(d.id, { ...(d.data() as OwnMedia), key: d.id }));
      cache = next;
      listeners.forEach((l) => l(next));
    },
    () => {
      cache = cache || new Map();
      listeners.forEach((l) => l(cache!));
    },
  );
}

export function subscribeOwnMedia(cb: (m: Map<string, OwnMedia>) => void): () => void {
  ensureSubscribed();
  listeners.add(cb);
  if (cache) cb(cache);
  return () => listeners.delete(cb);
}

/**
 * ملفاتك لهذا الفلم/الحلقة.
 * undefined = لسه يحمّل · null = ما عنده ملفات · OwnMedia = عنده.
 */
export function useOwnMedia(type: 'movie' | 'tv', id: number, season?: number, episode?: number) {
  const key = ownMediaKey(type, id, season, episode);
  const [media, setMedia] = useState<OwnMedia | null | undefined>(() =>
    cache ? cache.get(key) || null : undefined,
  );
  useEffect(() => subscribeOwnMedia((m) => setMedia(m.get(key) || null)), [key]);
  return media;
}

export async function saveOwnMedia(media: Omit<OwnMedia, 'key' | 'updatedAt'>): Promise<void> {
  const key = ownMediaKey(media.type, media.tmdbId, media.season, media.episode);
  const data: any = {
    type: media.type,
    tmdbId: media.tmdbId,
    title: media.title.slice(0, 200),
    qualities: media.qualities
      .filter((q) => q.url.trim())
      .map((q) => ({ label: q.label.trim().slice(0, 20) || 'Auto', url: q.url.trim() })),
    subtitles: media.subtitles
      .filter((s) => s.url.trim())
      .map((s) => ({ lang: s.lang.trim().slice(0, 10) || 'ar', label: s.label.trim().slice(0, 40) || 'العربية', url: s.url.trim() })),
    updatedAt: Date.now(),
  };
  if (media.type === 'tv') {
    data.season = media.season || 1;
    data.episode = media.episode || 1;
  }
  await setDoc(doc(db, 'ownMedia', key), data);
}

export async function deleteOwnMedia(key: string): Promise<void> {
  await deleteDoc(doc(db, 'ownMedia', key));
}

/* ── الترجمة: نقرأ ملف VTT/SRT ونحوّله لمسار نصي داخل عنصر الفيديو ──
   نستخدم fetch + addTextTrack بدل <track> حتى ما نحتاج crossOrigin على
   الفيديو نفسه (ملف الفيديو ما يحتاج CORS، بس ملف الترجمة يحتاج). */

const parseTime = (t: string) => {
  const m = t.trim().replace(',', '.').match(/^(?:(\d+):)?(\d{1,2}):(\d{2})\.(\d{1,3})$/);
  if (!m) return NaN;
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
};

export function parseSubtitleCues(text: string): { start: number; end: number; text: string }[] {
  const blocks = text.replace(/\r/g, '').replace(/^﻿/, '').split(/\n{2,}/);
  const cues: { start: number; end: number; text: string }[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const start = parseTime(a);
    const end = parseTime((b || '').trim().split(/\s+/)[0]);
    const body = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && body) cues.push({ start, end, text: body });
  }
  return cues;
}

const loadedTracks = new WeakMap<HTMLVideoElement, Set<string>>();

/** يضيف ملفات الترجمة كمسارات نصية (مرة وحدة لكل عنصر فيديو). العربي أولاً. */
export async function attachOwnSubtitles(video: HTMLVideoElement, subtitles: OwnSubtitle[]): Promise<void> {
  const done = loadedTracks.get(video) || new Set<string>();
  loadedTracks.set(video, done);
  const ordered = [...subtitles].sort((a, b) => (/^ar/i.test(b.lang) ? 1 : 0) - (/^ar/i.test(a.lang) ? 1 : 0));
  for (const sub of ordered) {
    if (done.has(sub.url)) continue;
    done.add(sub.url);
    try {
      const res = await fetch(sub.url);
      if (!res.ok) throw new Error(String(res.status));
      const cues = parseSubtitleCues(await res.text());
      const track = video.addTextTrack('subtitles', sub.label, sub.lang);
      track.mode = 'hidden';
      for (const c of cues) track.addCue(new VTTCue(c.start, c.end, c.text));
    } catch (err) {
      done.delete(sub.url);
      console.warn('Subtitle file could not be loaded:', sub.label, err);
    }
  }
}
