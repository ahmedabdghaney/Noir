/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader, Pause, Play, Lock,
  Subtitles, Settings, Maximize2, Minimize2,
  Plus, Minus, ChevronDown,
  Volume2, VolumeX, Volume1, SkipForward,
} from 'lucide-react';

interface VideoPlayerProps {
  type: 'movie' | 'tv';
  id: number;
  title: string;
  posterPath?: string | null;   // مسار صورة TMDB — يُعرض بشاشة قفل iPhone (MediaSession)
  season?: number;
  episode?: number;
  episodesCount?: number;
  youtubeKey?: string | null;
  playMode: 'movie' | 'trailer';
  isPausedByHost?: boolean;
  hostPauseByName?: string;
  isLiveHost?: boolean;
  isLiveSession?: boolean;
  startAt?: number;
  onTimeUpdate?: (seconds: number) => void;
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
  youtubeKey, playMode,
  isPausedByHost = false, hostPauseByName = '',
  isLiveHost = false, isLiveSession = false,
  startAt = 0,
  onTimeUpdate, onSeek,
  onClose, onSwitchMode, onNextEpisode,
}: VideoPlayerProps) {

  const containerRef  = useRef<HTMLDivElement>(null);
  const videoRef      = useRef<HTMLVideoElement>(null);
  const progressRef   = useRef<HTMLDivElement>(null);
  const hideTimer     = useRef<ReturnType<typeof setTimeout>>();
  const dblClickTimer = useRef<ReturnType<typeof setTimeout>>();
  const seekFlashTimer = useRef<ReturnType<typeof setTimeout>>();

  const [isLoading,       setIsLoading]       = useState(true);
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
  const [cueText,         setCueText]         = useState('');  // نص الترجمة الحالي
  const [speed,           setSpeed]           = useState(1);
  const [showSettings,    setShowSettings]    = useState(false);
  const [showSpeedMenu,   setShowSpeedMenu]   = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [iosNativeFs,     setIosNativeFs]     = useState(false); // iPhone native video fullscreen

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

  const progressKey = `noir_progress_${type}_${id}`;

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
  const isNative  = playMode === 'movie' && customMp4 && !customMp4Failed;

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

  /* ── progress tracker ── */
  useEffect(() => {
    if (playMode !== 'movie') return;
    const savedOnStart = Number(localStorage.getItem(progressKey)) || 0;
    if (savedOnStart === 0) {
      localStorage.setItem(progressKey, '8');
      window.dispatchEvent(new Event('progress_updated'));
    }
    const timer = setInterval(() => {
      const cur = Number(localStorage.getItem(progressKey)) || 0;
      if (cur < 96) {
        localStorage.setItem(progressKey, String(cur + 1));
        window.dispatchEvent(new Event('progress_updated'));
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [type, id, playMode, progressKey]);

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
    setIsPlaying(false); setCurrentTime(0); setDuration(0); setBuffered(0);
    return () => clearTimeout(timer);
  }, [type, id, season, episode, playMode]);

  /* ── load saved subtitle size ── */
  useEffect(() => {
    const saved = Number(localStorage.getItem('noir_sub_size'));
    if (saved && saved >= 50 && saved <= 250) setSubSize(saved);
  }, []);

  /* ملاحظة: إغلاق الإعدادات يتم عبر الـ overlay (onPointerDown) — يشتغل ماوس ولمس */

  const changeSubSize = (delta: number) => {
    setSubSize(prev => {
      const next = Math.max(50, Math.min(250, prev + delta));
      localStorage.setItem('noir_sub_size', String(next));
      return next;
    });
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

  useEffect(() => {
    const v = () => videoRef.current;

    const startBoost = () => {
      const vid = v();
      if (!vid || speedBoostActiveRef.current) return;
      speedBoostActiveRef.current = true;
      wasPlayingRef.current = !vid.paused;
      // لو واقف — نشغّله. وبكل الحالات نخلي السرعة 2x
      if (vid.paused) vid.play();
      vid.playbackRate = 2;
      setSpeedBoost(true);
    };
    const endBoost = () => {
      const vid = v();
      if (!speedBoostActiveRef.current) return;
      speedBoostActiveRef.current = false;
      setSpeedBoost(false);
      if (vid) {
        vid.playbackRate = speed; // نرجّع السرعة المختارة
        // لو كان واقف قبل الضغط — نرجّعه واقف
        if (!wasPlayingRef.current) vid.pause();
      }
    };

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
              startBoost();
            }
            break;
          }
          // أول ضغطة — نأجّل القرار: لو انضغط طويل = boost، لو قصير = play/pause
          spaceHeldRef.current = true;
          spaceHoldTimerRef.current = setTimeout(() => {
            startBoost();
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
        case 'ArrowUp':
          e.preventDefault(); changeVolume(vid.volume + 0.1); break;
        case 'ArrowDown':
          e.preventDefault(); changeVolume(vid.volume - 0.1); break;
        default:
          if (e.code.startsWith('Digit')) {
            const n = Number(e.code.replace('Digit', ''));
            if (!isNaN(n) && duration) {
              e.preventDefault();
              vid.currentTime = (n / 10) * duration;
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
          endBoost();
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
  }, [duration, speed]);

  /* ── auto-hide controls after 3s ── */
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !showSettings) setControlsVisible(false);
    }, 3000);
  }, [showSettings]);

  /* ── helpers ── */
  const toggleSubs = () => {
    const v = videoRef.current;
    if (!v?.textTracks?.length) return;
    const next = !subEnabled;
    // metadata track: نبقيه hidden دايماً عشان نقرأ الـ cues بأنفسنا
    // تعطيل = disabled (ما يبعث cuechange events)
    v.textTracks[0].mode = next ? 'hidden' : 'disabled';
    if (!next) setCueText('');
    setSubEnabled(next);
  };

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
      const active = track.activeCues;
      if (active && active.length > 0) {
        const txt = Array.from(active).map((c: any) => c.text).join('\n');
        setCueText(txt);
      } else {
        setCueText('');
      }
    };

    track.addEventListener('cuechange', onCueChange);
    onCueChange();
    return () => track.removeEventListener('cuechange', onCueChange);
  }, [isNative, subEnabled, customMp4, iosNativeFs]);

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
    clearTimeout(playPulseTimer.current);
    if (v.paused) {
      v.play();
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
    videoRef.current.currentTime = Math.max(0, Math.min(duration || Infinity, videoRef.current.currentTime + s));
    setSeekFlash({ dir: s > 0 ? 'fwd' : 'back', amount: Math.abs(s) });
    clearTimeout(seekFlashTimer.current);
    seekFlashTimer.current = setTimeout(() => setSeekFlash(null), 1200);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current as any;

    // ── الخروج ──
    if (isFullscreen) {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      try { (screen.orientation as any)?.unlock?.(); } catch (_) {}
      setIsFullscreen(false);
      return;
    }

    // ── الدخول ──
    // iPhone ما يدعم requestFullscreen على div — نستعمل CSS fullscreen (fixed inset-0)
    // عشان يبقى المشغّل المخصّص ظاهر بدل مشغّل iPhone الافتراضي (native)
    const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
    const enter = () => {
      setIsFullscreen(true);
      try { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); } catch (_) {}
    };
    // iPhone: CSS fullscreen مباشرة (native fullscreen على div ما يشتغل — يفشل صامت)
    if (isIPhone) {
      enter();
      return;
    }
    if (el?.requestFullscreen) {
      el.requestFullscreen().then(enter).catch(enter);
    } else if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      enter();
    } else {
      enter();
    }
  };

  /* ── tap: ضغطة = play/pause، ضغطتين على الجوانب = seek، الوسط = fullscreen ── */
  const handleVideoClick = (e: React.MouseEvent) => {
    if (!isNative) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zone = x < rect.width * 0.3 ? 'left' : x > rect.width * 0.7 ? 'right' : 'center';

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
      }, 200);
    }
  };

  /* ── progress bar: click + drag scrub ── */
  const pctFromEvent = (clientX: number) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    videoRef.current.currentTime = pctFromEvent(e.clientX) * duration;
  };

  const handleProgressMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setHoverPct(pctFromEvent(e.clientX) * 100);
  };

  const startScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    setIsScrubbing(true);
    videoRef.current.currentTime = pctFromEvent(e.clientX) * duration;
    const move = (ev: MouseEvent) => {
      if (!videoRef.current || !duration) return;
      const p = pctFromEvent(ev.clientX);
      videoRef.current.currentTime = p * duration;
      setHoverPct(p * 100);
    };
    const up = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /* ── URLs ── */
  const getEmbedUrl = () => {
    if (playMode === 'trailer' && youtubeKey) {
      return `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&origin=${encodeURIComponent(window.location.origin)}`;
    }
    const params = new URLSearchParams({ primaryColor: 'ff453a', secondaryColor: '0a0a0a', iconColor: 'FFFFFF', icons: 'vid', title: 'true', poster: 'true', autoplay: 'true' });
    if (startAt && startAt > 5) params.set('startAt', String(Math.floor(startAt)));
    if (type === 'tv') { params.set('nextbutton', 'true'); return `https://vidapi.qzz.io/tv/${id}/${season}/${episode}?${params}`; }
    return `https://vidapi.qzz.io/movie/${id}?${params}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const hasNextEp   = type === 'tv' && !!onNextEpisode && (episodesCount === 0 || episode < episodesCount);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  /* ══════════════════════════════════════ render ══ */

  // نخفي native cue بس لما يكون الـ overlay المخصّص شغال (المشغّل العادي)
  // وقت iPhone native fullscreen: iOS يعرض الترجمة الأصلية — نتحكم بحجمها عبر ::cue
  // (موضعها يُتحكم بـ track.cues[].line اللي نضبطه بـ effect منفصل)
  const hideCueStyle = iosNativeFs
    ? `video::cue { font-size: calc(${subSize / 100} * (1.1em + 0.4vw)) !important; background: rgba(0,0,0,0.55) !important; }`
    : `video::cue { color: transparent !important; text-shadow: none !important; background: transparent !important; }`;

  const sliderStyle = `
    @keyframes noir-flash { 0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; } }
    .noir-flash { animation: noir-flash 1.2s ease-out forwards; }
    @keyframes noir-pulse { 0% { opacity: 0; transform: scale(0.7); } 15% { opacity: 1; transform: scale(1.05); } 40% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
    .noir-pulse { animation: noir-pulse 0.7s ease-out forwards; }
  `;

  const playerJsx = (
    <div ref={containerRef} className={`${isFullscreen ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none m-0 rounded-none bg-black flex items-center justify-center' : 'w-full mt-16 sm:mt-20 mb-6 mx-auto max-w-[94%] md:max-w-6xl xl:max-w-7xl'}`}>
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
          {isLoading && !isPausedByHost && (
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10 gap-3">
              <Loader className="w-8 h-8 text-red-500 animate-spin" />
              <span className="text-xs text-white/30 select-none">Loading...</span>
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
              className={`w-full h-full bg-black ${controlsVisible ? 'cursor-default' : 'cursor-none'}`}
              onClick={handleVideoClick}
              onLoadedData={() => { setIsLoading(false); setDuration(videoRef.current?.duration || 0); }}
              onCanPlay={() => setIsLoading(false)}
              onError={() => setCustomMp4Failed(true)}
              onPlay={() => { setIsPlaying(true); resetHideTimer(); }}
              onPause={() => { setIsPlaying(false); setControlsVisible(true); clearTimeout(hideTimer.current); }}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
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
              <track kind="subtitles" srcLang="ar" label="العربية" src={vttSrc} default />
            </video>

          /* fallback iframe */
          ) : (
            <iframe key={`player-${id}-${episode}`} src={isPausedByHost ? 'about:blank' : getEmbedUrl()} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" referrerPolicy="no-referrer" allowFullScreen className="w-full h-full border-0" onLoad={() => setIsLoading(false)} />
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
            <div className={`absolute inset-x-0 top-0 z-30 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
              </div>
            </div>
          )}

          {/* ══ seek flash + seekHold persistent ══ */}
          {isNative && (seekFlash || seekHold) && (
            <div className={`absolute inset-y-0 z-20 flex items-center pointer-events-none
              ${(seekFlash?.dir || seekHold) === 'fwd' ? 'right-0 pr-12 justify-end' : 'left-0 pl-12 justify-start'}`}
              style={{ width: '40%' }}>
              <div className={`flex flex-col items-center gap-1 text-white transition-opacity duration-150 ${seekHold ? 'opacity-100' : 'noir-flash'}`}>
                <div className="w-14 h-14 rounded-full bg-black/45 backdrop-blur-xl border border-white/15 flex items-center justify-center">
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
              <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 flex items-center justify-center">
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
              className={`absolute inset-x-0 bottom-0 z-30 transition-all duration-300 ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

              <div className="relative px-3 sm:px-4 pb-3 pt-10 flex flex-col gap-1.5">

                {/* progress bar */}
                <div
                  ref={progressRef}
                  className="group/bar w-full py-2 cursor-pointer relative"
                  onClick={handleProgressClick}
                  onMouseMove={handleProgressMove}
                  onMouseLeave={() => !isScrubbing && setHoverPct(null)}
                  onMouseDown={startScrub}
                >
                  {/* hover time tooltip */}
                  {hoverPct !== null && duration > 0 && (
                    <div className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-[11px] text-white tabular-nums pointer-events-none whitespace-nowrap"
                      style={{ left: `${hoverPct}%` }}>
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
                <div className="flex items-center gap-1 sm:gap-1.5">

                  {/* play/pause */}
                  <Btn onClick={togglePlay} label={isPlaying ? 'Pause' : 'Play'} big>
                    {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
                  </Btn>

                  {/* next episode */}
                  {hasNextEp && (
                    <Btn onClick={() => onNextEpisode?.()} label="الحلقة التالية">
                      <SkipForward className="w-5 h-5 fill-white" />
                    </Btn>
                  )}

                  {/* volume */}
                  <div className="relative flex items-center"
                    onMouseEnter={() => setShowVolume(true)}
                    onMouseLeave={() => setShowVolume(false)}
                  >
                    <Btn onClick={toggleMute} label={isMuted ? 'Unmute' : 'Mute'}>
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
                  <span className="text-white/80 text-[11px] sm:text-[13px] tabular-nums select-none whitespace-nowrap ml-1">
                    {formatTime(currentTime)} <span className="text-white/40">/ {formatTime(duration)}</span>
                  </span>

                  <div className="flex-1" />

                  {/* subtitle toggle */}
                  <Btn onClick={toggleSubs} label={subEnabled ? 'Hide subs' : 'Show subs'} active={subEnabled}>
                    <Subtitles className="w-5 h-5" />
                  </Btn>

                  {/* settings */}
                  <div className="relative">
                    <Btn onClick={() => { setShowSettings(p => !p); setShowSpeedMenu(false); }} label="Settings" active={showSettings}>
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
                      <div className="absolute right-0 bottom-full mb-3 bg-black/70 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl w-48 overflow-hidden z-50">
                        <div className="px-3.5 py-2.5 text-[10px] text-white/40 uppercase tracking-widest border-b border-white/10">الإعدادات</div>
                        <button onClick={() => setShowSpeedMenu(p => !p)} className="w-full flex items-center justify-between px-3.5 py-3 text-sm text-white hover:bg-white/10 transition-colors">
                          <span>السرعة</span>
                          <span className="flex items-center gap-1 text-red-400 font-semibold text-xs">
                            {speed === 1 ? 'عادي' : `${speed}×`}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showSpeedMenu ? 'rotate-180' : ''}`} />
                          </span>
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
                        {/* حجم الترجمة */}
                        <div className="border-t border-white/10 px-3.5 py-3 flex items-center justify-between">
                          <span className="text-sm text-white">حجم الترجمة</span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => changeSubSize(-10)} className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-90" aria-label="تصغير">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs text-red-400 font-semibold w-10 text-center tabular-nums select-none">{subSize}%</span>
                            <button onClick={() => changeSubSize(10)} className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-90" aria-label="تكبير">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                      </>
                    )}
                  </div>

                  {/* fullscreen */}
                  <Btn onClick={toggleFullscreen} label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
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

  // الفلسكرين: نرسمه مباشرة بـ document.body عبر Portal — يتجاوز أي عنصر
  // بالصفحة عليه transform/animation (مثل detail-enter) يكسر موضعة
  // "fixed inset-0" ويحصر المشغل بمكانه بدل تغطية الشاشة كلها.
  // الوضع العادي (مدمج بالصفحة) يبقى برندر مكانه الطبيعي بدون Portal.
  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(playerJsx, document.body);
  }
  return playerJsx;
}

function Btn({ onClick, label, children, active = false, small = false, big = false }: {
  onClick: () => void; label: string; children: React.ReactNode; active?: boolean; small?: boolean; big?: boolean;
}) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`relative flex items-center justify-center rounded-full transition-all shrink-0 active:scale-90 cursor-pointer
        ${small ? 'w-5 h-5' : big ? 'w-10 h-10' : 'w-9 h-9'}
        ${active ? 'text-red-400 bg-red-500/15' : 'text-white/90 hover:text-white hover:bg-white/15'}`}>
      {children}
    </button>
  );
}
