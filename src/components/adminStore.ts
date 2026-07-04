/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// طبقة إدارة الموقع — تخزن قرارات الأدمن في Firestore بمكان عام (مو تحت user)
// عشان تنطبق على كل زوار الموقع. ثلاث وثائق تحت مجموعة "site_config":
//   - hidden      : IDs مخفية من كل الموقع
//   - manualItems : عناصر مضافة يدوياً (TMDB id + القسم اللي تروح له)
//   - sections    : أقسام مخصصة من إنشاء الأدمن
//
// كل الكتابة محصورة على إيميل الأدمن (يُفحص بالواجهة + قواعد Firestore).

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const ADMIN_EMAIL = 'ahmedabdghaney@gmail.com';

export const isAdmin = (email?: string | null): boolean =>
  !!email && email.trim().toLowerCase() === ADMIN_EMAIL;

// ── الأنواع ──

// عنصر مضاف يدوياً — نخزن الحد الأدنى ونجيب التفاصيل من TMDB وقت العرض
export interface ManualRef {
  type: 'movie' | 'tv';
  id: number;
  section: string;   // key القسم اللي يروح له (قسم موجود أو مخصص)
  addedAt: number;   // ترتيب
}

// قسم مخصص من إنشاء الأدمن
export interface CustomSection {
  key: string;       // معرّف فريد (slug)
  title: string;     // الاسم المعروض بالعربي
  order: number;     // ترتيب الظهور
}

const CFG = 'site_config';

// ── القراءة ──

export async function fetchHidden(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'hidden'));
    const d = snap.data();
    return Array.isArray(d?.ids) ? d!.ids : [];
  } catch {
    return [];
  }
}

export async function fetchManualItems(): Promise<ManualRef[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'manualItems'));
    const d = snap.data();
    const list = Array.isArray(d?.items) ? d!.items : [];
    return list.slice().sort((a: ManualRef, b: ManualRef) => (b.addedAt || 0) - (a.addedAt || 0));
  } catch {
    return [];
  }
}

export async function fetchCustomSections(): Promise<CustomSection[]> {
  try {
    const snap = await getDoc(doc(db, CFG, 'sections'));
    const d = snap.data();
    const list = Array.isArray(d?.list) ? d!.list : [];
    return list.slice().sort((a: CustomSection, b: CustomSection) => (a.order || 0) - (b.order || 0));
  } catch {
    return [];
  }
}

// اشتراك لحظي — يخلي الموقع يتحدث فوراً لما الأدمن يغير شي (بدون refresh)
export function subscribeHidden(cb: (ids: string[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'hidden'), (snap) => {
    const d = snap.data();
    cb(Array.isArray(d?.ids) ? d!.ids : []);
  }, () => cb([]));
}

export function subscribeManualItems(cb: (items: ManualRef[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'manualItems'), (snap) => {
    const d = snap.data();
    const list = Array.isArray(d?.items) ? d!.items : [];
    cb(list.slice().sort((a: ManualRef, b: ManualRef) => (b.addedAt || 0) - (a.addedAt || 0)));
  }, () => cb([]));
}

export function subscribeCustomSections(cb: (sections: CustomSection[]) => void): () => void {
  return onSnapshot(doc(db, CFG, 'sections'), (snap) => {
    const d = snap.data();
    const list = Array.isArray(d?.list) ? d!.list : [];
    cb(list.slice().sort((a: CustomSection, b: CustomSection) => (a.order || 0) - (b.order || 0)));
  }, () => cb([]));
}

// ── الكتابة (أدمن فقط) ──

// مفتاح موحّد للعنصر — نفس صيغة باقي الموقع
export const itemKey = (type: 'movie' | 'tv', id: number) => `${type}_${id}`;

export async function setHidden(ids: string[]): Promise<void> {
  await setDoc(doc(db, CFG, 'hidden'), { ids }, { merge: false });
}

export async function toggleHidden(type: 'movie' | 'tv', id: number, hide: boolean): Promise<string[]> {
  const key = itemKey(type, id);
  const current = await fetchHidden();
  const next = hide
    ? Array.from(new Set([...current, key]))
    : current.filter((k) => k !== key);
  await setHidden(next);
  return next;
}

export async function setManualItems(items: ManualRef[]): Promise<void> {
  await setDoc(doc(db, CFG, 'manualItems'), { items }, { merge: false });
}

export async function addManualItem(ref: Omit<ManualRef, 'addedAt'>): Promise<ManualRef[]> {
  const current = await fetchManualItems();
  const key = itemKey(ref.type, ref.id);
  // امنع التكرار — لو موجود حدّث قسمه فقط
  const filtered = current.filter((m) => itemKey(m.type, m.id) !== key);
  const next: ManualRef[] = [{ ...ref, addedAt: Date.now() }, ...filtered];
  await setManualItems(next);
  return next;
}

export async function removeManualItem(type: 'movie' | 'tv', id: number): Promise<ManualRef[]> {
  const key = itemKey(type, id);
  const current = await fetchManualItems();
  const next = current.filter((m) => itemKey(m.type, m.id) !== key);
  await setManualItems(next);
  return next;
}

export async function setCustomSections(list: CustomSection[]): Promise<void> {
  await setDoc(doc(db, CFG, 'sections'), { list }, { merge: false });
}

export async function addCustomSection(title: string): Promise<CustomSection[]> {
  const current = await fetchCustomSections();
  // slug فريد من الوقت — بسيط ومضمون عدم التكرار
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
  // نظّف العناصر اللي كانت بهالقسم — نرجّعها لقسم افتراضي "manual"
  const items = await fetchManualItems();
  const fixed = items.map((m) => (m.section === key ? { ...m, section: 'manual' } : m));
  await setManualItems(fixed);
  return next;
}
