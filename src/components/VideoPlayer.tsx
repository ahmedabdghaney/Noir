/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import type { NativePlaybackProgress } from '../types';
import {
  Loader, Pause, Play, Lock,
  Subtitles, Settings, Maximize2, Minimize2,
  Plus, Minus, ChevronDown,
  Volume2, VolumeX, Volume1, SkipForward, X,
} from 'lucide-react';

interface VideoPlayerProps {
  type: 'movie' | 'tv';
  id: number;
  title: string;
  posterPath?: string | null;   // مسار صورة TMDB — يُعرض بشاشة قفل iPhone (MediaSession)
  season?: number;
  episode?: number;
  episodesCount?: number;
  hasNextEpisode?: boolean;
  introEndSeconds?: number;
  youtubeKey?: string | null;
  playMode: 'movie' | 'trailer';
  isPausedByHost?: boolean;
  hostPauseByName?: string;
  isLiveHost?: boolean;
  isLiveSession?: boolean;
  startAt?: number;
  onTimeUpdate?: (seconds: number) => void;
  onPlaybackProgress?: (progress: NativePlaybackProgress) => void;
  onSeek?: (seconds: number) => void;
  onHostPause?: () => void;
  onHostResume?: () => void;
  onClose: () => void;
  onSwitchMode: (mode: 'movie' | 'trailer') => void;
  onNextEpisode?: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const CDN_BASE_URL = 'https://d269k7J205s3hx.cloudfront.net/';

// تنظيف اسم المسلسل ليطابق مسار S3 — لازم يطابق sanitizeName ببوت المسلسلات حرفياً
function sanitizeName(name: string): string {
  return (name || '')
    .replace(/[:/\\?#%"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function VideoPlayer({
  type, id, title,
  posterPath = null,
  season = 1, episode = 1,
  episodesCount = 0,
  hasNextEpisode,
  introEndSeconds = 0,
  youtubeKey, playMode,
  isPausedByHost = false, hostPauseByName = '',
  isLiveHost = false, isLiveSession = false,
  startAt = 0,
  onTimeUpdate, onPlaybackProgress, onSeek,
  onClose, onSwitchMode, onNextEpisode,
}: VideoPlayerProps) {

  const containerRef  = useRef<HTMLDivElement>(null);
  const videoRef      = useRef<HTMLVideoElement>(null);
  const progressRef   = useRef<HTMLDivElement>(null);
  const hideTimer     = useRef<ReturnType<typeof setTimeout>>();
  const dblClickTimer = useRef<ReturnType<typeof setTimeout>>();
  const seekFlashTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastProgressReportAtRef = useRef(0);
  const activeScrubPointerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchHoldActivatedRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const lastTouchTapRef = useRef<{ at: number; zone: 'left' | 'center' | 'right' } | null>(null);

  const [isLoading,       setIsLoading]       = useState(true);
  const [isBuffering,     setIsBuffering]     = useState(false);
  const [customMp4Failed, setCustomMp4Failed] = useState(false);
  const [isPlaying,       setIsPlaying]       = useState(false);
  const [currentTime,     setCurrentTime]     = useState(0);
  const [duration,        setDuration]        = useState(0);
  const [buffered,        setBuffered]        = useState(0);
  const [volume,          setVolume]          = useState(1);
  const [isMuted,         setIsMuted]         = useState(false);
  const [showVolume,      setShowVolume]      = useState(false);
  const [subEnabled,      setSubEnabled]      = useState(true);
  const [subSize,         setSubSize]         = useState(50); // نسبة حجم الترجمة %
  const [subOffset,       setSubOffset]       = useState(0);  // تأخير الترجمة بالثانية (+/-)
  const [cueText,         setCueText]         = useState('');  // نص الترجمة الحالي
  const [speed,           setSpeed]           = useState(1);
  const [showSettings,    setShowSettings]    = useState(false);
  const [showSpeedMenu,   setShowSpeedMenu]   = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [iosNativeFs,     setIosNativeFs]     = useState(false); // iPhone native video fullscreen
  const [autoplayNext, setAutoplayNext] = useState(
    () => localStorage.getItem('noir_autoplay_next') !== 'false',
  );
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | null>(null);
  const [showStillWatching, setShowStillWatching] = useState(false);

  const [controlsVisible, setControlsVisible] = useState(true);

  // hover preview على شريط التقدم
  const [hoverPct,   setHoverPct]   = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  // فلاش السيك (مثل اليوتيوب لما تدبل تاب)
  const [seekFlash, setSeekFlash] = useState<{ dir: 'fwd' | 'back'; amount: number } | null>(null);
  // مؤشر الوقف/التشغيل بالوسط
  const [playPulse, setPlayPulse] = useState<{ kind: 'play' | 'pause'; key: number } | null>(null);
  // الضغط المستمر بالكيبورد للسيك (تبقى الأيقونة ظاهرة)
  const [seekHold, setSeekHold] = useState<'fwd' | 'back' | null>(null);
  // تسريع 2x مؤقت بالضغط المستمر على Space
  const [speedBoost, setSpeedBoost] = useState(false);
  // مصدر الـ embed المختار: 0 = VidSrc (أساسي)، 1 = vidapi (احتياطي)
  const [embedSource, setEmbedSource] = useState(0);

  /* ── URLs + native flag (معرّفة مبكراً عشان الـ effects تستخدمها) ── */
  // المسلسلات: TV/{اسم}/{tmdbId}/Season {n}/{episode}
  // الأفلام:   Movies/{اسم}/{tmdbId}/movie  — tmdbId يميّز الأفلام بنفس الاسم (Scream 1997 vs 2022)
  let mp4Url: string, vttUrl: string;
  if (type === 'tv') {
    const seriesFolder = sanitizeName(title);
    const pathParts = ['TV', seriesFolder, String(id), `Season ${season}`];
    const encodedDir = pathParts.map((p) => encodeURIComponent(p)).join('/');
    mp4Url = `${CDN_BASE_URL}${encodedDir}/${episode}.mp4`;
    vttUrl = `${CDN_BASE_URL}${encodedDir}/${episode}.vtt`;
  } else {
    const movieFolder = sanitizeName(title);
    const encodedDir = ['Movies', movieFolder].map((p) => encodeURIComponent(p)).join('/');
    mp4Url = `${CDN_BASE_URL}${encodedDir}/movie_${id}.mp4`;
    vttUrl = `${CDN_BASE_URL}${encodedDir}/movie_${id}.vtt`;
  }
  const customMp4 = playMode === 'movie' ? mp4Url : undefined;
  const vttSrc    = vttUrl;
  const isNative = Boolean(playMode === 'movie' && customMp4 && !customMp4Failed);

  const reportNativeProgress = useCallback(
    (video: HTMLVideoElement | null, completed = false, force = false) => {
      if (!video || playMode !== 'movie' || customMp4Failed) return;
      const durationSeconds = Math.max(0, Number(video.duration || 0));
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
      const positionSeconds = Math.min(
        durationSeconds,
        Math.max(0, Number(video.currentTime || 0)),
      );

      const now = Date.now();
      if (!force && now - lastProgressReportAtRef.current < 10000) return;
      lastProgressReportAtRef.current = now;

      const progress = completed
        ? 100
        : Math.max(0, Math.min(100, (positionSeconds / durationSeconds) * 100));
      onPlaybackProgress?.({
        positionSeconds,
        durationSeconds,
        progress,
        completed: completed || progress >= 95,
        season: type === 'tv' ? season : 0,
        episode: type === 'tv' ? episode : 0,
      });
    },
    [customMp4Failed, episode, onPlaybackProgress, playMode, season, type],
  );

  /* ── MediaSession: يعرض اسم الفلم + صورته بشاشة قفل iPhone (بدل اسم نوار) ── */
  useEffect(() => {
    if (playMode !== 'movie') return;
    if (!('mediaSession' in navigator)) return;
    const artwork = posterPath
      ? [
          { src: `https://image.tmdb.org/t/p/w512${posterPath}`, sizes: '512x512', type: 'image/jpeg' },
          { src: `https://image.tmdb.org/t/p/w780${posterPath}`, sizes: '780x780', type: 'image/jpeg' },
        ]
      : [];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || '',
        artist: type === 'tv' ? `الموسم ${season} • الحلقة ${episode}` : 'NOIR',
        album: 'NOIR',
        artwork,
      });
    } catch (_) { /* MediaMetadata غير مدعوم */ }
  }, [title, posterPath, type, season, episode, playMode]);

  useEffect(() => {
    if (!isNative) return;
    const flushProgress = () => reportNativeProgress(videoRef.current, false, true);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushProgress();
    };
    window.addEventListener('pagehide', flushProgress);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      flushProgress();
      window.removeEventListener('pagehide', flushProgress);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isNative, reportNativeProgress]);

  useEffect(() => {
    if (!isNative) return;
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const target = Math.max(0, Math.min(startAt, Math.max(0, video.duration - 3)));
    if (Math.abs(video.currentTime - target) > 2) {
      video.currentTime = target;
      setCurrentTime(target);
    }
  }, [id, isNative, episode, season, startAt, type]);

  /* ── postMessage ── */
  const lastWatchedRef   = useRef(0);
  const lastWatchedAtRef = useRef(0);
  useEffect(() => {
    if (playMode !== 'movie') return;
    lastWatchedRef.current = lastWatchedAtRef.current = 0;
    const handler = (event: MessageEvent) => {
      const d: any = event?.data;
      if (!d || typeof d !== 'object') return;
      let w: number | null = null;
      if      (d.type === 'MEDIA_DATA'   && d.data?.progress?.watched != null) w = Number(d.data.progress.watched);
      else if (d.type === 'PLAYER_EVENT' && d.data?.player_progress   != null) w = Number(d.data.player_progress);
      else if (d.type === 'PLAYER_EVENT' && d.data?.currentTime       != null) w = Number(d.data.currentTime);
      else if (d.event === 'time'        && d.currentTime             != null) w = Number(d.currentTime);
      else if (typeof d.currentTime === 'number')                               w = d.currentTime;
      if (w == null || isNaN(w) || w < 0) return;
      const now = Date.now(), prev = lastWatchedRef.current, prevAt = lastWatchedAtRef.current;
      lastWatchedRef.current = w; lastWatchedAtRef.current = now;
      if (!prev || !prevAt) { onTimeUpdate?.(w); return; }
      const isSeek = (w - prev - (now - prevAt) / 1000) > 5 || (w - prev) < -3;
      isSeek ? onSeek?.(w) : onTimeUpdate?.(w);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [playMode, type, id, season, episode, startAt, onTimeUpdate, onSeek]);

  /* ── reset ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    setIsLoading(true); setCustomMp4Failed(false);
    setSubEnabled(true); setSpeed(1);
    setShowSettings(false); setShowSpeedMenu(false); setShowVolume(false);
    setIsPlaying(false); setCurrentTime(0); setDuration(0); setBuffered(0); setIsBuffering(false);
    setNextEpisodeCountdown(null);
    setShowStillWatching(false);
    return () => clearTimeout(timer);
  }, [type, id, season, episode, playMode]);

  useEffect(() => {
    if (nextEpisodeCountdown == null) return;
    if (nextEpisodeCountdown <= 0) {
      setNextEpisodeCountdown(null);
      onNextEpisode?.();
      return;
    }
    const timer = setTimeout(
      () => setNextEpisodeCountdown((current) => current == null ? null : current - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [nextEpisodeCountdown, onNextEpisode]);

  useEffect(() => () => {
    clearTimeout(hideTimer.current);
    clearTimeout(dblClickTimer.current);
    clearTimeout(seekFlashTimer.current);
    clearTimeout(touchHoldTimer.current);
  }, []);

  /* ── load and cloud-sync playback preferences ── */
  useEffect(() => {
    const applySavedSettings = () => {
      const savedSize = Number(localStorage.getItem('noir_sub_size'));
      const savedOffset = Number(localStorage.getItem('noir_sub_offset'));
      setAutoplayNext(localStorage.getItem('noir_autoplay_next') !== 'false');
      if (savedSize >= 50 && savedSize <= 250) setSubSize(savedSize);
      if (savedOffset >= -10 && savedOffset <= 10) setSubOffset(savedOffset);
    };
    const handleCloudSync = (event: Event) => {
      const settings = (event as CustomEvent<{
        autoplayNext: boolean;
        subtitleSize: number;
        subtitleOffset: number;
      }>).detail;
      if (!settings) return;
      setAutoplayNext(settings.autoplayNext);
      setSubSize(settings.subtitleSize);
      setSubOffset(settings.subtitleOffset);
    };
    applySavedSettings();
    window.addEventListener('noir_playback_settings_sync', handleCloudSync);
    return () => window.removeEventListener('noir_playback_settings_sync', handleCloudSync);
  }, []);

  /* ملاحظة: إغلاق الإعدادات يتم عبر الـ overlay (onPointerDown) — يشتغل ماوس ولمس */

  const persistPlaybackSettings = (
    nextAutoplay: boolean,
    nextSize: number,
    nextOffset: number,
  ) => {
    localStorage.setItem('noir_autoplay_next', String(nextAutoplay));
    localStorage.setItem('noir_sub_size', String(nextSize));
    localStorage.setItem('noir_sub_offset', String(nextOffset));
    window.dispatchEvent(new CustomEvent('noir_playback_settings_updated', {
      detail: {
        autoplayNext: nextAutoplay,
        subtitleSize: nextSize,
        subtitleOffset: nextOffset,
      },
    }));
  };

  const changeSubSize = (delta: number) => {
    setSubSize(prev => {
      const next = Math.max(50, Math.min(250, prev + delta));
      persistPlaybackSettings(autoplayNext, next, subOffset);
      return next;
    });
  };

  const changeSubOffset = (delta: number) => {
    setSubOffset((previous) => {
      const next = Math.max(-10, Math.min(10, previous + delta));
      persistPlaybackSettings(autoplayNext, subSize, next);
      return next;
    });
  };

  const markUserActive = () => {
    localStorage.setItem('noir_consecutive_autoplay_count', '0');
    setShowStillWatching(false);
  };

  /* ── fullscreen event (native only) ── */
  useEffect(() => {
    const h = () => {
      const nativeFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      // مزامنة الحالة مع native fullscreen (أندرويد/آيباد/ديسكتوب)
      // iPhone يستخدم webkitEnterFullscreen على الفيديو ولا يطلق هذا الحدث
      setIsFullscreen(nativeFs);
    };
    document.addEventListener('fullscreenchange', h);
    document.addEventListener('webkitfullscreenchange', h);
    return () => {
      document.removeEventListener('fullscreenchange', h);
      document.removeEventListener('webkitfullscreenchange', h);
    };
  }, []);

  /* ── keyboard controls (مع دعم الضغط المستمر) ── */
  const spaceHeldRef = useRef(false);       // Space مضغوط حالياً؟
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const wasPlayingRef = useRef(false);      // كان شغّال قبل بدء الـ 2x؟
  const speedBoostActiveRef = useRef(false);
  const seekKeyHeldRef = useRef(false);

  const startSpeedBoost = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || speedBoostActiveRef.current) return;
    speedBoostActiveRef.current = true;
    wasPlayingRef.current = !vid.paused;
    if (vid.paused) void vid.play().catch(() => {});
    vid.playbackRate = 2;
    setSpeedBoost(true);
  }, []);

  const endSpeedBoost = useCallback(() => {
    const vid = videoRef.current;
    if (!speedBoostActiveRef.current) return;
    speedBoostActiveRef.current = false;
    setSpeedBoost(false);
    if (!vid) return;
    vid.playbackRate = speed;
    if (!wasPlayingRef.current) vid.pause();
  }, [speed]);

  useEffect(() => {
    const v = () => videoRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      const vid = v();
      if (!vid) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          if (e.repeat) {
            // ضغط مستمر — فعّل الـ 2x بعد ~250ms من بداية الضغط
            if (!spaceHoldTimerRef.current && !speedBoostActiveRef.current) {
              startSpeedBoost();
            }
            break;
          }
          // أول ضغطة — نأجّل القرار: لو انضغط طويل = boost، لو قصير = play/pause
          spaceHeldRef.current = true;
          spaceHoldTimerRef.current = setTimeout(() => {
            startSpeedBoost();
          }, 250);
          break;
        }
        case 'KeyK':
          e.preventDefault(); togglePlay(); break;
        case 'ArrowRight':
          e.preventDefault(); seekBy(5); setSeekHold('fwd'); seekKeyHeldRef.current = true; break;
        case 'ArrowLeft':
          e.preventDefault(); seekBy(-5); setSeekHold('back'); seekKeyHeldRef.current = true; break;
        case 'KeyL':
          e.preventDefault(); seekBy(10); setSeekHold('fwd'); seekKeyHeldRef.current = true; break;
        case 'KeyJ':
          e.preventDefault(); seekBy(-10); setSeekHold('back'); seekKeyHeldRef.current = true; break;
        case 'KeyF':
          e.preventDefault(); toggleFullscreen(); break;
        case 'KeyM':
          e.preventDefault(); toggleMute(); break;
        case 'Escape':
          e.preventDefault();
          if (showSettings) {
            setShowSettings(false);
            setShowSpeedMenu(false);
          } else if (isFullscreen) {
            toggleFullscreen();
          } else {
            onClose();
          }
          break;
        case 'ArrowUp':
          e.preventDefault(); changeVolume(vid.volume + 0.1); break;
        case 'ArrowDown':
          e.preventDefault(); changeVolume(vid.volume - 0.1); break;
        default:
          if (e.code.startsWith('Digit')) {
            const n = Number(e.code.replace('Digit', ''));
            if (!isNaN(n) && duration) {
              e.preventDefault();
              const target = (n / 10) * duration;
              vid.currentTime = target;
              setCurrentTime(target);
              onSeek?.(target);
            }
          }
      }
      resetHideTimer();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        clearTimeout(spaceHoldTimerRef.current);
        spaceHoldTimerRef.current = undefined;
        if (speedBoostActiveRef.current) {
          // كان boost — نوقفه
          endSpeedBoost();
        } else if (spaceHeldRef.current) {
          // كانت ضغطة قصيرة — play/pause عادي
          togglePlay();
        }
        spaceHeldRef.current = false;
      }

      if (['ArrowRight', 'ArrowLeft', 'KeyL', 'KeyJ'].includes(e.code)) {
        seekKeyHeldRef.current = false;
        // نخفي أيقونة السيك بعد ما يشيل إيده بقليل
        setTimeout(() => { if (!seekKeyHeldRef.current) setSeekHold(null); }, 400);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, speed, startSpeedBoost, endSpeedBoost, showSettings, isFullscreen, onClose, onSeek]);

  /* ── auto-hide controls after 3s ── */
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !showSettings) setControlsVisible(false);
    }, 3000);
  }, [showSettings]);

  useEffect(() => {
    if (showSettings) {
      clearTimeout(hideTimer.current);
      setControlsVisible(true);
    } else if (videoRef.current && !videoRef.current.paused) {
      resetHideTimer();
    }
  }, [showSettings, resetHideTimer]);

  /* ── helpers ── */
  const syncSubtitleTrackMode = useCallback((
    enabled = subEnabled,
    nativeFullscreen = iosNativeFs,
  ) => {
    const v = videoRef.current;
    if (!v?.textTracks?.length) return;
    v.textTracks[0].mode = !enabled
      ? 'disabled'
      : nativeFullscreen
        ? 'showing'
        : 'hidden';
  }, [subEnabled, iosNativeFs]);

  const toggleSubs = () => {
    const v = videoRef.current;
    if (!v?.textTracks?.length) return;
    const next = !subEnabled;
    syncSubtitleTrackMode(next);
    if (!next) setCueText('');
    setSubEnabled(next);
  };

  /* Safari قد يفعّل track افتراضياً قبل اكتمال تحميله.
     ثبّت الوضع بعد تحميل الفيديو والـ VTT حتى يبقى العرض المخصص وحده. */
  useEffect(() => {
    if (!isNative) return;
    const v = videoRef.current;
    if (!v) return;

    const sync = () => syncSubtitleTrackMode();
    const trackElement = v.querySelector('track');
    sync();
    trackElement?.addEventListener('load', sync);
    return () => trackElement?.removeEventListener('load', sync);
  }, [isNative, customMp4, vttSrc, syncSubtitleTrackMode]);

  /* ── custom subtitle rendering: اقرأ الـ cue الحالي وارسمه بنفسنا ── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isNative) return;
    const track = v.textTracks?.[0];
    if (!track) return;
    // وقت iPhone native fullscreen نخلي iOS يدير الـ track (showing) — ما نلمسه
    if (iosNativeFs) return;
    // hidden = الأحداث تشتغل بس بدون رسم المتصفح الأصلي
    // metadata kind: hidden = نقرأ الـ cues بدون عرض native, disabled = نوقف الـ events
    track.mode = subEnabled ? 'hidden' : 'disabled';

    const onCueChange = () => {
      if (!subEnabled) { setCueText(''); return; }
      // نطبّق subOffset: نبحث يدوياً عن الـ cue المناسب للوقت المعدّل
      const vid = videoRef.current;
      const adjustedTime = (vid?.currentTime ?? 0) - (subOffset);
      const allCues = track.cues ? Array.from(track.cues as any) : [];
      const matching = allCues.filter((c: any) => adjustedTime >= c.startTime && adjustedTime <= c.endTime);
      if (matching.length > 0) {
        setCueText(matching.map((c: any) => c.text).join('\n'));
      } else {
        setCueText('');
      }
    };

    track.addEventListener('cuechange', onCueChange);
    // نستمع لـ timeupdate أيضاً عشان يتحدث مع الـ offset
    const vid = videoRef.current;
    vid?.addEventListener('timeupdate', onCueChange);
    onCueChange();
    return () => {
      track.removeEventListener('cuechange', onCueChange);
      vid?.removeEventListener('timeupdate', onCueChange);
    };
  }, [isNative, subEnabled, customMp4, iosNativeFs, subOffset]);

  const changeSpeed = (s: number) => {
    if (videoRef.current) videoRef.current.playbackRate = s;
    setSpeed(s); setShowSpeedMenu(false); setShowSettings(false);
  };

  /* ── iPhone native fullscreen: ارفع الترجمة من قاع الشاشة (cue.line) ── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v?.textTracks?.length || !iosNativeFs) return;
    const track = v.textTracks[0];
    // line = رقم السطر من الأعلى (سالب = من الأسفل). -3 يرفعها فوق حافة الشاشة
    const applyLine = () => {
      const cues = track.cues;
      if (!cues) return;
      for (let i = 0; i < cues.length; i++) {
        try { (cues[i] as any).line = -3; (cues[i] as any).snapToLines = true; } catch (_) {}
      }
    };
    applyLine();
    track.addEventListener('cuechange', applyLine);
    return () => track.removeEventListener('cuechange', applyLine);
  }, [iosNativeFs, subEnabled]);

  const playPulseTimer = useRef<ReturnType<typeof setTimeout>>();
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    markUserActive();
    clearTimeout(playPulseTimer.current);
    if (v.paused) {
      void v.play().catch(() => {});
      setPlayPulse({ kind: 'play', key: Date.now() });
    } else {
      v.pause();
      setPlayPulse({ kind: 'pause', key: Date.now() });
    }
    playPulseTimer.current = setTimeout(() => setPlayPulse(null), 750);
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    v.muted  = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || v.volume === 0) {
      v.muted  = false;
      v.volume = volume > 0 ? volume : 0.8;
      setIsMuted(false);
      setVolume(v.volume);
    } else {
      v.muted = true;
      setIsMuted(true);
    }
  };

  const seekBy = (s: number) => {
    if (!videoRef.current) return;
    markUserActive();
    videoRef.current.currentTime = Math.max(0, Math.min(duration || Infinity, videoRef.current.currentTime + s));
    onSeek?.(videoRef.current.currentTime);
    setSeekFlash({ dir: s > 0 ? 'fwd' : 'back', amount: Math.abs(s) });
    clearTimeout(seekFlashTimer.current);
    seekFlashTimer.current = setTimeout(() => setSeekFlash(null), 1200);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current as any;
    const vid = videoRef.current as any;

    // كشف iPhone فقط — fullscreen API على div ما تشتغل أبداً
    const isIPhone = /iPhone|iPod/.test(navigator.userAgent);

    // ── الخروج ──
    if (isFullscreen) {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if (vid?.webkitExitFullscreen) {
        vid.webkitExitFullscreen();
      }
      try { (screen.orientation as any)?.unlock?.(); } catch (_) {}
      setIsFullscreen(false);
      return;
    }

    // ── الدخول ──
    // iPhone — لازم fullscreen على عنصر <video> نفسه (الوحيد المدعوم)
    // نحوّل الـ track لـ showing عشان iOS يعرض الترجمة بكنترولاته (الـ offset مطبّق أصلاً على الـ cues)
    if (isIPhone && vid?.webkitEnterFullscreen) {
      if (subEnabled && vid.textTracks?.[0]) vid.textTracks[0].mode = 'showing';
      setIosNativeFs(true);
      const onEnd = () => {
        setIosNativeFs(false);
        // رجّع الـ track لـ hidden عشان يرجع الـ overlay المخصّص
        if (vid.textTracks?.[0]) vid.textTracks[0].mode = subEnabled ? 'hidden' : 'disabled';
        vid.removeEventListener('webkitendfullscreen', onEnd);
      };
      vid.addEventListener('webkitendfullscreen', onEnd);
      vid.webkitEnterFullscreen();
      // ما نضبط isFullscreen — iOS يدير العرض بنفسه
      return;
    }

    // باقي الأجهزة (أندرويد/آيباد/ديسكتوب) — fullscreen على الـ container
    const enter = () => {
      setIsFullscreen(true);
      try { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); } catch (_) {}
    };
    if (el?.requestFullscreen) {
      el.requestFullscreen().then(enter).catch(enter);
    } else if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      enter();
    } else {
      enter(); // fallback CSS
    }
  };

  const getTapZone = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    return x < rect.width * 0.3 ? 'left' : x > rect.width * 0.7 ? 'right' : 'center';
  };

  const handleVideoPointerDown = (e: ReactPointerEvent<HTMLVideoElement>) => {
    if (e.pointerType !== 'touch' || !isNative) return;
    touchStartRef.current = { x: e.clientX, y: e.clientY };
    touchHoldActivatedRef.current = false;
    clearTimeout(touchHoldTimer.current);
    touchHoldTimer.current = setTimeout(() => {
      touchHoldActivatedRef.current = true;
      clearTimeout(dblClickTimer.current);
      lastTouchTapRef.current = null;
      startSpeedBoost();
    }, 450);
  };

  const handleVideoPointerMove = (e: ReactPointerEvent<HTMLVideoElement>) => {
    if (e.pointerType !== 'touch' || !touchStartRef.current || touchHoldActivatedRef.current) return;
    const moved = Math.hypot(
      e.clientX - touchStartRef.current.x,
      e.clientY - touchStartRef.current.y,
    );
    if (moved > 12) {
      clearTimeout(touchHoldTimer.current);
      touchStartRef.current = null;
    }
  };

  const finishTouchInteraction = (e: ReactPointerEvent<HTMLVideoElement>, cancelled = false) => {
    if (e.pointerType !== 'touch') return;
    clearTimeout(touchHoldTimer.current);
    ignoreNextClickRef.current = true;
    setTimeout(() => { ignoreNextClickRef.current = false; }, 0);

    if (touchHoldActivatedRef.current) {
      touchHoldActivatedRef.current = false;
      touchStartRef.current = null;
      endSpeedBoost();
      return;
    }

    if (cancelled || !touchStartRef.current) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = null;
    const zone = getTapZone(e.clientX, e.currentTarget);
    const now = Date.now();
    const previous = lastTouchTapRef.current;
    const isDoubleTap = !!previous && now - previous.at <= 320 && previous.zone === zone;

    if (isDoubleTap) {
      clearTimeout(dblClickTimer.current);
      lastTouchTapRef.current = null;
      if (zone === 'left') seekBy(-10);
      else if (zone === 'right') seekBy(10);
      else toggleFullscreen();
      resetHideTimer();
      return;
    }

    lastTouchTapRef.current = { at: now, zone };
    clearTimeout(dblClickTimer.current);
    dblClickTimer.current = setTimeout(() => {
      lastTouchTapRef.current = null;
      togglePlay();
      resetHideTimer();
    }, 320);
  };

  /* ── tap: ضغطة = play/pause، ضغطتين على الجوانب = seek، الوسط = fullscreen ── */
  const handleVideoClick = (e: ReactMouseEvent) => {
    if (!isNative) return;
    e.stopPropagation();
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    const zone = getTapZone(e.clientX, e.currentTarget as HTMLElement);

    if ((e as any).detail === 2) {
      // ضغطتين — ألغِ فعل الضغطة الواحدة المعلّق
      clearTimeout(dblClickTimer.current);
      if (zone === 'left') seekBy(-10);
      else if (zone === 'right') seekBy(10);
      else toggleFullscreen();
    } else {
      // ضغطة واحدة — وقف/تشغيل (بتأخير بسيط عشان نميّزها عن الدبل)
      clearTimeout(dblClickTimer.current);
      dblClickTimer.current = setTimeout(() => {
        togglePlay();
        resetHideTimer();
      }, 300);
    }
  };

  /* ── progress bar: pointer drag يدعم الماوس واللمس والقلم ── */
  const pctFromEvent = (clientX: number) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const updateScrub = (clientX: number) => {
    if (!videoRef.current || !duration) return;
    const pct = pctFromEvent(clientX);
    videoRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
    setHoverPct(pct * 100);
  };

  const startScrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    e.preventDefault();
    markUserActive();
    activeScrubPointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    updateScrub(e.clientX);
  };

  const moveScrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activeScrubPointerRef.current === e.pointerId) updateScrub(e.clientX);
    else if (e.pointerType === 'mouse') setHoverPct(pctFromEvent(e.clientX) * 100);
  };

  const endScrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activeScrubPointerRef.current !== e.pointerId) return;
    updateScrub(e.clientX);
    activeScrubPointerRef.current = null;
    setIsScrubbing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (videoRef.current) onSeek?.(videoRef.current.currentTime);
  };

  /* ── URLs ── */
  // قائمة مشغّلات الـ embed بالترتيب — لو وحدة ما اشتغلت، بدّل من الزر
  const EMBED_SERVERS = [
    {
      name: 'مشغل 1',
      movie: () => `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true`,
      tv: () => `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}?autoPlay=true`,
    },
    {
      name: 'مشغل 2',
      movie: () => {
        const params = new URLSearchParams({ primaryColor: 'ff453a', secondaryColor: '0a0a0a', iconColor: 'FFFFFF', icons: 'vid', title: 'true', poster: 'true', autoplay: 'true' });
        if (startAt && startAt > 5) params.set('startAt', String(Math.floor(startAt)));
        return `https://vidapi.qzz.io/movie/${id}?${params}`;
      },
      tv: () => {
        const params = new URLSearchParams({ primaryColor: 'ff453a', secondaryColor: '0a0a0a', iconColor: 'FFFFFF', icons: 'vid', title: 'true', poster: 'true', autoplay: 'true', nextbutton: 'true' });
        if (startAt && startAt > 5) params.set('startAt', String(Math.floor(startAt)));
        return `https://vidapi.qzz.io/tv/${id}/${season}/${episode}?${params}`;
      },
    },
    {
      name: 'مشغل 3',
      movie: () => `https://vidsrc-embed.ru/embed/movie?tmdb=${id}&autoplay=1`,
      tv: () => `https://vidsrc-embed.ru/embed/tv?tmdb=${id}&season=${season}&episode=${episode}&autoplay=1&autonext=1`,
    },
  ];

  const getEmbedUrl = () => {
    if (playMode === 'trailer' && youtubeKey) {
      return `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&origin=${encodeURIComponent(window.location.origin)}`;
    }
    const srv = EMBED_SERVERS[embedSource] || EMBED_SERVERS[0];
    return type === 'tv' ? srv.tv() : srv.movie();
  };

  const progressPct = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
  const bufferedPct = duration > 0 ? Math.max(0, Math.min(100, (buffered / duration) * 100)) : 0;
  const hasNextEp = type === 'tv' && !!onNextEpisode && (
    hasNextEpisode ?? (episodesCount === 0 || episode < episodesCount)
  );

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  /* ══════════════════════════════════════ render ══ */

  // نخفي native cue بس لما يكون الـ overlay المخصّص شغال (المشغّل العادي)
  // وقت iPhone native fullscreen: iOS يعرض الترجمة الأصلية — نتحكم بحجمها عبر ::cue
  // (موضعها يُتحكم بـ track.cues[].line اللي نضبطه بـ effect منفصل)
  const hideCueStyle = iosNativeFs
    ? `video::cue { font-size: calc(${subSize / 100} * (1.1em + 0.4vw)) !important; background: rgba(0,0,0,0.55) !important; }`
    : `video::cue { color: transparent !important; text-shadow: none !important; background: transparent !important; }`;

  const sliderStyle = `
    @keyframes noir-flash { 0% { opacity: 0; transform: scale(.86); } 18% { opacity: 1; transform: scale(1); } 72% { opacity: 1; } 100% { opacity: 0; transform: scale(1.04); } }
    .noir-flash { animation: noir-flash .8s cubic-bezier(.2,.8,.2,1) forwards; }
    @keyframes noir-pulse { 0% { opacity: 0; transform: scale(.72); } 20% { opacity: 1; transform: scale(1.04); } 48% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(.96); } }
    .noir-pulse { animation: noir-pulse .62s cubic-bezier(.2,.8,.2,1) forwards; }
    @media (prefers-reduced-motion: reduce) {
      .noir-flash, .noir-pulse { animation-duration: .01ms !important; }
    }
  `;

  return (
    <div ref={containerRef} className={`${isFullscreen ? 'fixed inset-0 z-[9999] w-screen h-screen max-w-none m-0 rounded-none' : 'w-full mt-16 sm:mt-20 mb-6 mx-auto max-w-[94%] md:max-w-6xl xl:max-w-7xl'}`}>
      <style>{sliderStyle}</style>
      <style>{hideCueStyle}</style>
      <div
        className={`group/player relative bg-black overflow-hidden shadow-[0_24px_64px_-12px_rgba(0,0,0,0.95)] ${isFullscreen ? 'w-full h-full rounded-none border-0' : 'rounded-2xl border border-white/10'}`}
        dir="ltr"
        onMouseMove={resetHideTimer}
        onMouseLeave={() => { if (videoRef.current && !videoRef.current.paused && !showSettings) setControlsVisible(false); }}
      >
        <div className={`relative w-full bg-black ${isFullscreen ? 'h-full' : 'aspect-video'}`}>

          {/* loading */}
          {(isLoading || isBuffering) && !isPausedByHost && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center z-20 gap-3 pointer-events-none ${isLoading ? 'bg-black' : 'bg-black/10'}`}>
              <div className={`${isLoading ? '' : 'w-14 h-14 rounded-full bg-black/55 backdrop-blur-md'} flex items-center justify-center`}>
                <Loader className={`${isLoading ? 'w-8 h-8' : 'w-7 h-7'} text-red-500 animate-spin`} />
              </div>
              {isLoading && <span className="text-xs text-white/40 select-none">جاري التحميل...</span>}
            </div>
          )}

          {/* trailer */}
          {playMode === 'trailer' ? (
            <iframe src={getEmbedUrl()} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="w-full h-full border-0" onLoad={() => setIsLoading(false)} />

          /* native mp4 */
          ) : isNative ? (
            <video
              ref={videoRef}
              key={`mp4-${id}-${episode}`}
              autoPlay playsInline
              crossOrigin="anonymous"
              className={`w-full h-full bg-black select-none touch-manipulation ${controlsVisible ? 'cursor-default' : 'cursor-none'}`}
              onClick={handleVideoClick}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={handleVideoPointerDown}
              onPointerMove={handleVideoPointerMove}
              onPointerUp={(event) => finishTouchInteraction(event)}
              onPointerCancel={(event) => finishTouchInteraction(event, true)}
              onLoadedMetadata={() => {
                const video = videoRef.current;
                if (!video) return;
                syncSubtitleTrackMode();
                const videoDuration = Number(video.duration || 0);
                setDuration(videoDuration);
                if (
                  startAt > 5 &&
                  Number.isFinite(videoDuration) &&
                  startAt < videoDuration - 3
                ) {
                  video.currentTime = startAt;
                  setCurrentTime(startAt);
                }
              }}
              onLoadedData={() => { setIsLoading(false); setDuration(videoRef.current?.duration || 0); }}
              onCanPlay={() => { setIsLoading(false); setIsBuffering(false); }}
              onError={() => setCustomMp4Failed(true)}
              onPlay={() => { setIsPlaying(true); resetHideTimer(); }}
              onPlaying={() => { setIsLoading(false); setIsBuffering(false); }}
              onWaiting={() => setIsBuffering(true)}
              onSeeking={() => setIsBuffering(true)}
              onSeeked={() => setIsBuffering(false)}
              onPause={() => {
                setIsPlaying(false);
                setControlsVisible(true);
                clearTimeout(hideTimer.current);
                reportNativeProgress(videoRef.current, false, true);
              }}
              onTimeUpdate={() => {
                const video = videoRef.current;
                const time = video?.currentTime || 0;
                setCurrentTime(time);
                onTimeUpdate?.(time);
                reportNativeProgress(video);
              }}
              onEnded={() => {
                reportNativeProgress(videoRef.current, true, true);
                setIsPlaying(false);
                setControlsVisible(true);
                if (autoplayNext && hasNextEp) {
                  const consecutive = Number(
                    localStorage.getItem('noir_consecutive_autoplay_count') || 0,
                  );
                  if (consecutive >= 2) {
                    setShowStillWatching(true);
                  } else {
                    localStorage.setItem(
                      'noir_consecutive_autoplay_count',
                      String(consecutive + 1),
                    );
                    setNextEpisodeCountdown(8);
                  }
                }
              }}
              onProgress={() => {
                const v = videoRef.current;
                if (v && v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
              }}
              onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
              onVolumeChange={() => {
                const v = videoRef.current;
                if (!v) return;
                setIsMuted(v.muted);
                setVolume(v.volume);
              }}
            >
              <source src={customMp4} type="video/mp4" />
              <track
                kind="subtitles"
                srcLang="ar"
                label="العربية"
                src={vttSrc}
                onLoad={() => syncSubtitleTrackMode()}
              />
            </video>

          /* fallback iframe */
          ) : (
            <>
              <iframe key={`player-${id}-${episode}-${embedSource}`} src={isPausedByHost ? 'about:blank' : getEmbedUrl()} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" referrerPolicy="no-referrer" allowFullScreen className="w-full h-full border-0" onLoad={() => setIsLoading(false)} />

              {/* مبدّل المشغلات — يظهر بس بمشغلات الـ embed (مو المشغل الأصلي) */}
              {playMode === 'movie' && !isPausedByHost && (
                <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-full p-1 border border-white/10">
                  {EMBED_SERVERS.map((srv, i) => (
                    <button
                      key={i}
                      onClick={() => { setEmbedSource(i); setIsLoading(true); }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all ${embedSource === i ? 'bg-red-600 text-white' : 'text-white/60 hover:text-white'}`}
                    >
                      {srv.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {!isNative && (
            <div className="absolute top-3 right-3 z-40">
              <Btn onClick={onClose} label="إغلاق المشغل">
                <X className="w-5 h-5" />
              </Btn>
            </div>
          )}

          {/* ══ custom subtitle overlay (تحكم كامل بالحجم) ══ */}
          {isNative && subEnabled && cueText && (
            <div
              className={`absolute inset-x-0 z-20 flex justify-center pointer-events-none transition-all duration-300 ${controlsVisible ? 'bottom-24' : 'bottom-8'}`}
              dir="rtl"
            >
              <div
                className="max-w-[90%] text-center leading-snug"
                style={{
                  fontSize: `calc(${subSize / 100} * (1rem + 0.9vw))`,
                  color: '#fff',
                  textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9)',
                }}
              >
                {cueText.split('\n').map((line, i) => (
                  <div key={i}>
                    <span
                      className="inline-block rounded-md px-2 py-0.5"
                      style={{ background: 'rgba(0,0,0,0.5)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}
                    >
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ top gradient + title bar (native) ══ */}
          {isNative && (
            <div className={`absolute inset-x-0 top-0 z-30 transition-opacity duration-200 ease-out ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-transparent pointer-events-none h-24" />
              <div className="relative flex items-center gap-3 px-4 pt-3">
                <div className="min-w-0 flex-1" dir="rtl">
                  <h2 className="text-white text-sm md:text-base font-semibold truncate drop-shadow">{title}</h2>
                  {type === 'tv' && (
                    <p className="text-white/50 text-[11px] md:text-xs truncate">الموسم {season} • الحلقة {episode}</p>
                  )}
                </div>
                {youtubeKey && (
                  <button onClick={() => onSwitchMode('trailer')}
                    className="shrink-0 text-[11px] md:text-xs text-white/80 hover:text-white bg-white/5 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 transition-all" dir="rtl">
                    التريلر
                  </button>
                )}
                <Btn onClick={onClose} label="إغلاق المشغل">
                  <X className="w-5 h-5" />
                </Btn>
              </div>
            </div>
          )}

          {/* ══ seek flash + seekHold persistent ══ */}
          {isNative && (seekFlash || seekHold) && (
            <div className={`absolute inset-y-0 z-20 flex items-center pointer-events-none
              ${(seekFlash?.dir || seekHold) === 'fwd' ? 'right-0 pr-12 justify-end' : 'left-0 pl-12 justify-start'}`}
              style={{ width: '40%' }}>
              <div className={`flex flex-col items-center gap-1 text-white transition-opacity duration-150 ${seekHold ? 'opacity-100' : 'noir-flash'}`}>
                <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-xl border border-white/15 shadow-[0_8px_30px_rgba(0,0,0,.35)] flex items-center justify-center">
                  {(seekFlash?.dir || seekHold) === 'fwd'
                    ? <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 5v14l8-7zM4 5v14l8-7z" fill="currentColor" /></svg>
                    : <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5v14l-8-7zM20 5v14l-8-7z" fill="currentColor" /></svg>}
                </div>
                <span className="text-xs font-semibold">{seekFlash?.amount ?? (seekHold === 'fwd' ? 5 : 5)} ثانية</span>
              </div>
            </div>
          )}

          {/* ══ center play/pause pulse ══ */}
          {isNative && playPulse && (
            <div key={playPulse.key} className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none noir-pulse">
              <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full bg-black/45 backdrop-blur-xl border border-white/15 shadow-[0_10px_36px_rgba(0,0,0,.4)] flex items-center justify-center">
                {playPulse.kind === 'pause'
                  ? <svg viewBox="0 0 24 24" fill="white" className="w-9 h-9"><rect x="5" y="4" width="4" height="16" rx="1.5"/><rect x="15" y="4" width="4" height="16" rx="1.5"/></svg>
                  : <svg viewBox="0 0 24 24" fill="white" className="w-9 h-9" style={{ marginLeft: 3 }}><path d="M6 4l14 8-14 8V4z"/></svg>}
              </div>
            </div>
          )}

          {/* ══ 2x speed boost pill ══ */}
          {isNative && speedBoost && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/20 text-white text-sm font-semibold tracking-wide">
                ⚡ أسرع بمرتين
              </div>
            </div>
          )}

          {isNative && introEndSeconds > 0 && currentTime >= 2 && currentTime < introEndSeconds && (
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                markUserActive();
                video.currentTime = Math.min(introEndSeconds, duration || introEndSeconds);
                setCurrentTime(video.currentTime);
                onSeek?.(video.currentTime);
              }}
              className="absolute bottom-24 right-4 sm:right-7 z-30 inline-flex items-center gap-2 rounded-lg border border-white/70 bg-black/70 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-lg hover:bg-white hover:text-black transition-colors cursor-pointer"
              dir="rtl"
            >
              <SkipForward className="w-4 h-4" />
              تخطي المقدمة
            </button>
          )}

          {isNative && nextEpisodeCountdown != null && (
            <div
              className="absolute inset-0 z-30 flex items-end justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 sm:p-7"
              dir="rtl"
            >
              <div className="w-full sm:w-auto sm:min-w-[320px] rounded-[22px] border border-white/12 bg-black/70 backdrop-blur-2xl p-4 sm:p-5 shadow-2xl">
                <p className="text-xs font-semibold text-white/55">الحلقة التالية</p>
                <h3 className="mt-1 text-lg font-bold text-white">
                  تبدأ خلال {nextEpisodeCountdown} ثواني
                </h3>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      markUserActive();
                      setNextEpisodeCountdown(null);
                      onNextEpisode?.();
                    }}
                    className="noir-button-primary flex-1 cursor-pointer"
                  >
                    تشغيل الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markUserActive();
                      setNextEpisodeCountdown(null);
                    }}
                    className="noir-button-secondary flex-1 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {isNative && showStillWatching && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-5"
              dir="rtl"
            >
              <div className="w-full max-w-sm rounded-[24px] border border-white/12 bg-[#151518] p-6 text-center shadow-2xl">
                <h3 className="text-xl font-bold text-white">بعدك تشاهد؟</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  أوقفنا التشغيل التلقائي حتى ما تستمر الحلقات بدونك.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('noir_consecutive_autoplay_count', '0');
                      setShowStillWatching(false);
                      onNextEpisode?.();
                    }}
                    className="noir-button-primary flex-1 cursor-pointer"
                  >
                    نعم، أكمل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('noir_consecutive_autoplay_count', '0');
                      setShowStillWatching(false);
                    }}
                    className="noir-button-secondary flex-1 cursor-pointer"
                  >
                    توقف
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* host paused overlay */}
          {isPausedByHost && playMode === 'movie' && (
            <div className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 select-none" dir="rtl">
              <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                <Pause className="w-7 h-7 text-amber-400 fill-amber-400" />
              </div>
              <div className="text-center px-6">
                <h3 className="text-white text-base md:text-lg font-bold mb-1">أوقف المنظم التشغيل</h3>
                {hostPauseByName && <p className="text-gray-400 text-xs md:text-sm">بانتظار <span className="text-amber-400 font-semibold">{hostPauseByName}</span></p>}
                {isLiveHost && <p className="text-gray-500 text-[11px] mt-3">اضغط زر الاستئناف لإكمال المشاهدة</p>}
                {!isLiveHost && isLiveSession && <p className="text-gray-500 text-[11px] mt-3 flex items-center justify-center gap-1.5"><Lock className="w-3 h-3" /> التحكم بيد المنظم فقط</p>}
              </div>
            </div>
          )}

          {/* ══ bottom controls (glass) ══ */}
          {isNative && (
            <div
              className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-200 ease-out ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

              <div className="relative px-3 sm:px-4 pb-3 pt-10 flex flex-col gap-1.5">

                {/* progress bar */}
                <div
                  ref={progressRef}
                  className="group/bar w-full py-3 sm:py-2 cursor-pointer relative touch-none"
                  role="slider"
                  tabIndex={0}
                  aria-label="موضع التشغيل"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(0, Math.floor(duration))}
                  aria-valuenow={Math.max(0, Math.floor(currentTime))}
                  aria-valuetext={`${formatTime(currentTime)} من ${formatTime(duration)}`}
                  onPointerDown={startScrub}
                  onPointerMove={moveScrub}
                  onPointerUp={endScrub}
                  onPointerCancel={endScrub}
                  onPointerLeave={() => !isScrubbing && setHoverPct(null)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                    event.preventDefault();
                    event.stopPropagation();
                    seekBy(event.key === 'ArrowRight' ? 5 : -5);
                  }}
                >
                  {/* hover time tooltip */}
                  {hoverPct !== null && duration > 0 && (
                    <div className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-[11px] text-white tabular-nums pointer-events-none whitespace-nowrap"
                      style={{ left: `${Math.max(4, Math.min(96, hoverPct))}%` }}>
                      {formatTime((hoverPct / 100) * duration)}
                    </div>
                  )}
                  <div className={`relative w-full bg-white/25 rounded-full transition-all duration-150 ${isScrubbing ? 'h-[6px]' : 'h-[4px] group-hover/bar:h-[6px]'}`}>
                    {/* buffered */}
                    <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${bufferedPct}%` }} />
                    {/* hover ghost */}
                    {hoverPct !== null && (
                      <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{ width: `${hoverPct}%` }} />
                    )}
                    {/* played */}
                    <div className="absolute inset-y-0 left-0 bg-red-500 rounded-full" style={{ width: `${progressPct}%` }}>
                      <div className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 shadow-lg transition-opacity ${isScrubbing ? 'opacity-100 scale-110' : 'opacity-0 group-hover/bar:opacity-100'}`} />
                    </div>
                  </div>
                </div>

                {/* bottom row */}
                <div className="flex items-center gap-0.5 sm:gap-1">

                  {/* play/pause */}
                  <Btn onClick={togglePlay} label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'} big>
                    {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
                  </Btn>

                  {/* next episode */}
                  {hasNextEp && (
                    <Btn onClick={() => { markUserActive(); setNextEpisodeCountdown(null); onNextEpisode?.(); }} label="الحلقة التالية">
                      <SkipForward className="w-5 h-5 fill-white" />
                    </Btn>
                  )}

                  {/* volume */}
                  <div className="relative hidden sm:flex items-center"
                    onMouseEnter={() => setShowVolume(true)}
                    onMouseLeave={() => setShowVolume(false)}
                  >
                    <Btn onClick={toggleMute} label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}>
                      <VolumeIcon className="w-5 h-5" />
                    </Btn>
                    <div className={`flex items-center transition-all duration-200 overflow-hidden ${showVolume ? 'w-20 ml-1.5 opacity-100' : 'w-0 opacity-0'}`}>
                      <div
                        className="group/vol w-full py-2 cursor-pointer relative"
                        onClick={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          changeVolume((e.clientX - rect.left) / rect.width);
                        }}
                        onMouseDown={e => {
                          const track = e.currentTarget;
                          const set = (clientX: number) => {
                            const rect = track.getBoundingClientRect();
                            changeVolume(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
                          };
                          set(e.clientX);
                          const move = (ev: MouseEvent) => set(ev.clientX);
                          const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                          window.addEventListener('mousemove', move);
                          window.addEventListener('mouseup', up);
                        }}
                      >
                        <div className="relative w-full h-[4px] bg-white/25 rounded-full group-hover/vol:h-[5px] transition-all">
                          <div className="absolute inset-y-0 left-0 bg-red-500 rounded-full" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover/vol:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* time */}
                  <span className="text-white/80 text-[11px] sm:text-[13px] tabular-nums select-none whitespace-nowrap ml-0.5 sm:ml-1">
                    {formatTime(currentTime)} <span className="hidden min-[390px]:inline text-white/40">/ {formatTime(duration)}</span>
                  </span>

                  <div className="flex-1" />

                  {/* subtitle toggle */}
                  <Btn onClick={toggleSubs} label={subEnabled ? 'إخفاء الترجمة' : 'تشغيل الترجمة'} active={subEnabled}>
                    <Subtitles className="w-5 h-5" />
                  </Btn>

                  {/* settings */}
                  <div className="relative">
                    <Btn onClick={() => { setShowSettings(p => !p); setShowSpeedMenu(false); }} label="الإعدادات" active={showSettings}>
                      <Settings className="w-5 h-5" />
                    </Btn>
                    {showSettings && (
                      <>
                        {/* overlay شفاف يغطي كل الشاشة (z-40) فوق شريط الأدوات.
                            أي ضغطة عليه — حتى على زر الإعدادات تحته — تسد القائمة */}
                        <div
                          className="fixed inset-0 z-40"
                          onPointerDown={(e) => { e.stopPropagation(); setShowSettings(false); setShowSpeedMenu(false); }}
                        />
                      <div dir="rtl" className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 bottom-[max(.75rem,env(safe-area-inset-bottom))] sm:bottom-full sm:mb-3 bg-[#111]/95 sm:bg-black/75 backdrop-blur-2xl border border-white/15 rounded-[22px] sm:rounded-2xl shadow-2xl w-auto sm:w-60 max-h-[min(70vh,28rem)] overflow-y-auto z-50">
                        <div className="sm:hidden flex justify-center pt-2">
                          <span className="w-9 h-1 rounded-full bg-white/20" />
                        </div>
                        <div className="px-3.5 py-2.5 text-[10px] text-white/40 uppercase tracking-widest border-b border-white/10 text-right">الإعدادات</div>
                        <button onClick={() => setShowSpeedMenu(p => !p)} className="w-full flex items-center justify-between px-3.5 py-3 text-sm text-white hover:bg-white/10 transition-colors">
                          <span className="flex items-center gap-1 text-red-400 font-semibold text-xs">
                            {speed === 1 ? 'عادي' : `${speed}×`}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showSpeedMenu ? 'rotate-180' : ''}`} />
                          </span>
                          <span>السرعة</span>
                        </button>
                        {showSpeedMenu && (
                          <div className="border-t border-white/10 max-h-48 overflow-y-auto">
                            {SPEEDS.map(s => (
                              <button key={s} onClick={() => changeSpeed(s)} className={`w-full text-right px-3.5 py-2.5 text-sm transition-colors ${speed === s ? 'text-red-400 bg-red-500/10 font-semibold' : 'text-white/85 hover:bg-white/10'}`}>
                                {s === 1 ? 'عادي (1×)' : `${s}×`}
                              </button>
                            ))}
                          </div>
                        )}
                        {type === 'tv' && (
                          <button
                            type="button"
                            onClick={() => {
                              setAutoplayNext((current) => {
                                const next = !current;
                                persistPlaybackSettings(next, subSize, subOffset);
                                return next;
                              });
                            }}
                            className="w-full border-t border-white/10 px-3.5 py-3 flex items-center justify-between text-sm text-white hover:bg-white/10"
                            aria-pressed={autoplayNext}
                          >
                            <span
                              className={`relative w-10 h-6 rounded-full transition-colors ${
                                autoplayNext ? 'bg-red-500' : 'bg-white/15'
                              }`}
                            >
                              <span
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                  autoplayNext ? 'translate-x-5' : 'translate-x-1'
                                } left-0`}
                              />
                            </span>
                            <span>تشغيل الحلقة التالية</span>
                          </button>
                        )}
                        {/* حجم الترجمة */}
                        <div className="border-t border-white/10 px-3.5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => changeSubSize(10)} className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-90" aria-label="تكبير">
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="text-xs text-red-400 font-semibold w-10 text-center tabular-nums select-none">{subSize}%</span>
                            <button onClick={() => changeSubSize(-10)} className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-90" aria-label="تصغير">
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm text-white">حجم الترجمة</span>
                        </div>
                        {/* تأخير الترجمة */}
                        <div className="border-t border-white/10 px-3.5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => changeSubOffset(0.5)} className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-90" aria-label="+0.5s">
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className={`text-xs font-semibold w-14 text-center tabular-nums select-none ${subOffset === 0 ? 'text-white/40' : subOffset > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                              {subOffset === 0 ? '0.0s' : `${subOffset > 0 ? '+' : ''}${subOffset.toFixed(1)}s`}
                            </span>
                            <button onClick={() => changeSubOffset(-0.5)} className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-90" aria-label="-0.5s">
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm text-white">تأخير الترجمة</span>
                        </div>
                      </div>
                      </>
                    )}
                  </div>

                  {/* fullscreen */}
                  <Btn onClick={toggleFullscreen} label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}>
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </Btn>

                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function Btn({ onClick, label, children, active = false, small = false, big = false }: {
  onClick: () => void; label: string; children: ReactNode; active?: boolean; small?: boolean; big?: boolean;
}) {
  return (
    <button onClick={onClick} aria-label={label}
      className={`group/control relative flex items-center justify-center rounded-full transition-[color,background-color,transform] duration-150 shrink-0 active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80
        ${small ? 'w-8 h-8' : big ? 'w-11 h-11' : 'w-10 h-10 sm:w-11 sm:h-11'}
        ${active ? 'text-red-400 bg-red-500/15' : 'text-white/90 hover:text-white hover:bg-white/15'}`}>
      {children}
      <span
        role="tooltip"
        className="hidden sm:block pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-black/85 border border-white/10 text-[10px] leading-none text-white whitespace-nowrap opacity-0 translate-y-1 group-hover/control:opacity-100 group-hover/control:translate-y-0 group-focus-visible/control:opacity-100 transition-all duration-150"
      >
        {label}
      </span>
    </button>
  );
}
