/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * المشاهدة الجماعية عبر Firestore (بدل خادم WebSocket منفصل):
 *   watchRooms/{code}                 إعدادات الغرفة + حالة التشغيل من المضيف
 *   watchRooms/{code}/members/{uid}   الحضور (نبضة كل 20 ثانية)
 *   watchRooms/{code}/messages/{id}   الدردشة
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref as rtdbRef, update as rtdbUpdate } from 'firebase/database';
import { auth, db, rtdb } from './firebase';

export interface WtMember {
  id: string;
  name: string;
  isHost: boolean;
}

export interface WtMessage {
  sender: string;
  text: string;
  time: string;
  type: 'system' | 'chat';
  self?: boolean;
}

type PlayerAction = 'play' | 'pause' | 'seek';
// reason 'buffering' = the host's video is loading (not an intentional pause).
type PlayerSignal = { action: PlayerAction; time: number; byName: string; reason?: 'buffering' };

interface UseWatchTogetherOpts {
  enabled: boolean;
  room: string;
  name: string;
  onPlayerSignal?: (sig: PlayerSignal) => void;
}

// عضو بدون نبضة لأكثر من دقيقة يعتبر خارج الغرفة.
const HEARTBEAT_MS = 20_000;
const ONLINE_WINDOW_MS = 60_000;

const formatClock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

type TimedMessage = WtMessage & { atMs: number };

