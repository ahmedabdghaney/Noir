/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// طبقة إدارة الموقع — تخزن قرارات الأدمن في Firestore بمكان عام (site_config)
// عشان تنطبق على كل زوار الموقع. الوثائق:
//   - hidden      : IDs مخفية من الأقسام التلقائية (TMDB)
//   - manualItems : عناصر مضافة يدوياً بكل تفاصيلها (كفر، هيرو، تقييم، وصف...)
//   - sections    : أقسام مخصصة من إنشاء الأدمن
//
// كل الكتابة محصورة على إيميل الأدمن (يُفحص بالواجهة + قواعد Firestore).

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const ADMIN_EMAIL = 'ahmedabdghaney@gmail.com';

export const isAdmin = (email?: string | null): boolean =>
  !!email && email.trim().toLowerCase() === ADMIN_EMAIL;

// ── الأنواع ──

// عنصر مضاف يدوياً — نخزن كل الحقول عشان الأدمن يتحكم بكل تفصيل.
// المصدر ممكن يكون TMDB (نجيب الحقول تلقائياً ونخزنها) أو يدوي بالكامل.
export interface ManualItem {
  uid: string;                 // معرّف فريد داخلي
  tmdbId?: number;             // موجود لو مستورد من TMDB (للتقييم المحدّث تلقائياً)
  type: 'movie' | 'tv';

  title: string;
  overview: string;            // الوصف
  poster: string | null;       // الكفر (رابط كامل)
  backdrop: string | null;     // صورة الهيرو (رابط كامل)
  rating: number;              // التقييم
  autoRating: boolean;         // لو true نحدّث التقييم من TMDB تلقائياً (يتطلب tmdbId)
  year: string;
  genres: string[];            // التصنيفات
  director: string;            // المخرج
  country: string;             // دولة الإنتاج
  language: string;            // اللغة الأصلية

  section: string;             // key القسم اللي يروح له
  inHero: boolean;             // يظهر بالكاروسيل الكبير فوق؟
  addedAt: number;
}

export interface CustomSection {
  key: string;
  title: string;
  order: number;
  kind?: 'manual' | 'genre';       // افتراضي manual للتوافق مع القديم
  genreId?: number;                // TMDB genre id (لو kind='genre')
  mediaType?: 'movie' | 'tv';      // نوع المحتوى للقسم بالتصنيف
  minYear?: number;                // فلتر: أقل سنة
  maxYear?: number;                // فلتر: أعلى سنة
  minRating?: number;              // فلتر: أقل تقييم
  language?: string;               // فلتر: كود اللغة الأصلية (en, ar, ...)
}

const CFG = 'site_config';

// Firestore يرفض قيم undefined — ننظّفها بعمق قبل أي كتابة.
// (نحوّل undefined لحذف المفتاح، ونعالج المصفوفات والكائنات المتداخلة.)
function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clean) as any;
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      if (val === undefined) continue;
      out[k] = clean(val);
    }
    return out;
  }
  return v;
}

// ── القراءة ──

export async function fetchHidden(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'hidden'));
    const d = snap.data();
    return Array.isArray(d?.ids) ? d!.ids : [];
  } catch { return []; }
}

export async function fetchManualItems(): Promise<ManualItem[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'manualItems'));
    const d = snap.data();
    const list = Array.isArray(d?.items) ? d!.items : [];
    return list.slice().sort((a: ManualItem, b: ManualItem) => (b.addedAt || 0) - (a.addedAt || 0));
  } catch { return []; }
}

export async function fetchCustomSections(): Promise<CustomSection[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'sections'));
    const d = snap.data();
    const list = Array.isArray(d?.list) ? d!.list : [];
    return list.slice().sort((a: CustomSection, b: CustomSection) => (a.order || 0) - (b.order || 0));
  } catch { return []; }
}

// ── اشتراكات حية ──

export function subscribeHidden(cb: (ids: string[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'hidden'), (snap) => {
    const d = snap.data();
    cb(Array.isArray(d?.ids) ? d!.ids : []);
  }, () => cb([]));
}

