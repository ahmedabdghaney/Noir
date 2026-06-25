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

  // Listen for player postMessage progress events
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
      // MEDIA_DATA payload
      if (d.type === 'MEDIA_DATA' && d.data?.progress?.watched != null) {
        watched = Number(d.data.progress.watched);
      } else if (d.type === 'PLAYER_EVENT' && d.data?.player_progress != null) {
        watched = Number(d.data.player_progress);
      } else if (d.type === 'PLAYER_EVENT' && d.data?.currentTime != null) {
        // vidsrc / vsembed player event payload
        watched = Number(d.data.currentTime);
      } else if (d.event === 'time' && d.currentTime != null) {
        // generic { event:'time', currentTime } payload
        watched = Number(d.currentTime);
      } else if (typeof d.currentTime === 'number') {
        watched = d.currentTime;
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
  // Custom DIRECT MP4 files (self-hosted / licensed content you own).
  // Map a TMDB id to a direct .mp4 URL. These play in a native <video> element
  // (not an iframe). Movie: 'movie_ID', TV: 'tv_ID_SEASON_EPISODE'.
  const CUSTOM_MP4: Record<string, string> = {
    // 'movie_872585': 'https://cloud02.albox.co/episodes/....mp4',
  };

  const mp4Key = type === 'tv' ? `tv_${id}_${season}_${episode}` : `movie_${id}`;
  const customMp4 = playMode === 'movie' ? CUSTOM_MP4[mp4Key] : undefined;

  // Custom embed overrides: map a TMDB id to your own embed URL.
  // If a movie/episode has a custom link here, it is used instead of vidapi.
  // Movie example:  movie_123456: 'https://your-embed-host.com/embed/abc'
  // TV example:     'tv_1399_1_2': 'https://your-embed-host.com/embed/xyz'  (id_season_episode)
  const CUSTOM_EMBEDS: Record<string, string> = {
    // 'movie_872585': 'https://your-embed-host.com/e/XXXXXX',
  };

  const getEmbedUrl = () => {
    if (playMode ==='trailer' && youtubeKey) {
      const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
      return `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&origin=${origin}`;
    }

    // 1) Check for a custom embed override for this exact title/episode
    const customKey = type === 'tv' ? `tv_${id}_${season}_${episode}` : `movie_${id}`;
    if (CUSTOM_EMBEDS[customKey]) {
      return CUSTOM_EMBEDS[customKey];
    }

    // 2) Default: vidapi.qzz.io — single source, reliable inside iframe, autoplay
    const params = new URLSearchParams({
      primaryColor: 'ff453a',
      secondaryColor: '0a0a0a',
      iconColor: 'FFFFFF',
      icons: 'vid',
      title: 'true',
      poster: 'true',
      autoplay: 'true',
    });
    if (startAt && startAt > 5) params.set('startAt', String(Math.floor(startAt)));
    if (type === 'tv') {
      params.set('nextbutton', 'true');
      return `https://vidapi.qzz.io/tv/${id}/${season}/${episode}?${params.toString()}`;
    }
    return `https://vidapi.qzz.io/movie/${id}?${params.toString()}`;
  };

  return (
    <div ref={containerRef} className="w-full my-6 mx-auto max-w-[94%] md:max-w-6xl xl:max-w-7xl animate-fade-in text-right">
      <div className="player-shell bg-black rounded-3xl overflow-hidden border border-white/15 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05)] ring-1 ring-white/10 relative">

        {/* Video Stage Frame */}
        <div className="relative aspect-video w-full bg-black">
          {isLoading && !isPausedByHost && (
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10 gap-3">
              <Loader className="w-8 h-8 text-red-500 animate-spin" />
              <span className="text-xs text-stone-400 select-none">جاري تحميل مسار المشغّل ومزامنة الترجمة...</span>
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
          ) : customMp4 ? (
            <video
              key={`mp4-${id}-${episode}`}
              src={customMp4}
              controls
              autoPlay
              playsInline
              className="w-full h-full bg-black relative z-0"
              onLoadedData={() => setIsLoading(false)}
              onCanPlay={() => setIsLoading(false)}
            />
          ) : (
            <iframe
              key={`player-${id}-${episode}`}
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

</div>
</div>
  );
}
