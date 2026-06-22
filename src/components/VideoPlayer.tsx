/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Play, Loader, ShieldAlert, Pause, Lock } from 'lucide-react';

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

export default function VideoPlayer({
  type,
  id,
  title,
  season = 1,
  episode = 1,
  episodesCount = 1,
  youtubeKey,
  playMode,
  isPausedByHost = false,
  hostPauseByName = '',
  isLiveHost = false,
  isLiveSession = false,
  startAt = 0,
  onTimeUpdate,
  onSeek,
  onHostPause,
  onHostResume,
  onClose,
  onSwitchMode,
  onNextEpisode,
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Watch progression state
  const progressKey =`noir_progress_${type}_${id}`;
  const [progress, setProgress] = useState<number>(() => {
    return Number(localStorage.getItem(progressKey)) || 0;
  });

  // Automated progress updates while actively watching
  useEffect(() => {
    if (playMode !=='movie') return;

    // Immediately record that user started watching
    const savedOnStart = Number(localStorage.getItem(progressKey)) || 0;
    let currentVal = savedOnStart === 0 ? 8 : savedOnStart;

    if (savedOnStart === 0) {
      setProgress(8);
      localStorage.setItem(progressKey,'8');
      window.dispatchEvent(new Event('progress_updated'));
    }

    const timer = setInterval(() => {
      const currentSaved = Number(localStorage.getItem(progressKey)) || 0;
      if (currentSaved < 96) {
        const newVal = currentSaved + 1;
        setProgress(newVal);
        localStorage.setItem(progressKey, String(newVal));
        window.dispatchEvent(new Event('progress_updated'));
      }
    }, 10000); // Increments progress by 1% every 10 seconds of active playback

    return () => clearInterval(timer);
  }, [type, id, playMode, progressKey]);

  // Listen for vidapi.qzz.io postMessage progress events
  // (sent from the iframe whenever playback advances or the user seeks)
  const lastWatchedRef = useRef<number>(0);
  const lastWatchedAtRef = useRef<number>(0);
  useEffect(() => {
    if (playMode !== 'movie') return;

    // Reset baseline whenever the loaded segment changes (id/season/episode/startAt)
    lastWatchedRef.current = 0;
    lastWatchedAtRef.current = 0;

    const handler = (event: MessageEvent) => {
      const d: any = event?.data;
      if (!d || typeof d !== 'object') return;

      let watched: number | null = null;
      // vidapi MEDIA_DATA payload
      if (d.type === 'MEDIA_DATA' && d.data?.progress?.watched != null) {
        watched = Number(d.data.progress.watched);
      } else if (d.type === 'PLAYER_EVENT' && d.data?.player_progress != null) {
        watched = Number(d.data.player_progress);
      }
      if (watched == null || Number.isNaN(watched) || watched < 0) return;

      const now = Date.now();
      const prev = lastWatchedRef.current;
      const prevAt = lastWatchedAtRef.current;
      lastWatchedRef.current = watched;
      lastWatchedAtRef.current = now;

      // First sample after (re)mount — just record a baseline
      if (prev === 0 || prevAt === 0) {
        onTimeUpdate?.(watched);
        return;
      }

      const elapsed = (now - prevAt) / 1000;        // real seconds passed
      const actualDelta = watched - prev;           // playback seconds moved
      const drift = actualDelta - elapsed;

      // Forward jump (drift > ~5s) or backward jump (delta < -3s) = user scrubbed
      const isSeek = drift > 5 || actualDelta < -3;
      if (isSeek) {
        onSeek?.(watched);
      } else {
        onTimeUpdate?.(watched);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [playMode, type, id, season, episode, startAt, onTimeUpdate, onSeek]);

  // Auto-scroll player into perfect view center
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setIsLoading(true);
    // Reload progress percent for shift
    const saved = Number(localStorage.getItem(`noir_progress_${type}_${id}`)) || 0;
    setProgress(saved);
  }, [type, id, season, episode, playMode]);

  // Compute VIT API provider url
  const getEmbedUrl = () => {
    if (playMode ==='trailer' && youtubeKey) {
      const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
      return `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&origin=${origin}`;
    }

    const params = new URLSearchParams({
      primaryColor: 'ff453a', // Nice bright red matching Noir brand color system
      secondaryColor: '0a0a0a',
      iconColor: 'FFFFFF',
      icons: 'vid',
      title: 'true',
      poster: 'true',
      autoplay: 'true',
    });

    if (startAt && startAt > 5) {
      params.set('startAt', String(Math.floor(startAt)));
    }

    if (type ==='tv') {
      params.set('nextbutton','true');
      return`https://vidapi.qzz.io/tv/${id}/${season}/${episode}?${params.toString()}`;
    }

    return`https://vidapi.qzz.io/movie/${id}?${params.toString()}`;
  };

  return (
    <div ref={containerRef} className="w-full my-6 mx-auto max-w-[94%] md:max-w-6xl xl:max-w-7xl animate-fade-in text-right">
      <div className="player-shell bg-black rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
        
        {/* Player Header Control Bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gradient-to-b from-neutral-900 via-[#0a0a0a] to-[#0a0a0a] border-b border-white/5 selection:bg-transparent">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span
              className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-md shrink-0 uppercase tracking-wider ${
                playMode ==='trailer' ?'bg-[#ff0033] text-white' :'bg-red-500 text-white'
              }`}
            >
              {playMode ==='trailer' ?'إعلان ترويجي' :'المشغل الرئيسي'}
</span>
            <h4 className="text-white font-semibold text-xs md:text-sm truncate select-all">
              {title} {type ==='tv' && playMode ==='movie' &&`(الموسم ${season} · الحلقة ${episode})`}
</h4>
</div>

          <div className="flex items-center gap-1.5 shrink-0 relative">
            {/* Play Mode Switcher (if trailer exists) */}
            {playMode ==='movie' && youtubeKey && (
              <button
                onClick={() => onSwitchMode('trailer')}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                title="عرض الإعلان الرسمي"
              >
                <svg viewBox="0 0 28 20" className="w-6 h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <rect width="28" height="20" rx="5" fill="#FF0000" />
                  <path d="M11 6 L19 10 L11 14 Z" fill="white" />
                </svg>
                <span className="hidden sm:inline">الإعلان الرسمي</span>
</button>
            )}

            {playMode ==='trailer' && (
              <>
                {youtubeKey && (
                  <a
                    href={`https://www.youtube.com/watch?v=${youtubeKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                    title="فتح الإعلان على يوتيوب إذا لم يعمل هنا"
                  >
                    <svg viewBox="0 0 28 20" className="w-5 h-[14px] shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <rect width="28" height="20" rx="5" fill="#FF0000" />
                      <path d="M11 6 L19 10 L11 14 Z" fill="white" />
                    </svg>
                    <span className="hidden sm:inline">يوتيوب</span>
                  </a>
                )}
                <button
                  onClick={() => onSwitchMode('movie')}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                  title="الرجوع للفيلم أو المسلسل"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>شاهد الآن</span>
                </button>
              </>
            )}

            {/* Next Episode Button */}
            {type ==='tv' && playMode ==='movie' && onNextEpisode && episode < episodesCount && (
              <button
                onClick={onNextEpisode}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                title="تشغيل الحلقة التالية للمسلسل"
              >
                <span>الحلقة التالية ⟵</span>
</button>
            )}

            {/* Skin / Engine Selection Menu — removed (locked to VideoJS Plus) */}

            {/* Host-only Pause/Resume control (live sessions) */}
            {playMode === 'movie' && isLiveHost && (
              isPausedByHost ? (
                <button
                  onClick={onHostResume}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                  title="استئناف التشغيل للجميع"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">استئناف</span>
</button>
              ) : (
                <button
                  onClick={onHostPause}
                  className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                  title="إيقاف التشغيل للجميع"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">إيقاف للجميع</span>
</button>
              )
            )}
</div>
</div>

        {/* Video Stage Frame */}
        <div className="relative aspect-video w-full bg-black">
          {isLoading && !isPausedByHost && (
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10 gap-3">
              <Loader className="w-8 h-8 text-red-500 animate-spin" />
              <span className="text-xs text-neutral-400 select-none">جاري تحميل مسار المشغّل ومزامنة الترجمة...</span>
</div>
          )}

          {playMode === 'trailer' ? (
            <iframe
              src={getEmbedUrl()}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-full border-0 relative z-0"
              onLoad={() => setIsLoading(false)}
            />
          ) : (
            <iframe
              src={isPausedByHost ? 'about:blank' : getEmbedUrl()}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
              referrerPolicy="no-referrer"
              allowFullScreen
              className="w-full h-full border-0 relative z-0"
              onLoad={() => setIsLoading(false)}
            />
          )}

          {/* Host-paused overlay (covers iframe completely) */}
          {isPausedByHost && playMode === 'movie' && (
            <div className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 select-none">
              <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                <Pause className="w-7 h-7 text-amber-400 fill-amber-400" />
</div>
              <div className="text-center px-6">
                <h3 className="text-white text-base md:text-lg font-bold mb-1">
                  أوقف المنظم التشغيل
</h3>
                {hostPauseByName && (
                  <p className="text-gray-400 text-xs md:text-sm">
                    بانتظار <span className="text-amber-400 font-semibold">{hostPauseByName}</span> ليستأنف العرض
</p>
                )}
                {isLiveHost && (
                  <p className="text-gray-500 text-[11px] mt-3">
                    اضغط زر الاستئناف بالأعلى لإكمال المشاهدة (ينعاد الفلم من البداية)
</p>
                )}
                {!isLiveHost && isLiveSession && (
                  <p className="text-gray-500 text-[11px] mt-3 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    التحكم بالتشغيل بيد المنظم فقط
</p>
                )}
</div>
</div>
          )}</div>

         {/* Browser sandbox notification details */}
        {playMode ==='movie' && (
          <div className="px-4 py-3 bg-neutral-950/80 border-t border-white/5 flex items-center gap-2 text-[11px] text-gray-500 select-all justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
            <span>نظام التشغيل خارجي. إذا لم تظهر الترجمة تلقائياً، قم بتفعيلها من قائمة الإعدادات (CC) للمشغل المدمج.</span>
</div>
        )}
</div>
</div>
  );
}
