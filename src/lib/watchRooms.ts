/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * إعدادات غرف المشاهدة الجماعية (حد الأعضاء + خاص/عام) محفوظة بـ Firestore.
 * خادم الـ WebSocket على Railway ما يعرف هذي الإعدادات، فالتطبيق يتحقق منها
 * قبل الاتصال: المضيف ينشئ وثيقة الغرفة، والمنضم يقراها قبل ما يدخل.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ref as rtdbRef, remove as rtdbRemove } from 'firebase/database';
import { auth, db, rtdb } from './firebase';

export type WatchRoomVisibility = 'private' | 'public';

export interface WatchRoom {
  code: string;
  hostUid: string;
  hostName: string;
  type: 'movie' | 'tv';
  tmdbId: number;
  title: string;
  maxMembers: number;
  visibility: WatchRoomVisibility;
  memberCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export const WATCH_ROOM_MIN_MEMBERS = 2;
export const WATCH_ROOM_MAX_MEMBERS = 20;
export const WATCH_ROOM_DEFAULT_MEMBERS = 10;
// غرفة ما تحدّثت من 6 ساعات تعتبر منتهية وما تنعرض بالقائمة العامة.
const ROOM_STALE_MS = 6 * 60 * 60 * 1000;

const roomsCol = () => collection(db, 'watchRooms');

export const generateRoomCode = () => 'NOIR-' + Math.floor(1000 + Math.random() * 9000);

export const clampMembers = (n: number) =>
  Math.min(WATCH_ROOM_MAX_MEMBERS, Math.max(WATCH_ROOM_MIN_MEMBERS, Math.round(n)));

export async function createWatchRoom(opts: {
  type: 'movie' | 'tv';
  tmdbId: number;
  title: string;
  hostName: string;
  maxMembers: number;
  visibility: WatchRoomVisibility;
}): Promise<WatchRoom> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('not-signed-in');
  const now = Date.now();
  const room: WatchRoom = {
    code: generateRoomCode(),
    hostUid: uid,
    hostName: opts.hostName.slice(0, 60),
    type: opts.type,
    tmdbId: opts.tmdbId,
    title: opts.title.slice(0, 200),
    maxMembers: clampMembers(opts.maxMembers),
    visibility: opts.visibility,
    memberCount: 1,
    createdAtMs: now,
    updatedAtMs: now,
  };
  await setDoc(doc(roomsCol(), room.code), room);
  return room;
}

export async function getWatchRoom(code: string): Promise<WatchRoom | null> {
  try {
    const snap = await getDoc(doc(roomsCol(), code));
    if (!snap.exists()) return null;
    const room = snap.data() as WatchRoom;
    return Date.now() - room.updatedAtMs > ROOM_STALE_MS ? null : room;
  } catch {
    // بدون صلاحية قراءة أو بدون اتصال: نتصرف كأن الغرفة بلا إعدادات.
    return null;
  }
}

export async function updateWatchRoomCount(code: string, memberCount: number): Promise<void> {
  try {
    await updateDoc(doc(roomsCol(), code), { memberCount, updatedAtMs: Date.now() });
  } catch {}
}

export async function closeWatchRoom(code: string): Promise<void> {
  rtdbRemove(rtdbRef(rtdb, `watchParty/${code}`)).catch(() => {});
  try {
    await deleteDoc(doc(roomsCol(), code));
  } catch {}
}

/** الغرف العامة المفتوحة لنفس الفلم/المسلسل. */
export function subscribePublicWatchRooms(
  type: 'movie' | 'tv',
  tmdbId: number,
  cb: (rooms: WatchRoom[]) => void,
): () => void {
  const q = query(
    roomsCol(),
    where('visibility', '==', 'public'),
    where('type', '==', type),
    where('tmdbId', '==', tmdbId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      cb(
        snap.docs
          .map((d) => d.data() as WatchRoom)
          .filter((r) => now - r.updatedAtMs <= ROOM_STALE_MS)
          .sort((a, b) => b.updatedAtMs - a.updatedAtMs),
      );
    },
    () => cb([]),
  );
}