export function useWatchTogether({ enabled, room, name, onPlayerSignal }: UseWatchTogetherOpts) {
  const signalRef = useRef(onPlayerSignal);
  signalRef.current = onPlayerSignal;
  const nameRef = useRef(name);
  nameRef.current = name;

  const [uid, setUid] = useState<string>(auth.currentUser?.uid || '');
  const [connected, setConnected] = useState(false);
  const [hostUid, setHostUid] = useState('');
  const [rawMembers, setRawMembers] = useState<{ id: string; name: string; joinedAtMs: number; lastSeenMs: number }[]>([]);
  const [chat, setChat] = useState<TimedMessage[]>([]);
  const [system, setSystem] = useState<TimedMessage[]>([]);
  const [error, setError] = useState<string>('');
  const [hostTime, setHostTime] = useState(0);
  // When hostTime was measured (local clock) and whether the host is paused,
  // so members can estimate where the host is right now.
  const [hostTimeAt, setHostTimeAt] = useState(0);
  const [hostPaused, setHostPaused] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid || '')), []);

  // Re-evaluate who is online without waiting for a new snapshot.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !room) return;
    if (!uid) {
      setError('Sign in to join the watch party');
      return;
    }

    const roomRef = doc(db, 'watchRooms', room);
    const memberRef = doc(db, 'watchRooms', room, 'members', uid);
    const joinedAt = Date.now();
    let lastSignalAt = 0;
    let firstRoomSnap = true;
    let firstMembersSnap = true;
    let lastHostTimeAtMs = 0;
    let firstPlayback = true;
    let roomHostUid = '';
    let knownMembers = new Map<string, string>();

    const writePresence = () =>
      setDoc(memberRef, {
        name: (nameRef.current || 'Guest').slice(0, 60),
        joinedAtMs: joinedAt,
        lastSeenMs: Date.now(),
      }).catch(() => {});

    const unsubRoom = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          setConnected(false);
          setError(firstRoomSnap ? 'Room not found or already ended' : 'The host ended the watch party');
          firstRoomSnap = false;
          return;
        }
        const d = snap.data() as any;
        roomHostUid = d.hostUid || '';
        setHostUid(roomHostUid);
        setConnected(true);
        setError('');
        applyPlayback(d);
        firstRoomSnap = false;
      },
      () => {
        setConnected(false);
        setError('Could not reach the watch party. Check your connection.');
      },
    );

    // Same playback state over Realtime Database (much faster between devices).
    // Whichever channel delivers first wins; duplicates are ignored by timestamp.
    let unsubFast = () => {};
    try {
      unsubFast = onValue(
        rtdbRef(rtdb, `watchParty/${room}`),
        (snap) => {
          const d = snap.val();
          // Only this room's host (per Firestore) counts; ignore leftovers of an old room.
          if (d && roomHostUid && d.hostUid === roomHostUid) applyPlayback(d);
        },
        () => {},
      );
    } catch {}

    function applyPlayback(d: any) {
        const pb = d.playback;
        // Ignore a stale copy (older action than one already applied) from the slower channel.
        if (pb && typeof pb.atMs === 'number' && pb.atMs < lastSignalAt) return;
        const playing = !pb || pb.action !== 'pause';
        setHostPaused(!playing);
        if (typeof d.hostTime === 'number') {
          // A fresh report arrives right after the host writes it, so its arrival time is
          // the reference (device clocks can differ by seconds). Only an old report — the
          // first snapshot when joining — is aged using the host's clock, capped at 1 min.
          // Two channels can deliver out of order: only a newer report than the last one
          // (host's own timestamps) may move the host position.
          const isNewerReport = (d.hostTimeAtMs || 0) > lastHostTimeAtMs;
          if (isNewerReport || !lastHostTimeAtMs) {
            const age = !firstPlayback || !d.hostTimeAtMs
              ? 0
              : Math.min(60, Math.max(0, (Date.now() - d.hostTimeAtMs) / 1000));
            lastHostTimeAtMs = d.hostTimeAtMs || 0;
            setHostTime(d.hostTime + (playing ? age : 0));
            setHostTimeAt(Date.now());
          }
        }
        if (pb && typeof pb.atMs === 'number') {
          // Skip the action already in place when we joined; react to new ones only.
          // Exception: joining while the host is paused should start paused.
          if (firstPlayback) {
            lastSignalAt = pb.atMs;
            if (pb.action === 'pause' && pb.byUid !== uid) {
              signalRef.current?.({ action: 'pause', time: pb.time, byName: pb.byName, reason: pb.reason });
            }
          } else if (pb.atMs > lastSignalAt && pb.byUid !== uid) {
            lastSignalAt = pb.atMs;
            signalRef.current?.({ action: pb.action, time: pb.time, byName: pb.byName, reason: pb.reason });
          }
        }
        firstPlayback = false;
    }

    const unsubMembers = onSnapshot(
      collection(db, 'watchRooms', room, 'members'),
      (snap) => {
        const list = snap.docs.map((m) => {
          const d = m.data() as any;
          return { id: m.id, name: d.name || 'Guest', joinedAtMs: d.joinedAtMs || 0, lastSeenMs: d.lastSeenMs || 0 };
        });
        const cutoff = Date.now() - ONLINE_WINDOW_MS;
        const online = new Map(list.filter((m) => m.lastSeenMs >= cutoff).map((m) => [m.id, m.name]));
        if (!firstMembersSnap) {
          const at = Date.now();
          const notes: TimedMessage[] = [];
          online.forEach((n, id) => {
            if (!knownMembers.has(id) && id !== uid) notes.push({ sender: '', text: `${n} joined`, time: formatClock(at), type: 'system', atMs: at });
          });
          knownMembers.forEach((n, id) => {
            if (!online.has(id) && id !== uid) notes.push({ sender: '', text: `${n} left`, time: formatClock(at), type: 'system', atMs: at });
          });
          if (notes.length) setSystem((prev) => [...prev, ...notes]);
        }
        knownMembers = online;
        firstMembersSnap = false;
        setRawMembers(list);
      },
      () => {},
    );

    const unsubChat = onSnapshot(
      query(collection(db, 'watchRooms', room, 'messages'), orderBy('atMs', 'asc'), limitToLast(100)),
      (snap) => {
        setChat(
          snap.docs.map((m) => {
            const d = m.data() as any;
            return {
              sender: d.name || 'Guest',
              text: d.text || '',
              time: formatClock(d.atMs || Date.now()),
              type: 'chat' as const,
              self: d.uid === uid,
              atMs: d.atMs || 0,
            };
          }),
        );
      },
      () => {},
    );

    writePresence();
    const heartbeat = setInterval(writePresence, HEARTBEAT_MS);
    const onUnload = () => { deleteDoc(memberRef).catch(() => {}); };
    window.addEventListener('pagehide', onUnload);

    return () => {
      unsubRoom();
      unsubFast();
      unsubMembers();
      unsubChat();
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', onUnload);
      deleteDoc(memberRef).catch(() => {});
      setConnected(false);
      setHostUid('');
      setRawMembers([]);
      setChat([]);
      setSystem([]);
      setHostTime(0);
      setHostTimeAt(0);
      setHostPaused(false);
      setError('');
    };
  }, [enabled, room, uid]);

  const isHost = !!uid && uid === hostUid;

  // Host first, then by join time, so "past the limit" means the latest arrivals.
  const members: WtMember[] = rawMembers
    .filter((m) => m.lastSeenMs >= now - ONLINE_WINDOW_MS || m.id === uid)
    .sort((a, b) => (a.id === hostUid ? -1 : b.id === hostUid ? 1 : a.joinedAtMs - b.joinedAtMs))
    .map((m) => ({ id: m.id, name: m.name, isHost: m.id === hostUid }));

  const messages: WtMessage[] = [...chat, ...system].sort((a, b) => a.atMs - b.atMs);

  const sendChat = useCallback((text: string) => {
    const body = text.trim().slice(0, 500);
    if (!enabled || !room || !uid || !body) return;
    addDoc(collection(db, 'watchRooms', room, 'messages'), {
      uid,
      name: (nameRef.current || 'Guest').slice(0, 60),
      text: body,
      atMs: Date.now(),
    }).catch(() => setError('Message not sent. Try again.'));
  }, [enabled, room, uid]);

  const sendPlayer = useCallback((action: PlayerAction, time: number, reason?: 'buffering') => {
    if (!enabled || !room || !uid || uid !== hostUid) return;
    const at = Date.now();
    const playback: Record<string, unknown> = { action, time: Math.max(0, time), byUid: uid, byName: (nameRef.current || 'Host').slice(0, 60), atMs: at };
    if (reason && action === 'pause') playback.reason = reason;
    rtdbUpdate(rtdbRef(rtdb, `watchParty/${room}`), { hostUid: uid, playback, hostTime: Math.max(0, time), hostTimeAtMs: at }).catch(() => {});
    updateDoc(doc(db, 'watchRooms', room), {
      playback,
      hostTime: Math.max(0, time),
      hostTimeAtMs: at,
      updatedAtMs: at,
    }).catch(() => {});
  }, [enabled, room, uid, hostUid]);

  const lastTimeWriteRef = useRef(0);
  const sendTime = useCallback((time: number) => {
    if (!enabled || !room || !uid || uid !== hostUid) return;
    const at = Date.now();
    if (at - lastTimeWriteRef.current < 1800) return;
    lastTimeWriteRef.current = at;
    rtdbUpdate(rtdbRef(rtdb, `watchParty/${room}`), { hostUid: uid, hostTime: Math.max(0, time), hostTimeAtMs: at }).catch(() => {});
    updateDoc(doc(db, 'watchRooms', room), { hostTime: Math.max(0, time), hostTimeAtMs: at, updatedAtMs: at }).catch(() => {});
  }, [enabled, room, uid, hostUid]);

  return { connected, isHost, selfId: uid, members, messages, error, hostTime, hostTimeAt, hostPaused, sendChat, sendPlayer, sendTime };
}
