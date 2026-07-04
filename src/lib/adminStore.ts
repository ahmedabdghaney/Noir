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
}

const CFG = 'site_config';

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
  await setDoc(doc(db, CFG, 'hidden'), { ids }, { merge: false });
}

export async function toggleHidden(type: 'movie' | 'tv', id: number, hide: boolean): Promise<string[]> {
  const key = itemKey(type, id);
  const current = await fetchHidden();
  const next = hide ? Array.from(new Set([...current, key])) : current.filter((k) => k !== key);
  await setHidden(next);
  return next;
}

// ── الكتابة: العناصر اليدوية ──

export async function setManualItems(items: ManualItem[]): Promise<void> {
  await setDoc(doc(db, CFG, 'manualItems'), { items }, { merge: false });
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
  await setDoc(doc(db, CFG, 'sections'), { list }, { merge: false });
}

export async function addCustomSection(title: string): Promise<CustomSection[]> {
  const current = await fetchCustomSections();
  const key = `custom_${Date.now()}`;
  const order = current.length ? Math.max(...current.map((s) => s.order || 0)) + 1 : 0;
  const next = [...current, { key, title: title.trim(), order }];
  await setCustomSections(next);
  return next;
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

export const genUid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
