/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader, Pause, Play, Lock,
  SkipBack, SkipForward,
  Subtitles, Settings, Maximize2, Minimize2,
  Plus, Minus, ChevronDown, Volume2, VolumeX, Volume1
} from 'lucide-react';

interface VideoPlayerProps {
  type: 'movie' | 'tv';
  id: number;
  title: string;
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
  season = 1, episode = 1,
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

  const [isLoading,       setIsLoading]       = useState(true);
  const [customMp4Failed, setCustomMp4Failed] = useState(false);
  const [isPlaying,       setIsPlaying]       = useState(false);
  const [currentTime,     setCurrentTime]     = useState(0);
  const [duration,        setDuration]        = useState(0);
  const [volume,          setVolume]          = useState(1);
  const [isMuted,         setIsMuted]         = useState(false);
  const [showVolume,      setShowVolume]      = useState(false);
  const [subOffset,       setSubOffset]       = useState(0);
  const [subEnabled,      setSubEnabled]      = useState(true);
  const [speed,           setSpeed]           = useState(1);
  const [showSettings,    setShowSettings]    = useState(false);
  const [showSpeedMenu,   setShowSpeedMenu]   = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const progressKey = `noir_progress_${type}_${id}`;

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
    // scrollIntoView أحياناً يتسبب في شاشة سوداء على بعض المتصفحات — نستخدم setTimeout لنضمن إن العنصر موجود أولاً
    const timer = setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    setIsLoading(true); setCustomMp4Failed(false);
    setSubOffset(0); setSubEnabled(true); setSpeed(1);
    setShowSettings(false); setShowSpeedMenu(false); setShowVolume(false);
    setIsPlaying(false); setCurrentTime(0); setDuration(0);
    return () => clearTimeout(timer);
  }, [type, id, season, episode, playMode]);

  /* ── fullscreen event ── */
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  /* ── keyboard controls ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // بس اشتغل إذا في فيديو native
      if (!videoRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekBy(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekBy(-10);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /* ── auto-hide controls after 3s ── */
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 3000);
  }, []);

  // نحفظ الـ offset في ref عشان يكون متاح في الـ event listeners
  const subOffsetRef = useRef(0);

  /* ── helpers ── */
  const adjustSubs = (s: number) => {
    const v = videoRef.current;
    if (!v?.textTracks?.length) return;
    const track = v.textTracks[0];
    if (track.cues) for (let i = 0; i < track.cues.length; i++) {
      const c = track.cues[i] as VTTCue;
      c.startTime += s; c.endTime += s;
    }
    subOffsetRef.current += s;
    setSubOffset(p => p + s);
  };

  // لما يُحمّل track جديد (بعد seek أو reload) — نعيد تطبيق الـ offset تلقائياً
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const applyOffsetOnLoad = () => {
      const track = v.textTracks?.[0];
      if (!track || subOffsetRef.current === 0) return;
      // انتظر الـ cues تُحمّل
      const tryApply = () => {
        if (track.cues && track.cues.length > 0) {
          for (let i = 0; i < track.cues.length; i++) {
            const c = track.cues[i] as VTTCue;
            c.startTime += subOffsetRef.current;
            c.endTime   += subOffsetRef.current;
          }
        } else {
          // الـ cues لسه ما حُملت، جرب بعد شوي
          setTimeout(tryApply, 100);
        }
      };
      tryApply();
    };
    v.addEventListener('seeked', applyOffsetOnLoad);
    return () => v.removeEventListener('seeked', applyOffsetOnLoad);
  }, []);

  const toggleSubs = () => {
    const v = videoRef.current;
    if (!v?.textTracks?.length) return;
    const next = !subEnabled;
    v.textTracks[0].mode = next ? 'showing' : 'hidden';
    setSubEnabled(next);
  };

  const changeSpeed = (s: number) => {
    if (videoRef.current) videoRef.current.playbackRate = s;
    setSpeed(s); setShowSpeedMenu(false); setShowSettings(false);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
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

  const seekBy = (s: number) => { if (videoRef.current) videoRef.current.currentTime += s; };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // استخدم containerRef أولاً، وإذا فشل استخدم document.documentElement
      const el = containerRef.current || document.documentElement;
      el.requestFullscreen?.().catch(() => document.documentElement.requestFullscreen?.());
    } else {
      document.exitFullscreen();
    }
  };

  /* ── double click = toggle fullscreen ── */
  const handleVideoClick = (e: React.MouseEvent) => {
    if (!isNative) return;
    e.stopPropagation();
    clearTimeout(dblClickTimer.current);
    if ((e as any).detail === 2) {
      // double click
      toggleFullscreen();
    } else {
      dblClickTimer.current = setTimeout(() => {
        togglePlay();
        resetHideTimer();
      }, 200);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !videoRef.current || !duration) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
  };

  /* ── URLs ── */
  const mp4Key    = type === 'tv' ? `tv_${id}_${season}_${episode}` : `movie_${id}`;
  const customMp4 = playMode === 'movie' ? `${CDN_BASE_URL}${mp4Key}.mp4` : undefined;
  const vttSrc    = `${CDN_BASE_URL}${mp4Key}.vtt`;

  const getEmbedUrl = () => {
    if (playMode === 'trailer' && youtubeKey) {
      return `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&origin=${encodeURIComponent(window.location.origin)}`;
    }
    const params = new URLSearchParams({ primaryColor: 'ff453a', secondaryColor: '0a0a0a', iconColor: 'FFFFFF', icons: 'vid', title: 'true', poster: 'true', autoplay: 'true' });
    if (startAt && startAt > 5) params.set('startAt', String(Math.floor(startAt)));
    if (type === 'tv') { params.set('nextbutton', 'true'); return `https://vidapi.qzz.io/tv/${id}/${season}/${episode}?${params}`; }
    return `https://vidapi.qzz.io/movie/${id}?${params}`;
  };

  const isNative    = playMode === 'movie' && customMp4 && !customMp4Failed;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  /* ══════════════════════════════════════ render ══ */

  const volumeSliderStyle = `
    .volume-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 5px;
      background: rgba(255,255,255,0.2);
      border-radius: 9999px;
      outline: none;
      border: none;
    }
    .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #ffffff;
      cursor: pointer;
      border: none;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }
    .volume-slider::-moz-range-thumb {
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #ffffff;
      cursor: pointer;
      border: none;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }
    .volume-slider::-webkit-slider-runnable-track {
      height: 5px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.2);
    }
    .volume-slider::-moz-range-track {
      height: 5px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.2);
    }
  `;

  return (
    <div ref={containerRef} className={`${isFullscreen ? 'fixed inset-0 z-[9999] w-screen h-screen max-w-none m-0 rounded-none' : 'w-full my-6 mx-auto max-w-[94%] md:max-w-6xl xl:max-w-7xl'}`}>
      <style>{volumeSliderStyle}</style>
      <div
        className={`relative bg-black overflow-hidden border border-white/10 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.95)] ${isFullscreen ? 'w-full h-full rounded-none' : 'rounded-2xl'}`}
        dir="ltr"
        onMouseMove={resetHideTimer}
        onMouseLeave={() => { if (videoRef.current && !videoRef.current.paused) setControlsVisible(false); }}
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

          {/* ══ custom controls ══ */}
          {isNative && (
            <div
              className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

              <div className="relative px-4 pb-4 pt-8 flex flex-col gap-2">

                {/* progress bar */}
                <div
                  ref={progressRef}
                  className="w-full h-[5px] bg-white/20 rounded-full cursor-pointer group/bar relative hover:h-[7px] transition-all duration-150"
                  onClick={handleProgressClick}
                >
                  <div
                    className="h-full bg-red-500 rounded-full relative transition-[width] duration-100 ease-linear"
                    style={{ width: `${progressPct}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150" />
                  </div>
                </div>

                {/* bottom row */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">

                  {/* play/pause */}
                  <Btn onClick={togglePlay} label={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
                  </Btn>

                  {/* seek -10s */}
                  <button onClick={() => seekBy(-10)} title="-10s" aria-label="-10s"
                    className="relative flex items-center justify-center rounded-full transition-all shrink-0 w-7 h-7 text-white/80 hover:text-white hover:bg-white/10">
                    <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-5.93 6.79" />
                      <text x="12" y="16.5" textAnchor="middle" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="600">10</text>
                    </svg>
                  </button>
                  {/* seek +10s */}
                  <button onClick={() => seekBy(10)} title="+10s" aria-label="+10s"
                    className="relative flex items-center justify-center rounded-full transition-all shrink-0 w-7 h-7 text-white/80 hover:text-white hover:bg-white/10">
                    <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 5.93 6.79" />
                      <text x="12" y="16.5" textAnchor="middle" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="600">10</text>
                    </svg>
                  </button>

                  {/* volume with slider */}
                  <div className="relative flex items-center gap-1"
                    onMouseEnter={() => setShowVolume(true)}
                    onMouseLeave={() => setShowVolume(false)}
                  >
                    <Btn onClick={toggleMute} label={isMuted ? 'Unmute' : 'Mute'}>
                      <VolumeIcon className="w-4 h-4" />
                    </Btn>
                    {/* volume slider */}
                    <div className={`transition-all duration-200 overflow-hidden ${showVolume ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                      <input
                        type="range"
                        min={0} max={1} step={0.02}
                        value={isMuted ? 0 : volume}
                        onChange={e => changeVolume(Number(e.target.value))}
                        className="w-full cursor-pointer volume-slider"
                        style={{ accentColor: '#ef4444' }}
                      />
                    </div>
                  </div>

                  {/* time */}
                  <span className="text-white/60 text-[11px] sm:text-xs tabular-nums select-none whitespace-nowrap">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex-1" />

                  {/* subtitle toggle */}
                  <Btn onClick={toggleSubs} label={subEnabled ? 'Hide subs' : 'Show subs'} active={subEnabled}>
                    <Subtitles className="w-4 h-4" />
                  </Btn>

                  {/* subtitle offset */}
                  {subEnabled && (
                    <div className="flex items-center gap-0.5 bg-white/10 rounded-full px-1.5 py-1 border border-white/10">
                      <Btn onClick={() => adjustSubs(-1)} label="-1s" small><Minus className="w-3 h-3" /></Btn>
                      <span className="text-[11px] text-white/60 w-9 text-center tabular-nums select-none">
                        {subOffset >= 0 ? `+${subOffset}s` : `${subOffset}s`}
                      </span>
                      <Btn onClick={() => adjustSubs(1)} label="+1s" small><Plus className="w-3 h-3" /></Btn>
                    </div>
                  )}

                  {/* settings */}
                  <div className="relative">
                    <Btn onClick={() => { setShowSettings(p => !p); setShowSpeedMenu(false); }} label="Settings">
                      <Settings className="w-4 h-4" />
                    </Btn>
                    {showSettings && (
                      <div className="absolute right-0 bottom-full mb-2 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl w-44 overflow-hidden z-50">
                        <div className="px-3 py-2 text-[10px] text-white/30 uppercase tracking-widest border-b border-white/10">Settings</div>
                        <button onClick={() => setShowSpeedMenu(p => !p)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-white hover:bg-white/5 transition-colors">
                          <span>Speed</span>
                          <span className="flex items-center gap-1 text-red-400 font-semibold text-xs">
                            {speed === 1 ? 'Normal' : `${speed}×`}
                            <ChevronDown className="w-3 h-3" />
                          </span>
                        </button>
                        {showSpeedMenu && (
                          <div className="border-t border-white/10">
                            {SPEEDS.map(s => (
                              <button key={s} onClick={() => changeSpeed(s)} className={`w-full text-left px-3 py-2 text-sm transition-colors ${speed === s ? 'text-red-400 bg-red-500/10 font-semibold' : 'text-white/80 hover:bg-white/5'}`}>
                                {s === 1 ? 'Normal (1×)' : `${s}×`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* fullscreen */}
                  <Btn onClick={toggleFullscreen} label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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

function Btn({ onClick, label, children, active = false, small = false }: {
  onClick: () => void; label: string; children: React.ReactNode; active?: boolean; small?: boolean;
}) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`relative flex items-center justify-center rounded-full transition-all shrink-0
        ${small ? 'w-5 h-5' : 'w-7 h-7'}
        ${active ? 'text-red-400 bg-red-500/15' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
      {children}
    </button>
  );
}
