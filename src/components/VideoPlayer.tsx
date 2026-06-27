/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader, Pause, Play, Lock,
  SkipBack, SkipForward,
  Subtitles, Settings, Maximize2, Minimize2,
  Plus, Minus, ChevronDown, Volume2, VolumeX
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
  season = 1, episode = 1, episodesCount = 1,
  youtubeKey, playMode,
  isPausedByHost = false, hostPauseByName = '',
  isLiveHost = false, isLiveSession = false,
  startAt = 0,
  onTimeUpdate, onSeek,
  onHostPause, onHostResume,
  onClose, onSwitchMode, onNextEpisode,
}: VideoPlayerProps) {

  const containerRef  = useRef<HTMLDivElement>(null);
  const videoRef      = useRef<HTMLVideoElement>(null);
  const progressRef   = useRef<HTMLDivElement>(null);
  const hideTimer     = useRef<ReturnType<typeof setTimeout>>();

  const [isLoading,       setIsLoading]       = useState(true);
  const [customMp4Failed, setCustomMp4Failed] = useState(false);
  const [isPlaying,       setIsPlaying]       = useState(false);
  const [currentTime,     setCurrentTime]     = useState(0);
  const [duration,        setDuration]        = useState(0);
  const [volume,          setVolume]          = useState(1);
  const [isMuted,         setIsMuted]         = useState(false);
  const [subOffset,       setSubOffset]       = useState(0);
  const [subEnabled,      setSubEnabled]      = useState(true);
  const [speed,           setSpeed]           = useState(1);
  const [showSettings,    setShowSettings]    = useState(false);
  const [showSpeedMenu,   setShowSpeedMenu]   = useState(false);
  const [showSubMenu,     setShowSubMenu]     = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isDragging,      setIsDragging]      = useState(false);

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

  /* ── postMessage handler ── */
  const lastWatchedRef    = useRef(0);
  const lastWatchedAtRef  = useRef(0);
  useEffect(() => {
    if (playMode !== 'movie') return;
    lastWatchedRef.current    = 0;
    lastWatchedAtRef.current  = 0;
    const handler = (event: MessageEvent) => {
      const d: any = event?.data;
      if (!d || typeof d !== 'object') return;
      let watched: number | null = null;
      if      (d.type === 'MEDIA_DATA'   && d.data?.progress?.watched != null) watched = Number(d.data.progress.watched);
      else if (d.type === 'PLAYER_EVENT' && d.data?.player_progress   != null) watched = Number(d.data.player_progress);
      else if (d.type === 'PLAYER_EVENT' && d.data?.currentTime       != null) watched = Number(d.data.currentTime);
      else if (d.event === 'time'        && d.currentTime             != null) watched = Number(d.currentTime);
      else if (typeof d.currentTime === 'number')                               watched = d.currentTime;
      if (watched == null || isNaN(watched) || watched < 0) return;
      const now     = Date.now();
      const prev    = lastWatchedRef.current;
      const prevAt  = lastWatchedAtRef.current;
      lastWatchedRef.current    = watched;
      lastWatchedAtRef.current  = now;
      if (prev === 0 || prevAt === 0) { onTimeUpdate?.(watched); return; }
      const elapsed     = (now - prevAt) / 1000;
      const actualDelta = watched - prev;
      const isSeek      = (actualDelta - elapsed) > 5 || actualDelta < -3;
      isSeek ? onSeek?.(watched) : onTimeUpdate?.(watched);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [playMode, type, id, season, episode, startAt, onTimeUpdate, onSeek]);

  /* ── reset on change ── */
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setIsLoading(true);
    setCustomMp4Failed(false);
    setSubOffset(0);
    setSubEnabled(true);
    setSpeed(1);
    setShowSettings(false);
    setShowSpeedMenu(false);
    setShowSubMenu(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [type, id, season, episode, playMode]);

  /* ── fullscreen change event ── */
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  /* ── auto-hide controls ── */
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 3000);
  }, [isPlaying]);

  /* ── subtitle offset ── */
  const adjustSubs = (seconds: number) => {
    const video = videoRef.current;
    if (!video?.textTracks?.length) return;
    const track = video.textTracks[0];
    if (track.cues) {
      for (let i = 0; i < track.cues.length; i++) {
        const cue = track.cues[i] as VTTCue;
        cue.startTime += seconds;
        cue.endTime   += seconds;
      }
    }
    setSubOffset(prev => +(prev + seconds).toFixed(0));
  };

  const toggleSubs = () => {
    const video = videoRef.current;
    if (!video?.textTracks?.length) return;
    const next = !subEnabled;
    video.textTracks[0].mode = next ? 'showing' : 'hidden';
    setSubEnabled(next);
  };

  const changeSpeed = (s: number) => {
    if (videoRef.current) videoRef.current.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
    setShowSettings(false);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const seekBy = (s: number) => {
    if (videoRef.current) videoRef.current.currentTime += s;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    !document.fullscreenElement ? el.requestFullscreen() : document.exitFullscreen();
  };

  /* ── progress bar seek ── */
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !videoRef.current || !duration) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = ratio * duration;
  };

  /* ── URLs ── */
  const mp4Key    = type === 'tv' ? `tv_${id}_${season}_${episode}` : `movie_${id}`;
  const customMp4 = playMode === 'movie' ? `${CDN_BASE_URL}${mp4Key}.mp4` : undefined;
  const vttSrc    = `${CDN_BASE_URL}${mp4Key}.vtt`;

  const getEmbedUrl = () => {
    if (playMode === 'trailer' && youtubeKey) {
      const origin = encodeURIComponent(window.location.origin);
      return `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&origin=${origin}`;
    }
    const params = new URLSearchParams({
      primaryColor: 'ff453a', secondaryColor: '0a0a0a',
      iconColor: 'FFFFFF', icons: 'vid',
      title: 'true', poster: 'true', autoplay: 'true',
    });
    if (startAt && startAt > 5) params.set('startAt', String(Math.floor(startAt)));
    if (type === 'tv') { params.set('nextbutton', 'true'); return `https://vidapi.qzz.io/tv/${id}/${season}/${episode}?${params}`; }
    return `https://vidapi.qzz.io/movie/${id}?${params}`;
  };

  const isNative = playMode === 'movie' && customMp4 && !customMp4Failed;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  /* ══════════════════════════════════════════════════════════ render ══ */
  return (
    <div
      ref={containerRef}
      className="w-full my-6 mx-auto max-w-[94%] md:max-w-6xl xl:max-w-7xl"
      dir="rtl"
    >
      <div
        className="relative bg-black rounded-2xl overflow-hidden border border-white/10 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.95)] group"
        onMouseMove={showControls}
        onMouseLeave={() => isPlaying && setControlsVisible(false)}
        onClick={() => { if (isNative) { togglePlay(); showControls(); } }}
      >
        {/* ── video / iframe ── */}
        <div className="relative aspect-video w-full bg-black">

          {/* loading */}
          {isLoading && !isPausedByHost && (
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10 gap-3">
              <Loader className="w-8 h-8 text-red-500 animate-spin" />
              <span className="text-xs text-white/30 select-none">جاري تحميل المشغّل...</span>
            </div>
          )}

          {/* trailer */}
          {playMode === 'trailer' ? (
            <iframe
              src={getEmbedUrl()}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
            />

          /* native mp4 */
          ) : isNative ? (
            <video
              ref={videoRef}
              key={`mp4-${id}-${episode}`}
              autoPlay
              playsInline
              className="w-full h-full bg-black cursor-none"
              onLoadedData={() => { setIsLoading(false); setDuration(videoRef.current?.duration || 0); }}
              onCanPlay={() => setIsLoading(false)}
              onError={() => setCustomMp4Failed(true)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
              onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
              onVolumeChange={() => { setVolume(videoRef.current?.volume || 1); setIsMuted(videoRef.current?.muted || false); }}
            >
              <source src={customMp4} type="video/mp4" />
              <track kind="subtitles" srcLang="ar" label="العربية" src={vttSrc} default />
            </video>

          /* fallback iframe */
          ) : (
            <iframe
              key={`player-${id}-${episode}`}
              src={isPausedByHost ? 'about:blank' : getEmbedUrl()}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
              referrerPolicy="no-referrer"
              allowFullScreen
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
            />
          )}

          {/* host paused overlay */}
          {isPausedByHost && playMode === 'movie' && (
            <div className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 select-none">
              <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                <Pause className="w-7 h-7 text-amber-400 fill-amber-400" />
              </div>
              <div className="text-center px-6">
                <h3 className="text-white text-base md:text-lg font-bold mb-1">أوقف المنظم التشغيل</h3>
                {hostPauseByName && (
                  <p className="text-gray-400 text-xs md:text-sm">
                    بانتظار <span className="text-amber-400 font-semibold">{hostPauseByName}</span> ليستأنف العرض
                  </p>
                )}
                {isLiveHost && <p className="text-gray-500 text-[11px] mt-3">اضغط زر الاستئناف بالأعلى لإكمال المشاهدة</p>}
                {!isLiveHost && isLiveSession && (
                  <p className="text-gray-500 text-[11px] mt-3 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" /> التحكم بالتشغيل بيد المنظم فقط
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ══ custom controls overlay (native only) ══ */}
          {isNative && (
            <div
              className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300
                ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={e => e.stopPropagation()}
            >
              {/* gradient bg */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

              <div className="relative px-4 pb-4 pt-8 flex flex-col gap-2">

                {/* ── progress bar ── */}
                <div
                  ref={progressRef}
                  className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/bar relative"
                  onClick={handleProgressClick}
                >
                  {/* buffered — could add later */}
                  {/* played */}
                  <div
                    className="h-full bg-red-500 rounded-full relative transition-all"
                    style={{ width: `${progress}%` }}
                  >
                    {/* thumb */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
                                    w-3 h-3 rounded-full bg-white shadow-md
                                    opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* ── bottom row ── */}
                <div className="flex items-center gap-3">

                  {/* play/pause */}
                  <CtrlBtn onClick={togglePlay} label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}>
                    {isPlaying
                      ? <Pause className="w-5 h-5 fill-white" />
                      : <Play  className="w-5 h-5 fill-white" />}
                  </CtrlBtn>

                  {/* seek */}
                  <CtrlBtn onClick={() => seekBy(-10)} label="تراجع ١٠ ث">
                    <SkipBack className="w-4 h-4" />
                  </CtrlBtn>
                  <CtrlBtn onClick={() => seekBy(10)} label="تقدم ١٠ ث">
                    <SkipForward className="w-4 h-4" />
                  </CtrlBtn>

                  {/* volume */}
                  <CtrlBtn onClick={toggleMute} label={isMuted ? 'رفع الصوت' : 'كتم الصوت'}>
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </CtrlBtn>

                  {/* time */}
                  <span className="text-white/60 text-xs tabular-nums select-none">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  {/* spacer */}
                  <div className="flex-1" />

                  {/* subtitle toggle */}
                  <CtrlBtn onClick={toggleSubs} label={subEnabled ? 'إيقاف الترجمة' : 'تفعيل الترجمة'} active={subEnabled}>
                    <Subtitles className="w-4 h-4" />
                  </CtrlBtn>

                  {/* subtitle offset */}
                  {subEnabled && (
                    <div className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1 border border-white/10">
                      <CtrlBtn onClick={() => adjustSubs(-1)} label="تأخير الترجمة" small>
                        <Minus className="w-3 h-3" />
                      </CtrlBtn>
                      <span className="text-[11px] text-white/60 w-9 text-center tabular-nums select-none">
                        {subOffset >= 0 ? `+${subOffset}s` : `${subOffset}s`}
                      </span>
                      <CtrlBtn onClick={() => adjustSubs(1)} label="تقديم الترجمة" small>
                        <Plus className="w-3 h-3" />
                      </CtrlBtn>
                    </div>
                  )}

                  {/* settings */}
                  <div className="relative">
                    <CtrlBtn onClick={() => { setShowSettings(p => !p); setShowSpeedMenu(false); setShowSubMenu(false); }} label="الإعدادات">
                      <Settings className="w-4 h-4" />
                    </CtrlBtn>
                    {showSettings && (
                      <div className="absolute left-0 bottom-full mb-2 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl w-44 overflow-hidden z-50">
                        <div className="px-3 py-2 text-[10px] text-white/30 uppercase tracking-widest border-b border-white/10">الإعدادات</div>
                        {/* speed */}
                        <button
                          onClick={() => setShowSpeedMenu(p => !p)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                        >
                          <span>سرعة التشغيل</span>
                          <span className="flex items-center gap-1 text-red-400 font-semibold text-xs">
                            {speed === 1 ? 'عادي' : `${speed}×`}
                            <ChevronDown className="w-3 h-3" />
                          </span>
                        </button>
                        {showSpeedMenu && (
                          <div className="border-t border-white/10">
                            {SPEEDS.map(s => (
                              <button
                                key={s}
                                onClick={() => changeSpeed(s)}
                                className={`w-full text-right px-3 py-2 text-sm transition-colors
                                  ${speed === s ? 'text-red-400 bg-red-500/10 font-semibold' : 'text-white/80 hover:bg-white/5'}`}
                              >
                                {s === 1 ? 'عادي (1×)' : `${s}×`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* fullscreen */}
                  <CtrlBtn onClick={toggleFullscreen} label={isFullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}>
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </CtrlBtn>

                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── reusable control button ── */
function CtrlBtn({
  onClick, label, children, active = false, small = false,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex items-center justify-center rounded-full transition-all shrink-0
        ${small ? 'w-5 h-5' : 'w-7 h-7'}
        ${active
          ? 'text-red-400 bg-red-500/15'
          : 'text-white/80 hover:text-white hover:bg-white/10'}`}
    >
      {children}
    </button>
  );
}