export function subscribeManualItems(cb: (items: ManualItem[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'manualItems'), (snap) => {
    const d = snap.data();
    const list = Array.isArray(d?.items) ? d!.items : [];
    cb(list.slice().sort((a: ManualItem, b: ManualItem) => (b.addedAt || 0) - (a.addedAt || 0)));
  }, () => cb([]));
}

export function subscribeCustomSections(cb: (sections: CustomSection[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'sections'), (snap) => {
    const d = snap.data();
    const list = Array.isArray(d?.list) ? d!.list : [];
    cb(list.slice().sort((a: CustomSection, b: CustomSection) => (a.order || 0) - (b.order || 0)));
  }, () => cb([]));
}

// ── مفاتيح ──

export const itemKey = (type: 'movie' | 'tv', id: number) => `${type}_${id}`;
export const manualKey = (it: Pick<ManualItem, 'type' | 'tmdbId' | 'uid'>) =>
  it.tmdbId ? `${it.type}_${it.tmdbId}` : `uid_${it.uid}`;

// ── الكتابة: الإخفاء ──

export async function setHidden(ids: string[]): Promise<void> {
  await setDoc(doc(db, CFG, 'hidden'), { ids: clean(ids) }, { merge: false });
}

export async function toggleHidden(type: 'movie' | 'tv', id: number, hide: boolean): Promise<string[]> {
  const key = itemKey(type, id);
  const current = await fetchHidden();
  const next = hide ? Array.from(new Set([...current, key])) : current.filter((k) => k !== key);
  await setHidden(next);
  return next;
}

// ── إخفاء خاص بالهيرو (الكاروسيل الكبير) — منفصل عن الإخفاء العام ──

export async function fetchHeroHidden(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'heroHidden'));
    const d = snap.data();
    return Array.isArray(d?.ids) ? d!.ids : [];
  } catch { return []; }
}

export function subscribeHeroHidden(cb: (ids: string[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'heroHidden'), (snap) => {
    const d = snap.data();
    cb(Array.isArray(d?.ids) ? d!.ids : []);
  }, () => cb([]));
}

export async function toggleHeroHidden(type: 'movie' | 'tv', id: number, hide: boolean): Promise<string[]> {
  const key = itemKey(type, id);
  const current = await fetchHeroHidden();
  const next = hide ? Array.from(new Set([...current, key])) : current.filter((k) => k !== key);
  await setDoc(doc(db, CFG, 'heroHidden'), { ids: clean(next) }, { merge: false });
  return next;
}

// ── عناصر هيرو مضافة من الأدمن (بالبحث) — منفصلة عن الرائج واليدوي ──
// كل عنصر: بيانات كافية للعرض بالكاروسيل (من TMDB)
export interface HeroExtra {
  type: 'movie' | 'tv';
  id: number;            // TMDB id
  title: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  year: string;
  genres: string[];
  addedAt: number;
}

export async function fetchHeroExtra(): Promise<HeroExtra[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'heroExtra'));
    const d = snap.data();
    const list = Array.isArray(d?.items) ? d!.items : [];
    return list.slice().sort((a: HeroExtra, b: HeroExtra) => (a.addedAt || 0) - (b.addedAt || 0));
  } catch { return []; }
}

export function subscribeHeroExtra(cb: (items: HeroExtra[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'heroExtra'), (snap) => {
    const d = snap.data();
    const list = Array.isArray(d?.items) ? d!.items : [];
    cb(list.slice().sort((a: HeroExtra, b: HeroExtra) => (a.addedAt || 0) - (b.addedAt || 0)));
  }, () => cb([]));
}

export async function addHeroExtra(item: Omit<HeroExtra, 'addedAt'>): Promise<HeroExtra[]> {
  const current = await fetchHeroExtra();
  const key = itemKey(item.type, item.id);
  const filtered = current.filter((h) => itemKey(h.type, h.id) !== key);
  const next = [...filtered, { ...item, addedAt: Date.now() }];
  await setDoc(doc(db, CFG, 'heroExtra'), { items: clean(next) }, { merge: false });
  return next;
}

