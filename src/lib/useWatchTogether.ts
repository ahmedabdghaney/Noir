/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';

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

type PlayerSignal = { action: 'play' | 'pause' | 'seek'; time: number; byName: string };

interface UseWatchTogetherOpts {
  enabled: boolean;
  room: string;
  name: string;
  onPlayerSignal?: (sig: PlayerSignal) => void;
}

// Server URL: defaults to the deployed Railway server.
// Can be overridden with VITE_WS_URL at build time if needed.
const RAILWAY_WS = 'wss://noir-movies-production.up.railway.app';
const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'ws://localhost:8080'
    : RAILWAY_WS);

export function useWatchTogether({ enabled, room, name, onPlayerSignal }: UseWatchTogetherOpts) {
  const wsRef = useRef<WebSocket | null>(null);
  const selfIdRef = useRef<string>('');
  const signalRef = useRef(onPlayerSignal);
  signalRef.current = onPlayerSignal;

  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [members, setMembers] = useState<WtMember[]>([]);
  const [messages, setMessages] = useState<WtMessage[]>([]);
  const [error, setError] = useState<string>('');
  // Latest playback time reported by the host (seconds). 0 = not started / unknown.
  const [hostTime, setHostTime] = useState(0);

  const pushMessage = useCallback((m: WtMessage) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  useEffect(() => {
    if (!enabled || !room) return;

    if (!WS_URL) {
      setError('لم يتم ضبط رابط خادم المشاهدة الجماعية (VITE_WS_URL)');
      return;
    }

    let closedByUs = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        setError('تعذّر الاتصال بخادم المشاهدة الجماعية');
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError('');
        ws.send(JSON.stringify({ type: 'join', room, name }));
      };

      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (msg.type === 'joined') {
          selfIdRef.current = msg.selfId;
          setIsHost(!!msg.isHost);
          setMembers(msg.members || []);
          if (typeof msg.hostTime === 'number') setHostTime(msg.hostTime);
        } else if (msg.type === 'members') {
          setMembers(msg.members || []);
          const me = (msg.members || []).find((m: WtMember) => m.id === selfIdRef.current);
          if (me) setIsHost(me.isHost);
        } else if (msg.type === 'chat') {
          pushMessage({
            sender: msg.name,
            text: msg.text,
            time: 'الآن',
            type: 'chat',
            self: msg.id === selfIdRef.current,
          });
        } else if (msg.type === 'system') {
          pushMessage({ sender: 'نظام نوار سينما', text: msg.text, time: 'الآن', type: 'system' });
        } else if (msg.type === 'player') {
          if (typeof msg.time === 'number') setHostTime(msg.time);
          signalRef.current?.({ action: msg.action, time: msg.time, byName: msg.byName });
        } else if (msg.type === 'time') {
          if (typeof msg.time === 'number') setHostTime(msg.time);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!closedByUs) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        setError('انقطع الاتصال بالخادم، تتم إعادة المحاولة...');
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      if (ws && ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'leave' }));
        } catch {}
        ws.close();
      }
      wsRef.current = null;
      setConnected(false);
      setMembers([]);
      setMessages([]);
      setIsHost(false);
      setHostTime(0);
    };
  }, [enabled, room, name, pushMessage]);

  const sendChat = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN && text.trim()) {
      ws.send(JSON.stringify({ type: 'chat', text }));
    }
  }, []);

  const sendPlayer = useCallback((action: 'play' | 'pause' | 'seek', time: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'player', action, time }));
    }
  }, []);

  const sendTime = useCallback((time: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'time', time }));
    }
  }, []);

  return { connected, isHost, members, messages, error, hostTime, sendChat, sendPlayer, sendTime };
}
