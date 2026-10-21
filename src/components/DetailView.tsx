/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Star, Share2, Plus, Check, RotateCcw, Users, MessageSquare, Send, Copy, AlertCircle, ChevronsUpDown, ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp, Minus, X, Lock, Globe, LogOut } from 'lucide-react';
import {
  CastMember,
  ContinueWatchingItem,
  DetailedInfo,
  MovieOrShow,
  NativePlaybackProgress,
  TitlePreference,
  ViewingHistoryItem,
} from '../types';
import { fetchDetailedTitle, getPosterUrl, getLargePosterUrl, getBackdropUrl, getOriginalBackdropUrl } from '../lib/tmdb';
import VideoPlayer from './VideoPlayer';
import MovieRow from './MovieRow';
import { useWatchTogether } from '../lib/useWatchTogether';
import { subscribeOwnMedia } from '../lib/ownMedia';
import {
  WatchRoom,
  WatchRoomVisibility,
  WATCH_ROOM_DEFAULT_MEMBERS,
  WATCH_ROOM_MAX_MEMBERS,
  WATCH_ROOM_MIN_MEMBERS,
  clampMembers,
  closeWatchRoom,
  createWatchRoom,
  getWatchRoom,
  subscribePublicWatchRooms,
  updateWatchRoomCount,
} from '../lib/watchRooms';
import { fetchSeasonEpisodes, EpisodeInfo, getStillUrl, getProfileUrl, getTitleLogoUrl } from '../lib/tmdb';
import {
  auth,
  addToFirestoreWatchlist,
  removeFromFirestoreWatchlist,
  subscribeFirestoreTitleReactionCounts,
} from '../lib/firebase';

interface DetailViewProps {
  type: 'movie' | 'tv';
  id: number;
  initialSeason?: number;
  initialEpisode?: number;
  onEpisodeChange?: (season: number, episode: number) => void;
  onItemClick: (item: MovieOrShow) => void;
  onOpenShare: (url: string) => void;
  user: { name: string; email?: string; type: 'guest' | 'google' | 'email' } | null;
  showToast: (message: string) => void;
  autoOpenWatchTogether?: string;
  onClearAutoOpenWatchTogether?: () => void;
  autoResume?: boolean;
  onAutoResumeConsumed?: () => void;
  autoStart?: boolean;
  onAutoStartConsumed?: () => void;
  watchlist: MovieOrShow[];
  onToggleWatchlistItem?: (item: MovieOrShow) => void;
  preference?: TitlePreference;
  onPreference?: (item: MovieOrShow, preference: TitlePreference) => void;
  introEndSeconds?: number;
  // بيانات عنصر يدوي محض (خارج TMDB). لو موجودة، نعرضها بدل جلب TMDB.
  manualData?: {
    title: string;
    overview: string;
    poster: string | null;
    backdrop: string | null;
    rating: number;
    year: string;
    genres: string[];
    director: string;
    country: string;
    language: string;
    runtime?: number;
  } | null;
}