export async function removeHeroExtra(type: 'movie' | 'tv', id: number): Promise<HeroExtra[]> {
  const key = itemKey(type, id);
  const current = await fetchHeroExtra();
  const next = current.filter((h) => itemKey(h.type, h.id) !== key);
  await setDoc(doc(db, CFG, 'heroExtra'), { items: clean(next) }, { merge: false });
  return next;
}

// ── ترتيب الهيرو (مفاتيح مرتّبة) ──

export async function fetchHeroOrder(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'heroOrder'));
    const d = snap.data();
    return Array.isArray(d?.order) ? d!.order : [];
  } catch { return []; }
}

export function subscribeHeroOrder(cb: (order: string[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'heroOrder'), (snap) => {
    const d = snap.data();
    cb(Array.isArray(d?.order) ? d!.order : []);
  }, () => cb([]));
}

export async function setHeroOrder(order: string[]): Promise<void> {
  await setDoc(doc(db, CFG, 'heroOrder'), { order: clean(order) }, { merge: false });
}

// ── الكتابة: العناصر اليدوية ──

export async function setManualItems(items: ManualItem[]): Promise<void> {
  await setDoc(doc(db, CFG, 'manualItems'), { items: clean(items) }, { merge: false });
}

// upsert — لو نفس المفتاح موجود نستبدله
export async function upsertManualItem(item: ManualItem): Promise<ManualItem[]> {
  const current = await fetchManualItems();
  const key = manualKey(item);
  const filtered = current.filter((m) => manualKey(m) !== key);
  const next = [{ ...item }, ...filtered];
  await setManualItems(next);
  return next;
}

export async function removeManualItem(key: string): Promise<ManualItem[]> {
  const current = await fetchManualItems();
  const next = current.filter((m) => manualKey(m) !== key);
  await setManualItems(next);
  return next;
}

// ── الكتابة: الأقسام المخصصة ──

export async function setCustomSections(list: CustomSection[]): Promise<void> {
  await setDoc(doc(db, CFG, 'sections'), { list: clean(list) }, { merge: false });
}

// إنشاء أو تحديث قسم مخصص (upsert). لو ما في key نولّد واحد جديد.
export async function upsertCustomSection(sec: Partial<CustomSection> & { title: string }): Promise<CustomSection[]> {
  const current = await fetchCustomSections();
  const key = sec.key || `custom_${Date.now()}`;
  const existing = current.find((s) => s.key === key);
  const order = existing ? existing.order : (current.length ? Math.max(...current.map((s) => s.order || 0)) + 1 : 0);
  const merged: CustomSection = {
    key,
    title: sec.title.trim(),
    order,
    kind: sec.kind || 'manual',
    genreId: sec.genreId,
    mediaType: sec.mediaType || 'movie',
    minYear: sec.minYear,
    maxYear: sec.maxYear,
    minRating: sec.minRating,
    language: sec.language,
  };
  const next = existing
    ? current.map((s) => (s.key === key ? merged : s))
    : [...current, merged];
  await setCustomSections(next);
  return next;
}

// إبقاء addCustomSection للتوافق (قسم يدوي بسيط)
export async function addCustomSection(title: string): Promise<CustomSection[]> {
  return upsertCustomSection({ title, kind: 'manual' });
}

export async function removeCustomSection(key: string): Promise<CustomSection[]> {
  const current = await fetchCustomSections();
  const next = current.filter((s) => s.key !== key);
  await setCustomSections(next);
  const items = await fetchManualItems();
  const fixed = items.map((m) => (m.section === key ? { ...m, section: 'manual' } : m));
  await setManualItems(fixed);
  return next;
}

// ── الترتيب الموحّد لكل الأقسام (أصلية + مخصصة) ──

export async function fetchSectionOrder(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'order'));
    const d = snap.data();
    return Array.isArray(d?.order) ? d!.order : [];
  } catch { return []; }
}

export function subscribeSectionOrder(cb: (order: string[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'order'), (snap) => {
    const d = snap.data();
    cb(Array.isArray(d?.order) ? d!.order : []);
  }, () => cb([]));
}

export async function setSectionOrder(order: string[]): Promise<void> {
  await setDoc(doc(db, CFG, 'order'), { order: clean(order) }, { merge: false });
}

export const genUid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
