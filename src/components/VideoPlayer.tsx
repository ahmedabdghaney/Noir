/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect, useRef } from 'react';
import { Play, Loader, ShieldAlert, Pause, Lock } from 'lucide-react';

// 1. استدعاء مكتبات Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// 2. إعدادات Firebase مالتك (حط مكانها معلومات مشروعك)
const firebaseConfig = {
  apiKey: "AIzaSyDtZ_Vrp_Ub4Vti7cz3ydxnvoq_DKvQfXg",
  authDomain: "noir-movies-6c382.firebaseapp.com",
  projectId: "noir-movies-6c382",
  storageBucket: "noir-movies-6c382.firebasestorage.app",
  messagingSenderId: "817031792391",
  appId: "1:817031792391:web:78098d827d4f0c3482e7a2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  
  // 3. State لحفظ رابط الفيديو اللي نجيبه من Firebase
  const [customMp4, setCustomMp4] = useState<string | undefined>(undefined);

  // Watch progression state
  const progressKey = `noir_progress_${type}_${id}`;
  const [progress, setProgress] = useState<number>(() => {
    return Number(localStorage.getItem(progressKey)) || 0;
  });

  // Automated progress updates while actively watching
  useEffect(() => {
    if (playMode !== 'movie') return;
    const savedOnStart = Number(localStorage.getItem(progressKey)) || 0;
    let currentVal = savedOnStart === 0 ? 8 : savedOnStart;
    if (savedOnStart === 0) {
      setProgress(8);
      localStorage.setItem(progressKey, '8');
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
    }, 10000);
    return () => clearInterval(timer);
  }, [type, id, playMode, progressKey]);

  // Listen for player postMessage progress events
  const lastWatchedRef = useRef<number>(0);
  const lastWatchedAtRef = useRef<number>(0);
  useEffect(() => {
    if (playMode !== 'movie') return;
    lastWatchedRef.current = 0;
    lastWatchedAtRef.current = 0;
    const handler = (event: MessageEvent) => {
      const d: any = event?.data;
      if (!d || typeof d !== 'object') return;
      let watched: number | null = null;
      if (d.type === 'MEDIA_DATA' && d.data?.progress?.watched != null) {
        watched = Number(d.data.progress.watched);
      } else if (d.type === 'PLAYER_EVENT' && d.data?.player_progress != null) {
        watched = Number(d.data.player_progress);
      } else if (d.type === 'PLAYER_EVENT' && d.data?.currentTime != null) {
        watched = Number(d.data.currentTime);
      } else if (d.event === 'time' && d.currentTime != null) {
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
      if (prev === 0 || prevAt === 0) {
        onTimeUpdate?.(watched);
        return;
      }
      const elapsed = (now - prevAt) / 1000;
      const actualDelta = watched - prev;
      const drift = actualDelta - elapsed;
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
    const saved = Number(localStorage.getItem(`noir_progress_${type}_${id}`)) || 0;
    setProgress(saved);
  }, [type, id, season, episode, playMode]);

  // 4. دالة جلب الرابط من Firebase بدلاً من الكود الثابت
  useEffect(() => {
    if (playMode !== 'movie') return;

    const fetchVideoUrl = async () => {
      setIsLoading(true);
      try {
        // نسوي نفس المفتاح اللي كنت تسويه (movie_ID أو tv_ID_SEASON_EPISODE)
        const mp4Key = type === 'tv' ? `tv_${id}_${season}_${episode}` : `movie_${id}`;
        
        // نطلب الرابط من مجموعة movies بناءً على المفتاح
        const docRef = doc(db, "movies", mp4Key);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setCustomMp4(docSnap.data().url);
        } else {
          setCustomMp4(undefined); // ماكو فلم بالقاعدة، يرجع لـ vidapi
        }
      } catch (error) {
        console.error("Error fetching video URL:", error);
        setCustomMp4(undefined);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideoUrl();
  }, [type, id, season, episode, playMode]);

  // Custom embed overrides
  const CUSTOM_EMBEDS: Record<string, string> = {};

  const getEmbedUrl = () => {
    if (playMode === 'trailer' && youtubeKey) {
      const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
      return `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&origin=${origin}`;
    }
    const customKey = type === 'tv' ? `tv_${id}_${season}_${episode}` : `movie_${id}`;
    if (CUSTOM_EMBEDS[customKey]) {
      return CUSTOM_EMBEDS[customKey];
    }
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
              preload="metadata"
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
          )}
        </div>
      </div>
    </div>
  );
}