function formatHms(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function DetailView({
  type,
  id,
  initialSeason,
  initialEpisode,
  onEpisodeChange,
  onItemClick,
  onOpenShare,
  user,
  showToast,
  autoOpenWatchTogether = '',
  onClearAutoOpenWatchTogether,
  autoResume = false,
  onAutoResumeConsumed,
  autoStart = false,
  onAutoStartConsumed,
  watchlist,
  onToggleWatchlistItem,
  preference,
  onPreference,
  introEndSeconds = 0,
  manualData = null,
}: DetailViewProps) {
  const isTvApp = document.documentElement.classList.contains('noir-tv-app');
  const primaryTvActionRef = useRef<HTMLButtonElement>(null);
  const seasonButtonRef = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<DetailedInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Watchlist Save state
  const isSaved = (watchlist || []).some((item) => item.id === id && item.type === type);

  // TV Episode States — القيمة الابتدائية من الـ URL إن وُجدت
  const [selectedSeason, setSelectedSeason] = useState(initialSeason || 1);
  const [selectedEpisode, setSelectedEpisode] = useState(initialEpisode || 1);
  const [episodesCount, setEpisodesCount] = useState(1);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);

  useEffect(() => {
    setSeasonMenuOpen(false);
  }, [id, type]);

  useEffect(() => {
    if (!seasonMenuOpen || !isTvApp) return;
    const frame = window.requestAnimationFrame(() => {
      const menu = document.querySelector<HTMLElement>('[data-tv-season-menu]');
      const selected =
        menu?.querySelector<HTMLElement>('[data-tv-season-option][aria-current="true"]') ||
        menu?.querySelector<HTMLElement>('[data-tv-season-option]');
      selected?.focus({ preventScroll: true });
    });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setSeasonMenuOpen(false);
      window.requestAnimationFrame(() => {
        seasonButtonRef.current?.focus({ preventScroll: true });
      });
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [isTvApp, seasonMenuOpen]);

  // Player Playback States
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerMode, setPlayerMode] = useState<'movie' | 'trailer'>('movie');
  const [isPausedByHost, setIsPausedByHost] = useState(false);
  // Why the host is paused: 'buffering' = the host's video is loading.
  const [hostPauseReason, setHostPauseReason] = useState<'' | 'buffering'>('');
  // Small notice shown inside members' players for the host's actions.
  const [hostNotice, setHostNotice] = useState<{ text: string; key: number } | null>(null);
  const noticeHost = (text: string) => setHostNotice({ text, key: Date.now() });
  const [hostPauseByName, setHostPauseByName] = useState<string>('');
  // Local playback time reported by the iframe (for the host)
  const localTimeRef = useRef<number>(0);
  // Last time we relayed our time to the server (host throttle)
  const lastTimeBroadcastRef = useRef<number>(0);
  // Snapshot of startAt at the moment the player was opened.
  // We DO NOT pass wtHostTime live, otherwise it would constantly reload the iframe.
  const [startAtSnapshot, setStartAtSnapshot] = useState<number>(0);

  // Saved Progress Percentage
  const [savedProgressPercent, setSavedProgressPercent] = useState<number>(0);
  const [savedPlayback, setSavedPlayback] = useState<ContinueWatchingItem | null>(null);
  const [reactionCounts, setReactionCounts] = useState({ likes: 0, dislikes: 0 });

  useEffect(
    () => subscribeFirestoreTitleReactionCounts(
      type,
      id,
      setReactionCounts,
      (reactionError) => console.error('Failed to load title reaction counts:', reactionError),
    ),
    [id, type],
  );

  // Load the list of your own video files early so Watch now can start them instantly.
  useEffect(() => subscribeOwnMedia(() => {}), []);

  // Watch Together - Live
  const [isWatchTogetherOpen, setIsWatchTogetherOpen] = useState(false);
  const [wtRoomCode, setWtRoomCode] = useState('');
  const [wtNewMsg, setWtNewMsg] = useState('');
  const [wtCopied, setWtCopied] = useState(false);
  // إعداد الغرفة قبل الإنشاء: حد الأعضاء + خاص/عام (محفوظة بـ Firestore)
  const [wtSetupOpen, setWtSetupOpen] = useState(false);
  const [wtMaxMembers, setWtMaxMembers] = useState(WATCH_ROOM_DEFAULT_MEMBERS);
  const [wtVisibility, setWtVisibility] = useState<WatchRoomVisibility>('private');
  const [wtCreating, setWtCreating] = useState(false);
  const [wtJoinInput, setWtJoinInput] = useState('');
  const [wtRoomInfo, setWtRoomInfo] = useState<WatchRoom | null>(null);
  const [wtPublicRooms, setWtPublicRooms] = useState<WatchRoom[]>([]);

  // اسم تبويب المتصفح = اسم الفلم/المسلسل ويرجع لـ "Noir Cinema" عند الإغلاق
  // نستخدم data?.title لأن data قد تكون null في بداية التحميل
  useEffect(() => {
    const pageTitle = data?.title || (data as any)?.name;
    if (pageTitle) document.title = `${pageTitle} — Noir Cinema`;
    return () => { document.title = 'Noir Cinema'; };
  }, [data]);

  const wtName = user?.name || 'Guest';
  const {
    connected: wtConnected,
    isHost: wtIsHost,
    selfId: wtSelfId,
    members: wtMembers,
    messages: wtMessages,
    error: wtError,
    hostTime: wtHostTime,
    hostTimeAt: wtHostTimeAt,
    hostPaused: wtHostPaused,
    sendChat: wtSendChat,
    sendPlayer: wtSendPlayer,
    sendTime: wtSendTime,
  } = useWatchTogether({
    enabled: isWatchTogetherOpen && !!wtRoomCode,
    room: wtRoomCode,
    name: wtName,
    onPlayerSignal: (sig) => {
      // A remote host opened/controlled the player: mirror the action locally
      if (sig.action === 'play') {
        if (isPausedByHost && hostPauseReason !== 'buffering') noticeHost('▶ Host resumed');
        setHostPauseReason('');
        // Snapshot the host's current time so the iframe boots from that point.
        setStartAtSnapshot(Math.max(0, Math.floor(sig.time || 0)));
        setIsPlayerOpen(true);
        setPlayerMode('movie');
        setIsPausedByHost(false);
        setHostPauseByName('');
      } else if (sig.action === 'pause') {
        // Stop on the host's frame (Noir's own player seeks in place while paused).
        setStartAtSnapshot(Math.max(0, sig.time || 0));
        setIsPausedByHost(true);
        setHostPauseByName(sig.byName);
        setHostPauseReason(sig.reason === 'buffering' ? 'buffering' : '');
      } else if (sig.action === 'seek') {
        // Host scrubbed the timeline. Reload the iframe at the new position.
        const t = Math.max(0, Math.floor(sig.time || 0));
        const jump = (sig.time || 0) - localTimeRef.current;
        noticeHost(
          Math.abs(jump - 10) < 2.5 ? '⏩ Host +10s'
            : Math.abs(jump + 10) < 2.5 ? '⏪ Host −10s'
              : `Host jumped to ${formatHms(t)}`,
        );
        setStartAtSnapshot(t);
        localTimeRef.current = t;
        if (!isPlayerOpen) {
          setIsPlayerOpen(true);
          setPlayerMode('movie');
        }
      }
    },
  });

  const loadSavedProgress = () => {
    try {
      const raw = localStorage.getItem('noir_continue_watching_list');
      const list: ContinueWatchingItem[] = raw ? JSON.parse(raw) : [];
      const saved = list.find((item) => item.type === type && item.id === id) || null;
      const matchesEpisode =
        !saved ||
        type === 'movie' ||
        (saved.season === selectedSeason && saved.episode === selectedEpisode);
      const current = saved && matchesEpisode ? saved : null;
      setSavedPlayback(current);
      setSavedProgressPercent(current ? Math.round(Number(current.progress || 0)) : 0);
    } catch {
      setSavedPlayback(null);
      setSavedProgressPercent(0);
    }
  };

  useEffect(() => {
    loadSavedProgress();
    const handleProgressUpdated = () => loadSavedProgress();
    window.addEventListener('progress_updated', handleProgressUpdated);
    return () => {
      window.removeEventListener('progress_updated', handleProgressUpdated);
    };
  }, [type, id, selectedSeason, selectedEpisode]);

  useEffect(() => {
    if (!isTvApp || !data || isPlayerOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const action = primaryTvActionRef.current;
      if (!action) return;
      action.focus({ preventScroll: true });
      action.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [data, id, isPlayerOpen, isTvApp, savedProgressPercent, selectedEpisode, selectedSeason]);

  const handleStartFromBeginning = () => {
    const raw = localStorage.getItem('noir_continue_watching_list');
    const list: ContinueWatchingItem[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((item) => !(item.type === type && item.id === id));
    localStorage.setItem('noir_continue_watching_list', JSON.stringify(next));
    localStorage.removeItem(`noir_progress_${type}_${id}`);
    setSavedPlayback(null);
    setSavedProgressPercent(0);
    window.dispatchEvent(
      new CustomEvent('progress_updated', {
        detail: { type, id, remove: true },
      }),
    );
    // Open main movie stream
    handlePlayClick('movie', 0);
  };

  const handleNativePlaybackProgress = useCallback(
    (playback: NativePlaybackProgress) => {
      if (!data || playback.durationSeconds <= 0) return;

      let list: ContinueWatchingItem[] = [];
      try {
        const raw = localStorage.getItem('noir_continue_watching_list');
        list = raw ? JSON.parse(raw) : [];
      } catch {
        list = [];
      }

      const withoutCurrent = list.filter(
        (item) => !(item.type === type && item.id === id),
      );

      if (playback.positionSeconds >= 5 || playback.completed) {
        let history: ViewingHistoryItem[] = [];
        try {
          history = JSON.parse(localStorage.getItem('noir_viewing_history') || '[]');
        } catch {
          history = [];
        }
        const previousHistory = history.find(
          (item) => item.type === type && item.id === id,
        );
        const historyItem: ViewingHistoryItem = {
          id,
          type,
          title: data.title || (data as any).name || 'Untitled',
          overview: data.overview || '',
          poster:
            (data as any)._manualPoster ||
            (data.poster_path ? getPosterUrl(data.poster_path) : null),
          backdrop:
            (data as any)._manualBackdrop ||
            (data.backdrop_path ? getBackdropUrl(data.backdrop_path) : null),
          rating: data.vote_average || 0,
          year: (data.release_date || data.first_air_date || '').slice(0, 4),
          date: data.release_date || data.first_air_date || '',
          genres: data.genres ? data.genres.map((genre) => genre.name) : [],
          progress: playback.completed ? 100 : playback.progress,
          positionSeconds: playback.positionSeconds,
          durationSeconds: playback.durationSeconds,
          season: playback.season,
          episode: playback.episode,
          completed: playback.completed || playback.progress >= 95,
          watchCount:
            Math.max(1, previousHistory?.watchCount || 1) +
            (playback.completed && previousHistory && !previousHistory.completed ? 1 : 0),
          lastWatchedAtMs: Date.now(),
        };
        const nextHistory = [
          historyItem,
          ...history.filter((item) => !(item.type === type && item.id === id)),
        ].slice(0, 100);
        localStorage.setItem('noir_viewing_history', JSON.stringify(nextHistory));
        window.dispatchEvent(
          new CustomEvent('viewing_history_updated', { detail: { item: historyItem } }),
        );
      }

      if (playback.completed || playback.progress >= 95) {
        localStorage.setItem(
          'noir_continue_watching_list',
          JSON.stringify(withoutCurrent),
        );
        localStorage.removeItem(`noir_progress_${type}_${id}`);
        setSavedPlayback(null);
        setSavedProgressPercent(0);
        window.dispatchEvent(
          new CustomEvent('progress_updated', {
            detail: { type, id, remove: true },
          }),
        );
        return;
      }

      if (playback.positionSeconds < 5) return;

      const item: ContinueWatchingItem = {
        id,
        type,
        title: data.title || (data as any).name || 'Untitled',
        overview: data.overview || '',
        poster:
          (data as any)._manualPoster ||
          (data.poster_path ? getPosterUrl(data.poster_path) : null),
        backdrop:
          (data as any)._manualBackdrop ||
          (data.backdrop_path ? getBackdropUrl(data.backdrop_path) : null),
        rating: data.vote_average || 0,
        year: (data.release_date || data.first_air_date || '').slice(0, 4),
        date: data.release_date || data.first_air_date || '',
        genres: data.genres ? data.genres.map((genre) => genre.name) : [],
        progress: playback.progress,
        positionSeconds: playback.positionSeconds,
        durationSeconds: playback.durationSeconds,
        season: playback.season,
        episode: playback.episode,
        updatedAtMs: Date.now(),
      };

      const next = [item, ...withoutCurrent]
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
        .slice(0, 20);
      localStorage.setItem('noir_continue_watching_list', JSON.stringify(next));
      localStorage.setItem(
        'noir_continue_watching_owner',
        auth.currentUser?.uid || 'guest',
      );
      localStorage.setItem(
        `noir_progress_${type}_${id}`,
        String(playback.progress),
      );
      setSavedPlayback(item);
      setSavedProgressPercent(Math.round(playback.progress));
      window.dispatchEvent(
        new CustomEvent('progress_updated', {
          detail: { item },
        }),
      );
    },
    [data, id, type],
  );

  useEffect(() => {
    if ((!autoResume && !autoStart) || isLoading || !data) return;
    try {
      const raw = localStorage.getItem('noir_continue_watching_list');
      const list: ContinueWatchingItem[] = raw ? JSON.parse(raw) : [];
      const saved = list.find((item) => item.type === type && item.id === id);
      if (saved?.positionSeconds && saved.durationSeconds > 0) {
        if (type === 'tv' && saved.season > 0 && saved.episode > 0) {
          setSelectedSeason(saved.season);
          setSelectedEpisode(saved.episode);
        }
        setStartAtSnapshot(saved.positionSeconds);
        setPlayerMode('movie');
        setIsPlayerOpen(true);
      } else if (autoStart) {
        setStartAtSnapshot(0);
        setPlayerMode('movie');
        setIsPlayerOpen(true);
      }
    } finally {
      if (autoResume) onAutoResumeConsumed?.();
      if (autoStart) onAutoStartConsumed?.();
    }
  }, [
    autoResume,
    autoStart,
    data,
    id,
    isLoading,
    onAutoResumeConsumed,
    onAutoStartConsumed,
    type,
  ]);

  // Join a room by code. If the room has saved settings and is already full, refuse
  // before connecting. Old links without a room doc still join as before.
  const joinWatchRoom = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    await auth.authStateReady();
    if (!auth.currentUser) {
      showToast('Sign in to join the watch party');
      return;
    }
    const info = await getWatchRoom(code);
    if (!info) {
      showToast(`Room ${code} was not found or has ended`);
      return;
    }
    if (info && info.memberCount >= info.maxMembers) {
      showToast(`Room ${code} is full (${info.maxMembers} members)`);
      return;
    }
    setWtRoomInfo(info);
    setWtRoomCode(code);
    setWtSetupOpen(false);
    setIsWatchTogetherOpen(true);
  }, [showToast]);

  // Auto-join a room from a shared link
  useEffect(() => {
    if (autoOpenWatchTogether) {
      joinWatchRoom(autoOpenWatchTogether);
      onClearAutoOpenWatchTogether?.();
    }
  }, [autoOpenWatchTogether]);

  const openWatchPartySetup = () => {
    if (isWatchTogetherOpen) return;
    setWtSetupOpen(true);
  };

  const handleCreateWatchRoom = async () => {
    if (!auth.currentUser) {
      showToast('Sign in to create a watch party');
      return;
    }
    setWtCreating(true);
    try {
      const room = await createWatchRoom({
        type,
        tmdbId: id,
        title: data?.title || (data as any)?.name || manualData?.title || '',
        hostName: wtName,
        maxMembers: wtMaxMembers,
        visibility: wtVisibility,
      });
      setWtRoomInfo(room);
      setWtRoomCode(room.code);
      setWtSetupOpen(false);
      setIsWatchTogetherOpen(true);
    } catch (err) {
      console.error('Failed to create watch room:', err);
      showToast('Could not create the room. Try again.');
    } finally {
      setWtCreating(false);
    }
  };

  const handleLeaveWatchParty = () => {
    if (wtIsHost && wtRoomCode) closeWatchRoom(wtRoomCode);
    setIsWatchTogetherOpen(false);
    setWtRoomCode('');
    setWtRoomInfo(null);
  };

  // Public rooms for this title, listed in the setup sheet
  useEffect(() => {
    if (!wtSetupOpen) return;
    return subscribePublicWatchRooms(type, id, setWtPublicRooms);
  }, [wtSetupOpen, type, id]);

  // Host keeps the saved member count (and freshness) in sync with who is online
  useEffect(() => {
    if (!wtConnected || !wtIsHost || !wtRoomInfo || !wtRoomCode) return;
    updateWatchRoomCount(wtRoomCode, wtMembers.length);
    const heartbeat = setInterval(() => updateWatchRoomCount(wtRoomCode, wtMembers.length), 10 * 60 * 1000);
    return () => clearInterval(heartbeat);
  }, [wtConnected, wtIsHost, wtRoomInfo, wtRoomCode, wtMembers.length]);

  // Enforce the member limit: anyone who joined past the limit leaves on their own
  useEffect(() => {
    if (!wtConnected || wtIsHost || !wtRoomInfo || !wtSelfId) return;
    const myIndex = wtMembers.findIndex((m) => m.id === wtSelfId);
    if (myIndex >= wtRoomInfo.maxMembers) {
      showToast(`Room ${wtRoomCode} is full (${wtRoomInfo.maxMembers} members)`);
      setIsWatchTogetherOpen(false);
      setWtRoomCode('');
      setWtRoomInfo(null);
    }
  }, [wtConnected, wtIsHost, wtRoomInfo, wtSelfId, wtMembers, wtRoomCode, showToast]);

  // Host leaving the page closes the room so it drops off the public list
  const wtHostRoomRef = useRef('');
  wtHostRoomRef.current = wtIsHost && wtRoomInfo ? wtRoomCode : '';
  useEffect(() => () => {
    if (wtHostRoomRef.current) closeWatchRoom(wtHostRoomRef.current);
  }, []);

  // Late joiner: if the host is already mid-movie, auto-open the player at the host's time
  const didAutoOpenForHostTimeRef = useRef(false);
  const episodesRowRef = useRef<HTMLDivElement>(null);
  const [epShowLeft, setEpShowLeft] = useState(false);
  const [epShowRight, setEpShowRight] = useState(false);

  const checkEpScroll = () => {
    if (episodesRowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = episodesRowRef.current;
      const absScroll = Math.abs(scrollLeft);
      setEpShowRight(absScroll > 10);
      setEpShowLeft(absScroll + clientWidth < scrollWidth - 10);
    }
  };

  const scrollEpisodes = (dir: 'left' | 'right') => {
    if (!episodesRowRef.current) return;
    const { clientWidth } = episodesRowRef.current;
    const amount = clientWidth * 0.75;
    episodesRowRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    setTimeout(checkEpScroll, 350);
  };
  useEffect(() => {
    if (!wtConnected || wtIsHost) return;
    if (didAutoOpenForHostTimeRef.current) return;
    // Late joiner: open the player at the host's position as soon as it is known.
    if (!isPlayerOpen && wtHostTimeAt > 0) {
      didAutoOpenForHostTimeRef.current = true;
      setStartAtSnapshot(Math.max(0, hostPositionNow()));
      setPlayerMode('movie');
      setIsPlayerOpen(true);
    }
  }, [wtConnected, wtIsHost, wtHostTime, wtHostTimeAt, isPlayerOpen]);

  // Reset the auto-open guard whenever the live session state changes
  useEffect(() => {
    if (!isWatchTogetherOpen) {
      didAutoOpenForHostTimeRef.current = false;
    }
  }, [isWatchTogetherOpen]);

  // كل ما يتغير الموسم/الحلقة، حدّث الـ URL عبر App
  useEffect(() => {
    if (type === 'tv' && onEpisodeChange) {
      onEpisodeChange(selectedSeason, selectedEpisode);
    }
  }, [type, selectedSeason, selectedEpisode, onEpisodeChange]);

  // Fetch episode details (images, titles, overviews) for the selected season
  useEffect(() => {
    if (type !== 'tv' || !id) return;
    let cancelled = false;
    setLoadingEpisodes(true);
    setEpisodes([]);
    fetchSeasonEpisodes(id, selectedSeason)
      .then((eps) => {
        if (!cancelled) {
          setEpisodes(eps);
          setLoadingEpisodes(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingEpisodes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, id, selectedSeason]);

  useEffect(() => {
    const t = setTimeout(checkEpScroll, 100);
    window.addEventListener('resize', checkEpScroll);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', checkEpScroll);
    };
  }, [episodes, loadingEpisodes]);


  const handleSendWtMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = wtNewMsg.trim();
    if (!text) return;
    wtSendChat(text);
    setWtNewMsg('');
  };

  const handleCopyRoomLink = () => {
    const link = `${window.location.origin}/#watch-together?room=${wtRoomCode}&type=${type}&id=${id}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link);
    } else {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setWtCopied(true);
    setTimeout(() => setWtCopied(false), 2000);
  };

  useEffect(() => {
    let active = true;
    const loadDetails = async () => {
      setIsLoading(true);
      setError(false);
      setIsPlayerOpen(false); // Reset player state on item shift

      // Reset scroll instantly
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;

      try {
        // عنصر يدوي محض — نبني التفاصيل من بياناتك مباشرة، بلا TMDB
        if (manualData) {
          const built: any = {
            id,
            type,
            title: manualData.title,
            overview: manualData.overview,
            poster_path: null,
            backdrop_path: null,
            vote_average: manualData.rating,
            release_date: manualData.year ? `${manualData.year}-01-01` : '',
            first_air_date: manualData.year ? `${manualData.year}-01-01` : '',
            runtime: manualData.runtime,
            genres: (manualData.genres || []).map((name, i) => ({ id: i, name })),
            production_countries: manualData.country ? [{ iso_3166_1: '', name: manualData.country }] : [],
            spoken_languages: manualData.language ? [{ english_name: manualData.language, name: manualData.language }] : [],
            credits: { cast: [], crew: manualData.director ? [{ id: 0, name: manualData.director, job: 'Director', department: 'Directing' }] : [] },
            // نمرّر الصور الجاهزة (روابط كاملة) عبر حقول مخصصة يقرأها العرض
            _manualPoster: manualData.poster,
            _manualBackdrop: manualData.backdrop,
            videos: { results: [] },
            similar: { results: [] },
            seasons: [],
          };
          if (active) { setData(built); setIsLoading(false); }
          return;
        }

        const details = await fetchDetailedTitle(type, id);
        if (!active) return;
        setData(details);

        // Initialize TV states if needed
        if (type ==='tv' && details.seasons && details.seasons.length > 0) {
          // إذا الـ URL حدّد موسم، استخدمه إذا كان موجوداً فعلاً؛ وإلا أول موسم صالح
          const urlSeasonValid =
            initialSeason &&
            details.seasons.some((s) => s.season_number === initialSeason);
          const targetSeason = urlSeasonValid
            ? details.seasons.find((s) => s.season_number === initialSeason)!
            : (details.seasons.find((s) => s.season_number > 0) || details.seasons[0]);
          setSelectedSeason(targetSeason.season_number);
          setEpisodesCount(targetSeason.episode_count || 1);
          // احترم episodes الـ URL إذا ضمن نطاق الموسم؛ وإلا Episode 1
          if (urlSeasonValid && initialEpisode && initialEpisode <= (targetSeason.episode_count || 1)) {
            setSelectedEpisode(initialEpisode);
          } else {
            setSelectedEpisode(1);
          }
        }
      } catch (err) {
        if (active) setError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadDetails();
    return () => {
      active = false;
    };
  }, [type, id]);

  const handleSeasonSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const seasonNum = Number(e.target.value);
    setSelectedSeason(seasonNum);
    setSelectedEpisode(1);

    if (data?.seasons) {
      const match = data.seasons.find((s) => s.season_number === seasonNum);
      if (match) {
        setEpisodesCount(match.episode_count || 1);
      }
    }
  };

  // The movie player is its own page in the same tab (like a route): opening it keeps
  // the tap, so mobile browsers let it play straight away, and the room stays connected.
  const playerFullPage = !isTvApp && playerMode === 'movie';
  useEffect(() => {
    if (!isPlayerOpen || !playerFullPage) return;
    if (new URLSearchParams(window.location.search).get('play') !== '1') {
      const url = new URL(window.location.href);
      url.searchParams.set('play', '1');
      window.history.pushState({ ...(window.history.state || {}), noirPlayer: true }, '', url.toString());
      window.dispatchEvent(new Event('noir:route'));
    }
    const onPop = () => {
      if (new URLSearchParams(window.location.search).get('play') !== '1') setIsPlayerOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isPlayerOpen, playerFullPage]);

  const handlePlayClick = (mode: 'movie' | 'trailer', startOverride?: number) => {
    setPlayerMode(mode);
    setIsPlayerOpen(true);
    setIsPausedByHost(false);
    setHostPauseByName('');
    if (mode === 'movie') {
      // Host starts fresh; a late-joining viewer should boot from the host's current time.
      const savedPosition =
        savedPlayback &&
        (type === 'movie' ||
          (savedPlayback.season === selectedSeason &&
            savedPlayback.episode === selectedEpisode))
          ? savedPlayback.positionSeconds
          : 0;
      const startFrom =
        wtConnected && !wtIsHost
          ? Math.max(0, Math.floor(wtHostTime))
          : Math.max(0, startOverride ?? savedPosition);
      setStartAtSnapshot(startFrom);
      localTimeRef.current = startFrom;
    }
    // The host's "play" goes to the room when their video actually starts (the player
    // reports it), not on this click: if the host's video waits, members wait too.
  };

  // Host-only pause/resume handlers for live sessions
  const handleHostPause = () => {
    if (!wtIsHost || !wtConnected) return;
    setIsPausedByHost(true);
    setHostPauseByName(wtName);
    wtSendPlayer('pause', localTimeRef.current);
  };

  const handleHostResume = () => {
    if (!wtIsHost || !wtConnected) return;
    setIsPausedByHost(false);
    setHostPauseByName('');
    // Resume from where the host was (so the iframe restart aligns for everyone)
    setStartAtSnapshot(Math.max(0, Math.floor(localTimeRef.current)));
    wtSendPlayer('play', localTimeRef.current);
  };

  // Receive playback time from the iframe.
  // Host: throttle and broadcast to the room.
  // Non-host: just keep it as a local hint (we don't broadcast).
  const handleTimeUpdate = (seconds: number) => {
    localTimeRef.current = seconds;
    correctMemberDrift(seconds);
    if (!wtConnected || !wtIsHost) return;
    const now = Date.now();
    if (now - lastTimeBroadcastRef.current >= 900) {
      lastTimeBroadcastRef.current = now;
      wtSendTime(seconds);
    }
  };

  // Host pressed play/pause inside the Vidy player: tell the room (the host's own
  // player keeps going as is — only members follow).
  const lastEmbedActionRef = useRef<'play' | 'pause' | 'buffering' | ''>('');
  const handleEmbedPlayback = (action: 'play' | 'pause' | 'buffering', time: number) => {
    localTimeRef.current = time;
    if (!wtConnected || !wtIsHost || !isWatchTogetherOpen) return;
    if (lastEmbedActionRef.current === action) return;
    lastEmbedActionRef.current = action;
    lastTimeBroadcastRef.current = Date.now();
    if (action === 'buffering') wtSendPlayer('pause', time, 'buffering');
    else wtSendPlayer(action, time);
  };

  // Members: if their player drifts from the host, restart it at the host's position.
  // (Vidy can't be seeked from outside, so a reload at ?progress= is the only way.)
  const hostSyncRef = useRef({ time: 0, at: 0, paused: false });
  hostSyncRef.current = { time: wtHostTime, at: wtHostTimeAt, paused: wtHostPaused };
  const lastDriftFixRef = useRef(0);
  // On iPhone/Safari a reloaded player waits for a tap, so automatic re-syncs would
  // stop the video every time. There we show a "Sync" button instead.
  const memberAutoplayBlockedRef = useRef(false);
  const [memberDrift, setMemberDrift] = useState<number | null>(null);
  const hostPositionNow = () => {
    const host = hostSyncRef.current;
    return host.time + (host.paused ? 0 : (Date.now() - host.at) / 1000);
  };
  // Noir's own player can jump in place, so members follow the host closely there
  // (1.5s). Embedded players (Vidy) reload to move, so they only re-sync on big gaps.
  const memberNativeRef = useRef(false);
  const memberVideoRef = useRef<HTMLVideoElement | null>(null);
  // Playback speed the member's player uses to close small gaps with the host.
  const [syncRate, setSyncRate] = useState(1);
  useEffect(() => {
    if (!isWatchTogetherOpen || wtIsHost || isPausedByHost) setSyncRate(1);
  }, [isWatchTogetherOpen, wtIsHost, isPausedByHost]);
  const correctMemberDrift = (seconds: number) => {
    if (!wtConnected || wtIsHost || !isWatchTogetherOpen || isPausedByHost) return;
    const host = hostSyncRef.current;
    if (!host.at || host.paused) return;
    const off = Math.abs(seconds - hostPositionNow());
    if (memberNativeRef.current) {
      // 1) Gap of 0.6s+ and the host's spot is already downloaded here: jump straight
      //    there (instant, no loading) — like Cinema Box does.
      // 2) Not downloaded: close small gaps by playing slightly faster (behind, up to
      //    1.25×) or slower (ahead, down to 0.85×) — no stop, no loading.
      // 3) Big gap (4s+): jump, landing 1s ahead to cover loading time.
      const diff = seconds - hostPositionNow(); // + ahead, − behind
      const abs = Math.abs(diff);
      setMemberDrift(null);
      const video = memberVideoRef.current;
      const target = hostPositionNow() + 0.15;
      const targetBuffered = !!video && Array.from({ length: video.buffered.length }, (_, i) => i)
        .some((i) => video.buffered.start(i) <= target && target <= video.buffered.end(i) - 0.5);
      if (abs >= 0.6 && targetBuffered && Date.now() - lastDriftFixRef.current >= 1500) {
        lastDriftFixRef.current = Date.now();
        setSyncRate(1);
        setStartAtSnapshot(Math.max(0, target));
        return;
      }
      if (abs > 4) {
        if (Date.now() - lastDriftFixRef.current < 3000) return;
        lastDriftFixRef.current = Date.now();
        setSyncRate(1);
        setStartAtSnapshot(Math.max(0, hostPositionNow() + 1));
        return;
      }
      let rate = 1;
      if (abs > 0.2) rate = diff < 0 ? 1 + Math.min(0.25, abs * 0.25) : 1 - Math.min(0.15, abs * 0.15);
      rate = Math.round(rate * 50) / 50;
      setSyncRate((prev) => (prev === rate ? prev : rate));
      return;
    }
    if (memberAutoplayBlockedRef.current) {
      const shown = off >= 8 ? Math.round(off) : null;
      setMemberDrift((prev) => (prev === shown || (prev !== null && shown !== null && Math.abs(prev - shown) < 3) ? prev : shown));
      return;
    }
    if (off < 8) return;
    if (Date.now() - lastDriftFixRef.current < 25000) return;
    lastDriftFixRef.current = Date.now();
    // +2s covers the player's start-up time.
    setStartAtSnapshot(Math.max(0, Math.floor(hostPositionNow() + 2)));
  };
  const syncMemberToHost = () => {
    setMemberDrift(null);
    lastDriftFixRef.current = Date.now();
    setStartAtSnapshot(Math.max(0, Math.floor(hostPositionNow() + 3)));
  };

  // Host scrubbed inside the iframe — push the new position to everyone immediately.
  const handleSeek = (seconds: number) => {
    localTimeRef.current = seconds;
    if (!wtConnected || !wtIsHost) return;
    lastTimeBroadcastRef.current = Date.now();
    wtSendPlayer('seek', Math.floor(seconds));
  };

  const nextSeason = type === 'tv'
    ? [...(data?.seasons || [])]
        .filter((season) => season.season_number > selectedSeason && season.episode_count > 0)
        .sort((a, b) => a.season_number - b.season_number)[0]
    : undefined;
  const hasNextEpisode =
    type === 'tv' && (selectedEpisode < episodesCount || !!nextSeason);

  const handleNextEpisode = () => {
    setStartAtSnapshot(0);
    if (selectedEpisode < episodesCount) {
      setSelectedEpisode((current) => current + 1);
      return;
    }
    if (nextSeason) {
      setSelectedSeason(nextSeason.season_number);
      setEpisodesCount(nextSeason.episode_count || 1);
      setSelectedEpisode(1);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 py-20">
        <div className="w-10 h-10 border-4 border-[#A0C9CB]/20 border-t-[#A0C9CB] rounded-full animate-spin" />
        <span className="text-gray-400 font-medium text-sm">Loading...</span>
</div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full min-h-[50vh] flex flex-col items-center justify-center text-center py-20 px-6 gap-4">
        <span className="text-5xl">⚠</span>
        <h3 className="text-xl font-bold text-white">Sorry, failed to load title details</h3>
        <p className="text-gray-400 text-sm max-w-sm">Please check your internet connection; we could not reach the TMDB data provider.</p>
</div>
    );
  }

  const title = data.title || (data as any).name ||'Unknown';
  const titleLogo = getTitleLogoUrl(data);

  // للعناصر اليدوية: نفضّل الروابط الجاهزة اللي مرّرناها
  const manualPoster = (data as any)._manualPoster as string | null | undefined;
  const manualBackdrop = (data as any)._manualBackdrop as string | null | undefined;
  const posterSrc = manualPoster || getLargePosterUrl(data.poster_path);
  const backdropSrc = manualBackdrop || getOriginalBackdropUrl(data.backdrop_path) || getLargePosterUrl(data.poster_path);


  const year = (data.release_date || data.first_air_date ||'').slice(0, 4);
  const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 0;
  const genres = data.genres ? data.genres.map((g) => g.name) : [];
  const cast = data.credits?.cast ? data.credits.cast.slice(0, 12) : [];
  const crew = data.credits?.crew || [];
  const directors = crew.filter((c) => c.job ==='Director').map((c) => c.name);
  const director = directors.length > 0 ? directors.join(', ') : (data.created_by && data.created_by[0] ? data.created_by[0].name :'Not specified');

  const country = data.production_countries && data.production_countries[0] ? data.production_countries[0].name :'Unknown';
  const mainLang = data.spoken_languages && data.spoken_languages[0] ? data.spoken_languages[0].name :'Original';

  const handlePreference = (nextPreference: TitlePreference) => {
    if (!auth.currentUser || user?.type === 'guest') {
      showToast('Sign in to add your rating');
      return;
    }
    onPreference?.({
      id,
      type,
      title,
      poster: getPosterUrl(data.poster_path),
      backdrop: getBackdropUrl(data.backdrop_path),
      rating: data.vote_average || 0,
      year,
      genres,
      overview: data.overview || '',
      date: data.release_date || data.first_air_date || '',
    }, nextPreference);
  };

  const handleToggleSave = async () => {
    if (user?.type === 'guest') {
      showToast('You must sign in with a Google or email account to add titles to your list');
      return;
    }
    if (!data) return;
    try {
      const savedList = localStorage.getItem('noir_watchlist');
      let list = savedList ? JSON.parse(savedList) : [];

      const curUser = auth.currentUser;
      const isItemSaved = isSaved;

      if (isItemSaved) {
        list = list.filter((item: any) => !(item.id === id && item.type === type));
        if (curUser) {
          try {
            await removeFromFirestoreWatchlist(curUser.uid, type, id);
            showToast('Removed from your list');
          } catch (cloudErr: any) {
            console.error("Failed to remove item from Cloud Watchlist: ", cloudErr);
            let errMsg = 'A cloud connection error occurred';
            if (cloudErr) {
              if (cloudErr.message) {
                try {
                  const possibleJson = cloudErr.message.startsWith('Error: ')
                    ? cloudErr.message.slice(7)
                    : cloudErr.message;
                  const parsed = JSON.parse(possibleJson);
                  if (parsed && typeof parsed === 'object') {
                    errMsg = parsed.error || parsed.message || JSON.stringify(parsed);
                  } else {
                    errMsg = cloudErr.message;
                  }
                } catch (e) {
                  errMsg = cloudErr.message;
                }
              } else {
                errMsg = String(cloudErr);
              }
            }
            if (errMsg.includes('Missing or insufficient permissions') && curUser?.emailVerified === false) {
              errMsg = 'Please verify your email from your profile to complete this action';
            }
            showToast(`Removed locally (${errMsg})`);
          }
        } else {
          showToast('Removed from your list');
        }
      } else {
        const newItem = {
          id,
          type,
          title,
          poster: getPosterUrl(data.poster_path),
          backdrop: getBackdropUrl(data.backdrop_path),
          rating: data.vote_average || 0,
          year,
          genres
        };
        list.push(newItem);
        if (curUser) {
          try {
            await addToFirestoreWatchlist(curUser.uid, newItem);
            showToast('Saved to your list');
          } catch (cloudErr: any) {
            console.error("Failed to add item to Cloud Watchlist: ", cloudErr);
            let errMsg = 'A cloud connection error occurred';
            if (cloudErr) {
              if (cloudErr.message) {
                try {
                  const possibleJson = cloudErr.message.startsWith('Error: ')
                    ? cloudErr.message.slice(7)
                    : cloudErr.message;
                  const parsed = JSON.parse(possibleJson);
                  if (parsed && typeof parsed === 'object') {
                    errMsg = parsed.error || parsed.message || JSON.stringify(parsed);
                  } else {
                    errMsg = cloudErr.message;
                  }
                } catch (e) {
                  errMsg = cloudErr.message;
                }
              } else {
                errMsg = String(cloudErr);
              }
            }
            if (errMsg.includes('Missing or insufficient permissions') && curUser?.emailVerified === false) {
              errMsg = 'Please verify your email from your profile to save to the cloud';
            }
            showToast(`Saved locally (${errMsg})`);
          }
        } else {
          showToast('Saved to your list');
        }
      }
      localStorage.setItem('noir_watchlist', JSON.stringify(list));
      window.dispatchEvent(new Event('watchlist_updated'));
    } catch (e) {
      console.error(e);
    }
  };

  // Find trailer
  const trailerVideo = data.videos?.results?.find(
    (v) => v.site ==='YouTube' && (v.type ==='Trailer' || v.type ==='Teaser')
  ) || data.videos?.results?.find((v) => v.site ==='YouTube');
  const youtubeKey = trailerVideo ? trailerVideo.key : null;

  // Normalize recommendations similar movies
  const recommendations: MovieOrShow[] = data.similar?.results
    ? data.similar.results
        .filter((r) => r.poster_path)
        .map((r) => ({
          ...r,
          id: r.id,
          type: type, // recommendations match current category
          title: r.title || r.name ||'Unknown',
          overview: r.overview ||'',
          poster: getPosterUrl(r.poster_path),
          backdrop: getBackdropUrl(r.backdrop_path),
          rating: r.vote_average || 0,
          year: (r.release_date || r.first_air_date ||'').slice(0, 4),
          genres: [],
        }))
        .slice(0, 10)
    : [];

  return (
    <div className="noir-web-detail noir-simple-detail w-full text-left detail-enter">

      {/* Immersive backdrop background section */}
      <div className={`noir-detail-backdrop-stage relative w-full select-none ${isTvApp ? 'h-[35vh] md:h-[45vh] mb-4 overflow-visible' : 'h-[72svh] min-h-[560px] max-h-[840px] overflow-hidden'}`}>
        <div className={`noir-detail-backdrop-media absolute inset-x-0 top-0 ${isTvApp ? 'bottom-[-12rem]' : 'bottom-0'}`}>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${backdropSrc ||''})`,
            }}
          />
          <div className={`absolute inset-0 bg-gradient-to-t ${isTvApp ? 'from-[#08080a] via-[#08080a]/70 to-[#08080a]/20' : 'from-[#070707] via-[#070707]/30 to-black/10'}`} />
          <div className="absolute inset-0 bg-gradient-to-l from-black/90 via-black/28 to-transparent" />
        </div>
      </div>

      {/* Main Details Panel Layout */}
      <div className={`w-full mx-auto px-4 sm:px-8 lg:px-12 relative z-10 ${isTvApp ? '-mt-36 md:-mt-48 xl:px-24' : '-mt-[52svh]'}`}>

        <div className={`grid grid-cols-1 gap-6 items-end ${isTvApp ? 'md:grid-cols-[240px_1fr] md:gap-12' : ''}`}>

          {/* Text Information pane (Right side in standard RTL layouts) */}
          <div className={`noir-detail-summary order-2 flex flex-col items-start text-left min-w-0 w-full ${isTvApp ? 'md:order-2 md:pr-4' : 'max-w-3xl'}`}>

            {titleLogo ? (
              <img
                src={titleLogo}
                alt={title}
                referrerPolicy="no-referrer"
                className="max-h-20 sm:max-h-28 md:max-h-36 max-w-[280px] sm:max-w-[420px] object-contain object-right mb-3 sm:mb-4 drop-shadow-2xl select-none"
              />
            ) : (
              <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-black text-gradient-noir mb-2 sm:mb-3 tracking-tight leading-[1.05] select-all drop-shadow-2xl">
                {title}
</h1>
            )}



            {/* معلومات العمل كنصوص متتابعة قبل كبسولات التصنيف */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs sm:text-sm text-stone-300 font-medium mb-3 leading-relaxed">
              <span className="flex items-center gap-1.5 text-[#f5c518]">
                <Star className="w-4 h-4 fill-current" />
                {data.vote_average ? data.vote_average.toFixed(1) :'N/A'}
              </span>
              <span aria-hidden="true" className="text-stone-600">•</span>
              <span>{year ||'—'}</span>
              {runtime > 0 && (
                <>
                  <span aria-hidden="true" className="text-stone-600">•</span>
                  <span>{runtime} min</span>
                </>
              )}
              <span aria-hidden="true" className="text-stone-600">•</span>
              <span>{type ==='movie' ?'Movie' :'TV Show'}</span>
              {director && director !== 'Not specified' && (
                <>
                  <span aria-hidden="true" className="text-stone-600">•</span>
                  <span>Director: {director}</span>
                </>
              )}
              {country && country !== 'Unknown' && (
                <>
                  <span aria-hidden="true" className="text-stone-600">•</span>
                  <span>{country}</span>
                </>
              )}
              {mainLang && mainLang !== 'Original' && (
                <>
                  <span aria-hidden="true" className="text-stone-600">•</span>
                  <span>{mainLang}</span>
                </>
              )}
            </div>

            {/* Genre Tags List */}
            {genres.length > 0 && (
              <div className="noir-detail-genres flex flex-wrap gap-2 mb-3 sm:mb-4">
                {genres.map((g, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] sm:text-xs font-semibold text-stone-300 glass py-1 px-3 rounded-full"
                  >
                    {g}
</span>
                ))}
</div>
            )}

            {/* Synopsis placed right below Details bar and tags */}
            <div className="noir-detail-overview mb-4 sm:mb-6 max-w-2xl text-left leading-relaxed select-text">
              <p className="text-gray-350 text-xs sm:text-sm md:text-base font-medium leading-relaxed">
                {data.overview ||'No description available.'}
</p>
</div>



            {/* Action buttons: Resume/Play -> Start over -> Trailer -> Save(+) -> Share */}
            <div data-tv-focus-row={isTvApp ? '' : undefined} data-tv-top-actions={isTvApp ? '' : undefined} className="noir-detail-actions flex flex-wrap items-center gap-2 sm:gap-3 w-full">
              {savedProgressPercent > 0 ? (
                <>
                  <button
                    onClick={() => handlePlayClick('movie')}
                    ref={primaryTvActionRef}
                    data-tv-autofocus={isTvApp ? '' : undefined}
                    data-tv-primary-action={isTvApp ? '' : undefined}
                    className="noir-button-primary flex items-center gap-2 text-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Continue Watching</span>
</button>

                  <button
                    onClick={handleStartFromBeginning}
                    data-tv-secondary-action={isTvApp ? '' : undefined}
                    className="noir-button-secondary flex items-center gap-2 text-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Start from the beginning</span>
</button>
</>
              ) : (
                <button
                  onClick={() => handlePlayClick('movie')}
                  ref={primaryTvActionRef}
                  data-tv-autofocus={isTvApp ? '' : undefined}
                  data-tv-primary-action={isTvApp ? '' : undefined}
                  className="noir-button-primary flex items-center gap-2 text-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Watch now</span>
</button>
              )}

              {youtubeKey && !isTvApp && (
                <button
                  onClick={() => handlePlayClick('trailer')}
                  className="noir-detail-trailer-action noir-button-secondary flex items-center gap-2 text-sm"
                >
                  <svg viewBox="0 0 28 20" className="w-6 h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg">
                    <rect width="28" height="20" rx="5" fill="#FF0000" />
                    <path d="M11 6 L19 10 L11 14 Z" fill="white" />
                  </svg>
                  <span>Trailer</span>
</button>
              )}

              <button
                onClick={handleToggleSave}
                data-tv-save={isTvApp ? '' : undefined}
                title={isSaved ? 'Saved to my list' : 'Save to my list'}
                aria-label={isSaved ? 'Remove from my list' : 'Add to my list'}
                className={`noir-icon-button shrink-0 ${
                  isSaved
                    ?'!border-[#A0C9CB]/40 !bg-[#A0C9CB] !text-white'
                    :''
                }`}
              >
                {isSaved ? <Check className="w-5 h-5 text-black" strokeWidth={3} /> : <Plus className="w-5 h-5" />}
</button>

              <div className="noir-detail-reactions flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                <button
                  type="button"
                  data-tv-reaction={isTvApp ? '' : undefined}
                  onClick={() => handlePreference('like')}
                  className={`h-10 min-w-14 rounded-full px-3 inline-flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                    preference === 'like'
                      ? 'bg-white text-black'
                      : 'text-white/85 hover:bg-white/12'
                  }`}
                  aria-label={`Like, ${reactionCounts.likes}`}
                  aria-pressed={preference === 'like'}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span dir="ltr">{reactionCounts.likes.toLocaleString()}</span>
                </button>
                <button
                  type="button"
                  data-tv-reaction={isTvApp ? '' : undefined}
                  onClick={() => handlePreference('dislike')}
                  className={`h-10 min-w-14 rounded-full px-3 inline-flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                    preference === 'dislike'
                      ? 'bg-white text-black'
                      : 'text-white/85 hover:bg-white/12'
                  }`}
                  aria-label={`Dislike, ${reactionCounts.dislikes}`}
                  aria-pressed={preference === 'dislike'}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span dir="ltr">{reactionCounts.dislikes.toLocaleString()}</span>
                </button>
              </div>

              {!isTvApp && (
              <button
                onClick={openWatchPartySetup}
                className={`noir-icon-button shrink-0 ${isWatchTogetherOpen ? '!border-[#A0C9CB]/40 !text-[#A0C9CB]' : ''}`}
                title="Watch party"
                aria-label="Watch party"
              >
                <Users className="w-4 h-4" />
              </button>
              )}

              {!isTvApp && (
              <button
                onClick={() => onOpenShare(`${window.location.origin}/${type}/${id}`)}
                className="noir-icon-button shrink-0"
                title="Share current link"
                aria-label="Share current link"
              >
                <Share2 className="w-4 h-4" />
</button>
              )}
</div>
</div>

          {/* Left Side: Solid Poster Art (Order-1 on display size to look traditional) */}
          <div className={`${isTvApp ? 'order-1 md:order-1' : 'hidden'}`}>
            <div className="w-[160px] md:w-[240px] aspect-[2/3] mx-auto md:mx-0 overflow-hidden bg-stone-900 relative select-none [mask-image:linear-gradient(to_bottom,#000_0%,#000_78%,transparent_100%)]">
              {posterSrc ? (
                <img
                  src={posterSrc || undefined}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-center p-4 bg-stone-950 text-stone-600 text-xs font-semibold leading-normal">
                  {title}
</div>
              )}
</div>
</div>

</div>

        {/* Watch party setup: member limit + private/public, join by code, public rooms */}
        {wtSetupOpen && !isWatchTogetherOpen && createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
            onClick={() => setWtSetupOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Watch party"
          >
            <div
              className="w-full sm:max-w-md bg-stone-950 border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-5 text-left max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#A0C9CB]/10 border border-[#A0C9CB]/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#A0C9CB]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">Watch party</h3>
                    <p className="text-gray-400 text-xs line-clamp-1">{data?.title || (data as any)?.name || manualData?.title}</p>
                  </div>
                </div>
                <button onClick={() => setWtSetupOpen(false)} className="p-2 rounded-full text-white/70 hover:bg-white/10" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-gray-400 text-xs leading-relaxed">
                Start a room, choose who can find it and how many people fit, then send the code to your friends. Everyone stays in sync with the host.
              </p>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-300">Member limit</span>
                <div className="flex items-center justify-between bg-stone-900 border border-white/5 rounded-2xl p-2">
                  <button
                    type="button"
                    onClick={() => setWtMaxMembers((n) => clampMembers(n - 1))}
                    disabled={wtMaxMembers <= WATCH_ROOM_MIN_MEMBERS}
                    className="w-10 h-10 rounded-xl bg-white/5 text-white flex items-center justify-center disabled:opacity-30"
                    aria-label="Fewer members"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-white font-bold text-lg tabular-nums" dir="ltr" aria-live="polite">{wtMaxMembers}</span>
                  <button
                    type="button"
                    onClick={() => setWtMaxMembers((n) => clampMembers(n + 1))}
                    disabled={wtMaxMembers >= WATCH_ROOM_MAX_MEMBERS}
                    className="w-10 h-10 rounded-xl bg-white/5 text-white flex items-center justify-center disabled:opacity-30"
                    aria-label="More members"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-300">Visibility</span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'private' as const, label: 'Private', hint: 'Only people with the code', Icon: Lock },
                    { v: 'public' as const, label: 'Public', hint: 'Listed on this title', Icon: Globe },
                  ]).map(({ v, label, hint, Icon }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setWtVisibility(v)}
                      aria-pressed={wtVisibility === v}
                      className={`rounded-2xl border p-3 text-left transition-colors ${
                        wtVisibility === v
                          ? 'border-[#A0C9CB]/60 bg-[#A0C9CB]/10 text-white'
                          : 'border-white/5 bg-stone-900 text-gray-400 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1.5 ${wtVisibility === v ? 'text-[#A0C9CB]' : ''}`} />
                      <span className="block text-sm font-bold">{label}</span>
                      <span className="block text-[11px] opacity-70">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateWatchRoom}
                disabled={wtCreating || !user || user.type === 'guest'}
                className="w-full h-12 rounded-2xl bg-[#A0C9CB] text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {wtCreating ? 'Creating…' : 'Create room'}
              </button>
              {(!user || user.type === 'guest') && (
                <p className="text-[11px] text-amber-300/80 -mt-3 text-center">Sign in to create or join a room.</p>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); joinWatchRoom(wtJoinInput); }}
                className="flex items-center gap-2 border-t border-white/5 pt-4"
              >
                <input
                  value={wtJoinInput}
                  onChange={(e) => setWtJoinInput(e.target.value)}
                  placeholder="Room code, e.g. NOIR-1234"
                  dir="ltr"
                  className="flex-grow bg-stone-900 text-white text-xs px-3.5 py-3 rounded-xl border border-white/5 focus:outline-none focus:border-[#A0C9CB] font-mono"
                />
                <button type="submit" disabled={!wtJoinInput.trim()} className="px-4 py-3 rounded-xl bg-white text-black text-xs font-bold disabled:opacity-40">
                  Join
                </button>
              </form>

              {wtPublicRooms.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-300">Open public rooms</span>
                  {wtPublicRooms.map((room) => {
                    const full = room.memberCount >= room.maxMembers;
                    return (
                      <div key={room.code} className="flex items-center justify-between bg-stone-900 border border-white/5 rounded-2xl px-3.5 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-bold">{room.hostName}</span>
                          <span className="text-[11px] text-gray-500 font-mono" dir="ltr">{room.code} · {room.memberCount}/{room.maxMembers}</span>
                        </div>
                        <button
                          type="button"
                          disabled={full}
                          onClick={() => joinWatchRoom(room.code)}
                          className="px-3.5 py-1.5 rounded-full bg-[#A0C9CB] text-black text-xs font-bold disabled:opacity-40"
                        >
                          {full ? 'Full' : 'Join'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

        {/* Watch Together Live Synchronization Panel */}
        {isWatchTogetherOpen && (
          <div className="mt-8 bg-stone-950 border border-white/5 rounded-3xl p-4 sm:p-6 md:p-8 space-y-6 text-left animate-fade-in max-w-4xl mx-auto selection:bg-[#A0C9CB]/25">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#A0C9CB]/10 border border-[#A0C9CB]/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#A0C9CB]" />
</div>
                <div className="flex flex-col text-left">
                  <h3 className="text-white font-bold text-sm sm:text-base">Watch Party</h3>
                  <p className="text-gray-400 text-[10px] sm:text-xs">
                    {wtConnected
                      ? 'Live now. Share the link with your friends so they can join you.'
                      : wtError
                        ? wtError
                        : 'Connecting to the watch-party server...'}
                  </p>
                </div>
              </div>

              {/* Room Link Copy Option */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="bg-[#0e1117] border border-white/5 py-1 px-3 rounded-full flex items-center gap-2 text-xs text-gray-300 font-bold select-all leading-none font-mono">
                  <span
                    className={`w-2 h-2 rounded-full ${wtConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  <span>ROOM:</span>
                  <span className="text-[#A0C9CB]">{wtRoomCode}</span>
                </div>
                <button
                  onClick={handleCopyRoomLink}
                  className="flex items-center gap-1 bg-white hover:bg-white/90 text-black font-bold text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{wtCopied ?'Copied!' :'Copy link'}</span>
</button>
                <button
                  onClick={handleLeaveWatchParty}
                  className="flex items-center gap-1 border border-white/10 hover:bg-white/10 text-white font-bold text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>{wtIsHost ? 'End' : 'Leave'}</span>
                </button>
</div>
</div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6">
              {/* Interactive Synced Chat Box */}
              <div className="flex flex-col bg-stone-900 rounded-2xl border border-white/5 overflow-hidden h-[300px]">
                {/* Scrollable messages container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col no-scrollbar">
                  {wtMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col gap-1 max-w-[85%] ${
                        msg.self
                          ? 'mr-auto items-start text-left'
                          : msg.type === 'system'
                            ? 'mx-auto text-center items-center bg-white/5 border border-white/5 rounded-lg py-1 px-3 text-[10px] text-gray-400 w-full'
                            : 'ml-auto items-end text-left'
                      }`}
                    >
                      {msg.type !== 'system' && (
                        <span className="text-[10px] text-gray-500 font-bold px-1">{msg.sender}</span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-xs font-semibold leading-relaxed ${
                        msg.type === 'system'
                          ? ''
                          : msg.self
                            ? 'bg-[#A0C9CB] text-white rounded-tl-none'
                            : 'bg-stone-800 text-gray-200 rounded-tr-none'
                      }`}>
                        {msg.text}
</div>
</div>
                  ))}
</div>

                {/* Send action footer input */}
                <form onSubmit={handleSendWtMessage} className="p-3 bg-stone-950 border-t border-white/5 flex items-center gap-2">
                  <input
                    type="text"
                    value={wtNewMsg}
                    onChange={(e) => setWtNewMsg(e.target.value)}
                    placeholder="Write a message to everyone in the room..."
                    className="flex-grow bg-stone-900 text-white text-xs px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:border-[#A0C9CB] text-left font-medium"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-white hover:bg-white/90 text-black rounded-xl transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
</button>
</form>
</div>

              {/* Members status bar */}
              <div className="bg-stone-900 border border-white/5 p-4 rounded-2xl flex flex-col gap-3 text-left">
                <span className="text-xs text-gray-500 font-bold border-b border-white/5 pb-2 block">Online now ({wtMembers.length}{wtRoomInfo ? `/${wtRoomInfo.maxMembers}` : ''})
                  {wtRoomInfo && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-gray-400">
                      {wtRoomInfo.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {wtRoomInfo.visibility === 'public' ? 'Public' : 'Private'}
                    </span>
                  )}
                </span>
                <div className="flex flex-col gap-2.5">
                  {wtMembers.length === 0 && (
                    <span className="text-[11px] text-gray-600 font-medium">No one yet. Copy the link and send it to your friends.</span>
                  )}
                  {wtMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-white text-xs font-bold">{member.name}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold">
                        {member.isHost ? 'Host' : 'Online'}
                      </span>
</div>
                  ))}
</div>
</div>
</div>
</div>
        )}

        {/* Bottom Synopsis and Cast grids */}
        <div className="mt-16 sm:mt-24">

          <div className="space-y-12 text-left min-w-0">
        {/* TV Episodes section - full width below info cards */}
            {/* TV Series: season selector + Apple-TV style episode cards */}
            {type ==='tv' && data.seasons && data.seasons.length > 0 && (
              <div className="w-full">
                {/* Season selector — Apple TV style */}
                <div className="noir-section-head mb-5">
                  <div className="relative inline-block">
                    <button
                      ref={seasonButtonRef}
                      onClick={() => setSeasonMenuOpen((v) => !v)}
                      data-tv-season-button={isTvApp ? '' : undefined}
                      aria-expanded={seasonMenuOpen}
                      aria-haspopup="dialog"
                      className="flex items-center gap-2 text-white text-lg sm:text-xl font-semibold hover:text-white/80 transition-all cursor-pointer"
                    >
                      <span>Season {selectedSeason}</span>
                      <ChevronsUpDown className="w-4 h-4 text-stone-400" />
                    </button>

                    {seasonMenuOpen && (
                      <>
                        {/* click-away backdrop */}
                        <div
                          className="fixed inset-0 z-[80]"
                          onClick={() => setSeasonMenuOpen(false)}
                        />
                        <div
                          role="dialog"
                          aria-modal="true"
                          aria-label="Select season"
                          data-tv-season-menu={isTvApp ? '' : undefined}
                          className="absolute top-full right-0 mt-2 z-[90] min-w-[180px] max-h-80 overflow-y-auto no-scrollbar glass-strong rounded-2xl p-1.5 shadow-2xl noir-fade-up"
                        >
                          {data.seasons
                            .filter((s) => s.season_number > 0)
                            .map((s) => (
                              <button
                                key={s.id}
                                data-tv-season-option={isTvApp ? '' : undefined}
                                aria-current={selectedSeason === s.season_number ? 'true' : undefined}
                                onClick={() => {
                                  const seasonNum = s.season_number;
                                  setSelectedSeason(seasonNum);
                                  setSelectedEpisode(1);
                                  setEpisodesCount(s.episode_count || 1);
                                  setSeasonMenuOpen(false);
                                  window.requestAnimationFrame(() => {
                                    seasonButtonRef.current?.focus({ preventScroll: true });
                                  });
                                }}
                                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                                  selectedSeason === s.season_number
                                    ? 'bg-white/[0.18] text-white'
                                    : 'text-stone-200 hover:bg-white/10'
                                }`}
                              >
                                Season {s.season_number}
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/38 sm:text-[13px]">{episodesCount} episodes</p>
                </div>

                {/* Episode cards row */}
                {loadingEpisodes ? (
                  <div className="flex gap-4 overflow-hidden">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex-none w-[260px]">
                        <div className="aspect-video rounded-2xl bg-stone-900 animate-pulse" />
                        <div className="h-3 w-24 bg-stone-900 rounded mt-3 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="relative group/eprow">
                    {/* Nav arrows (conditional) */}
                    {epShowRight && (
                      <button
                        onClick={() => scrollEpisodes('right')}
                        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full glass-strong items-center justify-center text-white opacity-0 group-hover/eprow:opacity-100 transition-all cursor-pointer -mr-2"
                        aria-label="Previous"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                    {epShowLeft && (
                      <button
                        onClick={() => scrollEpisodes('left')}
                        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full glass-strong items-center justify-center text-white opacity-0 group-hover/eprow:opacity-100 transition-all cursor-pointer -ml-2"
                        aria-label="Next"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}

                    <div
                      ref={episodesRowRef}
                      onScroll={checkEpScroll}
                      data-tv-focus-row={isTvApp ? '' : undefined}
                      data-tv-episodes-row={isTvApp ? '' : undefined}
                      className={`flex overflow-x-auto no-scrollbar scroll-smooth ${
                        isTvApp ? '-mx-8 gap-7 px-8 py-5' : '-mx-1 gap-4 px-1 pb-3'
                      }`}
                      dir="ltr"
                    >
                    {(episodes.length > 0
                      ? episodes
                      : Array.from({ length: episodesCount }).map((_, i) => ({
                          episode_number: i + 1,
                          name: `Episode ${i + 1}`,
                          overview: '',
                          still_path: null,
                          runtime: null,
                          air_date: null,
                          vote_average: 0,
                        }) as EpisodeInfo)
                    ).map((ep) => {
                      const still = getStillUrl(ep.still_path);
                      return (
                        <button
                          key={ep.episode_number}
                          data-tv-card={isTvApp ? '' : undefined}
                          onClick={() => {
                            setSelectedEpisode(ep.episode_number);
                            handlePlayClick('movie');
                          }}
                          className={`group/ep noir-episode-card flex-none text-left snap-start cursor-pointer ${
                            isTvApp ? 'w-[330px]' : ''
                          }`}
                        >
                          {/* Card with image + overlaid text */}
                          <div data-tv-card-artwork className={`relative rounded-[8px] overflow-hidden bg-stone-900 ${
                            isTvApp ? 'h-[210px]' : 'aspect-video'
                          } ${selectedEpisode === ep.episode_number ? 'ring-2 ring-inset ring-white/90' : 'border border-white/[0.08]'}`}>
                            {still ? (
                              <img
                                src={still}
                                alt={ep.name}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition-transform duration-500"
                              />
                            ) : (getBackdropUrl(data.backdrop_path) || getPosterUrl(data.poster_path)) ? (
                              <img
                                src={getBackdropUrl(data.backdrop_path) || getPosterUrl(data.poster_path) || undefined}
                                alt={ep.name}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover opacity-50 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-700">
                                <Play className="w-8 h-8" />
                              </div>
                            )}

                            {/* Bottom blur + gradient so overlaid text stays readable */}
                            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />

                            {/* Hover play icon */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/ep:opacity-100 transition-opacity">
                              <div className="w-14 h-14 rounded-full glass-strong flex items-center justify-center">
                                <Play className="w-6 h-6 fill-white text-white" />
                              </div>
                            </div>

                            {/* Overlaid text content */}
                            <div className="absolute inset-x-0 bottom-0 z-10 p-4 text-left">
                              <span className="text-xs font-semibold text-white/65 block mb-1">
                                Episode {ep.episode_number}
                              </span>
                              <h4 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-1 mb-1">{ep.name}</h4>

                              {/* Footer: runtime */}
                              <div className="flex items-center justify-between">
                                {ep.runtime ? (
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                                    <Play className="w-3 h-3 fill-current" />
                                    {ep.runtime}m
                                  </span>
                                ) : <span />}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cast roster row component */}
            {!isTvApp && cast.length > 0 && (
              <div className="space-y-4">
                <h3 className="noir-section-head text-lg sm:text-xl font-semibold text-white">Cast</h3>
                <div className="flex gap-5 sm:gap-8 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1" dir="ltr">
                  {cast.map((c: CastMember) => (
                    <div
                      key={c.id}
                      className="flex-none w-[64px] sm:w-[90px] flex flex-col items-center text-center group/cast"
                    >
                      <div className="w-[56px] h-[56px] sm:w-[80px] sm:h-[80px] rounded-full overflow-hidden bg-stone-800 select-none border border-white/[0.06]">
                        {c.profile_path ? (
                          <img
                            src={getProfileUrl(c.profile_path) || undefined}
                            alt={c.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-600 text-lg font-bold">
                            {c.name.slice(0, 2)}
</div>
                        )}
</div>
                      <span className="text-[11px] sm:text-xs font-bold text-white mt-2.5 leading-tight line-clamp-1 w-full" title={c.name}>
                        {c.name}
</span>
                      <span className="text-[10px] sm:text-xs text-stone-500 truncate mt-0.5 w-full" title={c.character}>
                        {c.character ||'—'}
</span>
</div>
                  ))}
</div>
</div>
            )}
</div>

</div>

        {/* Video Player Mount Position - placed above recommendations as requested */}
        {isPlayerOpen && (
          <VideoPlayer
            type={type}
            id={id}
            title={title}
            posterPath={data?.poster_path ?? null}
            season={selectedSeason}
            episode={selectedEpisode}
            episodesCount={episodesCount}
            hasNextEpisode={hasNextEpisode}
            introEndSeconds={introEndSeconds}
            youtubeKey={youtubeKey}
            playMode={playerMode}
            isPausedByHost={isPausedByHost}
            hostPauseByName={hostPauseByName}
            isLiveHost={isWatchTogetherOpen && wtConnected && wtIsHost}
            isLiveSession={isWatchTogetherOpen && wtConnected}
            startAt={startAtSnapshot}
            onTimeUpdate={handleTimeUpdate}
            onPlaybackProgress={handleNativePlaybackProgress}
            onSeek={handleSeek}
            onEmbedPlayback={handleEmbedPlayback}
            onAutoplayBlocked={() => { memberAutoplayBlockedRef.current = true; }}
            onNativeChange={(native) => { memberNativeRef.current = native; }}
            syncBehindSeconds={memberDrift}
            hostNotice={hostNotice}
            hostPauseReason={hostPauseReason}
            syncRate={syncRate}
            videoElementRef={memberVideoRef}
            onSyncToHost={syncMemberToHost}
            onHostPause={handleHostPause}
            onHostResume={handleHostResume}
            fullPage={playerFullPage}
            onClose={() => {
              // Back out of the player page; popstate then closes it.
              if ((window.history.state as { noirPlayer?: boolean } | null)?.noirPlayer) {
                window.history.back();
                return;
              }
              if (new URLSearchParams(window.location.search).get('play') === '1') {
                const url = new URL(window.location.href);
                url.searchParams.delete('play');
                window.history.replaceState(window.history.state, '', url.toString());
                window.dispatchEvent(new Event('noir:route'));
              }
              setIsPlayerOpen(false);
            }}
            onSwitchMode={(mode) => setPlayerMode(mode)}
            onNextEpisode={handleNextEpisode}
          />
        )}

        {/* Recomendations module list titles */}
        {recommendations.length > 0 && (
          <div className="noir-detail-reco border-t border-white/5 pt-12 mt-12">
            <MovieRow
              title="More like this"
              items={recommendations}
              onItemClick={onItemClick}
              isSaved={(item) => watchlist.some((savedItem) => savedItem.id === item.id && savedItem.type === item.type)}
              onToggleSave={onToggleWatchlistItem}
              flush
            />
</div>
        )}

</div>
</div>
  );
}
