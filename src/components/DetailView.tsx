/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Youtube, Dot, Star, Clock, Calendar, Globe, Languages, ArrowRight, Share2, Plus, Check, RotateCcw, Users, MessageSquare, Send, Copy, AlertCircle } from 'lucide-react';
import { DetailedInfo, MovieOrShow, CastMember } from '../types';
import { fetchDetailedTitle, getPosterUrl, getBackdropUrl } from '../lib/tmdb';
import VideoPlayer from './VideoPlayer';
import MovieRow from './MovieRow';
import { useWatchTogether } from '../lib/useWatchTogether';

interface DetailViewProps {
  type: 'movie' | 'tv';
  id: number;
  onBackClick: () => void;
  onItemClick: (item: MovieOrShow) => void;
  onOpenShare: (url: string) => void;
  user: { name: string; email?: string; type: 'guest' | 'google' | 'email' } | null;
  showToast: (message: string) => void;
  autoOpenWatchTogether?: string;
  onClearAutoOpenWatchTogether?: () => void;
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
  onBackClick,
  onItemClick,
  onOpenShare,
  user,
  showToast,
  autoOpenWatchTogether ='',
  onClearAutoOpenWatchTogether,
}: DetailViewProps) {
  const [data, setData] = useState<DetailedInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Watchlist Save state
  const [isSaved, setIsSaved] = useState(false);

  // TV Episode States
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodesCount, setEpisodesCount] = useState(1);

  // Player Playback States
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerMode, setPlayerMode] = useState<'movie' | 'trailer'>('movie');
  const [isPausedByHost, setIsPausedByHost] = useState(false);
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

  // Watch Together - Live (real WebSocket connection)
  const [isWatchTogetherOpen, setIsWatchTogetherOpen] = useState(false);
  const [wtRoomCode, setWtRoomCode] = useState('');
  const [wtNewMsg, setWtNewMsg] = useState('');
  const [wtCopied, setWtCopied] = useState(false);

  const wtName = user?.name || 'زائر';
  const {
    connected: wtConnected,
    isHost: wtIsHost,
    members: wtMembers,
    messages: wtMessages,
    error: wtError,
    hostTime: wtHostTime,
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
        // Snapshot the host's current time so the iframe boots from that point.
        setStartAtSnapshot(Math.max(0, Math.floor(sig.time || 0)));
        setIsPlayerOpen(true);
        setPlayerMode('movie');
        setIsPausedByHost(false);
        setHostPauseByName('');
      } else if (sig.action === 'pause') {
        setIsPausedByHost(true);
        setHostPauseByName(sig.byName);
        showToast(`${sig.byName} أوقف التشغيل مؤقتاً`);
      } else if (sig.action === 'seek') {
        // Host scrubbed the timeline. Reload the iframe at the new position.
        const t = Math.max(0, Math.floor(sig.time || 0));
        setStartAtSnapshot(t);
        localTimeRef.current = t;
        if (!isPlayerOpen) {
          setIsPlayerOpen(true);
          setPlayerMode('movie');
        }
        showToast(`${sig.byName} انتقل إلى ${formatHms(t)}`);
      }
    },
  });

  const loadSavedProgress = () => {
    const progressKey =`noir_progress_${type}_${id}`;
    const stored = localStorage.getItem(progressKey);
    setSavedProgressPercent(stored ? Number(stored) : 0);
  };

  useEffect(() => {
    loadSavedProgress();
  }, [type, id]);

  const handleStartFromBeginning = () => {
    const progressKey =`noir_progress_${type}_${id}`;
    localStorage.setItem(progressKey,'0');
    setSavedProgressPercent(0);
    // Open main movie stream
    handlePlayClick('movie');
  };

  // Auto-join a room from a shared link
  useEffect(() => {
    if (autoOpenWatchTogether) {
      setIsWatchTogetherOpen(true);
      setWtRoomCode(autoOpenWatchTogether);
      onClearAutoOpenWatchTogether?.();
    }
  }, [autoOpenWatchTogether]);

  // Late joiner: if the host is already mid-movie, auto-open the player at the host's time
  const didAutoOpenForHostTimeRef = useRef(false);
  useEffect(() => {
    if (!wtConnected || wtIsHost) return;
    if (didAutoOpenForHostTimeRef.current) return;
    if (!isPlayerOpen && wtHostTime > 5) {
      didAutoOpenForHostTimeRef.current = true;
      setStartAtSnapshot(Math.floor(wtHostTime));
      setPlayerMode('movie');
      setIsPlayerOpen(true);
    }
  }, [wtConnected, wtIsHost, wtHostTime, isPlayerOpen]);

  // Reset the auto-open guard whenever the live session state changes
  useEffect(() => {
    if (!isWatchTogetherOpen) {
      didAutoOpenForHostTimeRef.current = false;
    }
  }, [isWatchTogetherOpen]);

  // When the panel opens without a room code, create one (this client becomes host on the server)
  useEffect(() => {
    if (isWatchTogetherOpen && !wtRoomCode) {
      const code = 'NOIR-' + Math.floor(1000 + Math.random() * 9000);
      setWtRoomCode(code);
    }
  }, [isWatchTogetherOpen, wtRoomCode]);

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
      
      // Load current watchlist state
      try {
        const savedList = localStorage.getItem('noir_watchlist');
        if (savedList) {
          const parsed = JSON.parse(savedList);
          const exists = parsed.some((item: any) => item.id === id && item.type === type);
          setIsSaved(exists);
        } else {
          setIsSaved(false);
        }
      } catch (e) {
        console.error(e);
      }

      try {
        const details = await fetchDetailedTitle(type, id);
        if (!active) return;
        setData(details);

        // Initialize TV states if needed
        if (type ==='tv' && details.seasons && details.seasons.length > 0) {
          // Filter to select first available season with season_number > 0 structure
          const validSeason = details.seasons.find((s) => s.season_number > 0) || details.seasons[0];
          setSelectedSeason(validSeason.season_number);
          setEpisodesCount(validSeason.episode_count || 1);
          setSelectedEpisode(1);
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

  const handlePlayClick = (mode: 'movie' | 'trailer') => {
    setPlayerMode(mode);
    setIsPlayerOpen(true);
    setIsPausedByHost(false);
    setHostPauseByName('');
    if (mode === 'movie') {
      // Host starts fresh; a late-joining viewer should boot from the host's current time.
      const startFrom = wtConnected && !wtIsHost ? Math.max(0, Math.floor(wtHostTime)) : 0;
      setStartAtSnapshot(startFrom);
      localTimeRef.current = startFrom;
    }
    // If host in a live session, tell everyone to open the stream too
    if (isWatchTogetherOpen && wtConnected && wtIsHost && mode === 'movie') {
      wtSendPlayer('play', localTimeRef.current);
    }
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
    if (!wtConnected || !wtIsHost) return;
    const now = Date.now();
    if (now - lastTimeBroadcastRef.current >= 4000) {
      lastTimeBroadcastRef.current = now;
      wtSendTime(seconds);
    }
  };

  // Host scrubbed inside the iframe — push the new position to everyone immediately.
  const handleSeek = (seconds: number) => {
    localTimeRef.current = seconds;
    if (!wtConnected || !wtIsHost) return;
    lastTimeBroadcastRef.current = Date.now();
    wtSendPlayer('seek', Math.floor(seconds));
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 py-20">
        <div className="w-10 h-10 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
        <span className="text-gray-400 font-medium text-sm">جاري جلب تفاصيل الفيلم من قاعدة البيانات...</span>
</div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full min-h-[50vh] flex flex-col items-center justify-center text-center py-20 px-6 gap-4">
        <span className="text-5xl">⚠</span>
        <h3 className="text-xl font-bold text-white">عذراً، فشل تحميل تفاصيل العنوان</h3>
        <p className="text-gray-400 text-sm max-w-sm">يرجى التحقق من اتصالك بالإنترنت، لم نستطع الاتصال بمزود البيانات TMDB.</p>
        <button
          onClick={onBackClick}
          className="flex items-center gap-2 bg-neutral-800 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-neutral-700 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 ml-1" />
          الرجوع للرئيسية
</button>
</div>
    );
  }

  const title = data.title || (data as any).name ||'غير معروف';
  const year = (data.release_date || data.first_air_date ||'').slice(0, 4);
  const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 0;
  const genres = data.genres ? data.genres.map((g) => g.name) : [];
  const cast = data.credits?.cast ? data.credits.cast.slice(0, 8) : [];
  const crew = data.credits?.crew || [];
  const directors = crew.filter((c) => c.job ==='Director').map((c) => c.name);
  const director = directors.length > 0 ? directors.join('،') : (data.created_by && data.created_by[0] ? data.created_by[0].name :'غير محدد');

  const country = data.production_countries && data.production_countries[0] ? data.production_countries[0].name :'غير معروف';
  const mainLang = data.spoken_languages && data.spoken_languages[0] ? data.spoken_languages[0].name :'الأصلية';

  const handleToggleSave = () => {
    if (user?.type ==='guest') {
      showToast('يجب تسجيل الدخول باستخدام حساب جوجل أولاً لإضافة عناوين لقائمتك');
      return;
    }
    if (!data) return;
    try {
      const savedList = localStorage.getItem('noir_watchlist');
      let list = savedList ? JSON.parse(savedList) : [];
      if (isSaved) {
        list = list.filter((item: any) => !(item.id === id && item.type === type));
        setIsSaved(false);
      } else {
        list.push({
          id,
          type,
          title,
          poster: getPosterUrl(data.poster_path),
          backdrop: getBackdropUrl(data.backdrop_path),
          rating: data.vote_average || 0,
          year,
          genres
        });
        setIsSaved(true);
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
          title: r.title || r.name ||'غير معروف',
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
    <div className="w-full text-right">
      
      {/* Immersive backdrop background section */}
      <div className="relative w-full h-[35vh] md:h-[45vh] overflow-hidden select-none mb-4">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${getBackdropUrl(data.backdrop_path) || getPosterUrl(data.poster_path) ||''})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
</div>

      {/* Main Details Panel Layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-12 relative -mt-36 md:-mt-48 z-10">
        
        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6 md:gap-12 items-end">
          
          {/* Text Information pane (Right side in standard RTL layouts) */}
          <div className="order-2 md:order-1 flex flex-col items-start text-right min-w-0 pr-0 md:pr-4 w-full">
            
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-2 sm:mb-3 tracking-tight leading-tight select-all">
              {title}
</h1>

            {/* Tagline */}
            {data.tagline && (
              <p className="text-red-400/90 text-xs sm:text-sm md:text-base font-semibold italic mb-3 sm:mb-4 leading-normal">
"{data.tagline}"
</p>
            )}

            {/* Row Meta Metrics */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3.5 text-[11px] sm:text-xs md:text-sm text-gray-300 font-semibold mb-3 sm:mb-4 leading-none">
              <span className="flex items-center gap-1 text-[#f5c518]">
                <Star className="w-3.5 h-3.5 fill-current" />
                {data.vote_average ? data.vote_average.toFixed(1) :'غ/م'} / 10
</span>
              <span className="text-neutral-700 select-none">•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                {year ||'—'}
</span>
              <span className="text-neutral-700 select-none">•</span>
              {runtime > 0 && (
                <>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    {runtime} دقيقة
</span>
                  <span className="text-neutral-700 select-none">•</span>
</>
              )}
              <span className="text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 uppercase text-[9px] sm:text-xs">
                {type ==='movie' ?'فيلم سينمائي' :'مسلسل تلفزيوني'}
</span>
</div>

            {/* Genre Tags List */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 sm:mb-4">
                {genres.map((g, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] sm:text-xs font-semibold text-gray-300 bg-neutral-900 border border-white/5 py-0.5 sm:py-1 px-2.5 sm:px-3 rounded-full"
                  >
                    {g}
</span>
                ))}
</div>
            )}

            {/* Synopsis placed right below Details bar and tags */}
            <div className="mb-4 sm:mb-6 max-w-2xl text-right leading-relaxed select-text">
              <p className="text-gray-350 text-xs sm:text-sm md:text-base font-medium leading-relaxed">
                {data.overview ||'لا يوجد وصف متاح بنسق اللغة العربية لهذا العنوان حالياً.'}
</p>
</div>

            {/* TV Series Episode Grid Selectors */}
            {type ==='tv' && data.seasons && data.seasons.length > 0 && (
              <div className="flex flex-wrap gap-3 p-4 bg-neutral-900/80 border border-white/5 rounded-2xl mb-6 w-full max-w-lg">
                <div className="flex flex-col gap-1.5 min-w-[120px] flex-1">
                  <span className="text-[10px] text-gray-500 font-bold">الموسم</span>
                  <select
                    value={selectedSeason}
                    onChange={handleSeasonSelectChange}
                    className="w-full bg-neutral-800 text-white rounded-xl py-2 px-3.5 text-sm font-semibold border border-white/10 focus:outline-none focus:border-red-500 custom-select"
                  >
                    {data.seasons
                      .filter((s) => s.season_number > 0)
                      .map((s) => (
                        <option key={s.id} value={s.season_number}>
                          الموسم {s.season_number} ({s.episode_count || 1} حلقة)
</option>
                      ))}
</select>
</div>

                <div className="flex flex-col gap-1.5 min-w-[120px] flex-1">
                  <span className="text-[10px] text-gray-500 font-bold">الحلقة</span>
                  <select
                    value={selectedEpisode}
                    onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                    className="w-full bg-neutral-800 text-white rounded-xl py-2 px-3.5 text-sm font-semibold border border-white/10 focus:outline-none focus:border-red-500 custom-select"
                  >
                    {Array.from({ length: episodesCount }).map((_, i) => (
                      <option key={i} value={i + 1}>
                        الحلقة {i + 1}
</option>
                    ))}
</select>
</div>
</div>
            )}

            {/* Action buttons (Streaming Play / Share / Save) */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
              {savedProgressPercent > 0 ? (
                <>
                  <button
                    onClick={() => handlePlayClick('movie')}
                    className="flex items-center gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-4 sm:px-8 py-2 md:py-3 rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg text-xs sm:text-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-white" />
                    <span>إكمال المشاهدة ({savedProgressPercent}%)</span>
</button>

                  <button
                    onClick={handleStartFromBeginning}
                    className="flex items-center gap-1.5 sm:gap-2 bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-white/10 font-bold px-4 sm:px-6 py-2 md:py-3 rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>البدء من البداية</span>
</button>
</>
              ) : (
                <button
                  onClick={() => handlePlayClick('movie')}
                  className="flex items-center gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-4 sm:px-8 py-2 md:py-3 rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg text-xs sm:text-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-white" />
                  <span>المشاهدة الآن</span>
</button>
              )}

              <button
                onClick={handleToggleSave}
                className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 md:py-3 rounded-full transition-all text-xs sm:text-sm font-bold cursor-pointer border ${
                  isSaved 
                    ?'bg-emerald-600/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/20' 
                    :'bg-neutral-900 border-white/10 text-white hover:bg-neutral-800'
                }`}
              >
                {isSaved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isSaved ?'محفوظ في قائمتي' :'حفظ في قائمتي'}</span>
</button>

              <button
                onClick={() => {
                  if (user?.type ==='guest') {
                    showToast('يجب تسجيل الدخول باستخدام حساب جوجل أولاً لبدء مشاهدة جماعية');
                    return;
                  }
                  setIsWatchTogetherOpen(!isWatchTogetherOpen);
                }}
                className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 md:py-3 rounded-full transition-all text-xs sm:text-sm font-bold cursor-pointer border ${
                  isWatchTogetherOpen 
                    ?'bg-red-600/20 border-red-500/40 text-red-400 hover:bg-red-600/30' 
                    :'bg-neutral-900 border-white/10 text-white hover:bg-neutral-800'
                }`}
              >
                <Users className="w-4 h-4 text-red-500" />
                <span>مشاهدة جماعية</span>
</button>

              {youtubeKey && (
                <button
                  onClick={() => handlePlayClick('trailer')}
                  className="flex items-center gap-1.5 sm:gap-2 bg-neutral-900 hover:bg-neutral-800 text-white border border-white/10 px-4 sm:px-5 py-2 md:py-3 rounded-full transition-all cursor-pointer text-xs sm:text-sm"
                >
                  <Youtube className="w-4.5 h-4.5 text-red-500 fill-current" />
                  <span>الإعلان الرسمي</span>
</button>
              )}

              <button
                onClick={() => onOpenShare(window.location.href)}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
                title="مشاركة الرابط الحالي"
              >
                <Share2 className="w-3.5 h-3.5" />
</button>
</div>
</div>

          {/* Left Side: Solid Poster Art (Order-1 on display size to look traditional) */}
          <div className="order-1 md:order-2">
            <div className="w-[160px] md:w-[240px] aspect-[2/3] mx-auto md:mx-0 rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl relative select-none">
              {data.poster_path ? (
                <img
                  src={getPosterUrl(data.poster_path) || undefined}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-center p-4 bg-neutral-950 text-neutral-600 text-xs font-semibold leading-normal">
                  {title}
</div>
              )}
</div>
</div>

</div>

        {/* Watch Together Live Synchronization Panel */}
        {isWatchTogetherOpen && (
          <div className="mt-8 bg-neutral-950 border border-white/5 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl space-y-6 text-right animate-fade-in max-w-4xl mx-auto selection:bg-red-500/25">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-red-500" />
</div>
                <div className="flex flex-col text-right">
                  <h3 className="text-white font-bold text-sm sm:text-base">استوديو المشاهدة الجماعية</h3>
                  <p className="text-gray-400 text-[10px] sm:text-xs">
                    {wtConnected
                      ? 'متصل مباشرة الآن. شارك الرابط مع أصدقائك لينضموا إليك فعلياً.'
                      : wtError
                        ? wtError
                        : 'جارٍ الاتصال بخادم المشاهدة الجماعية...'}
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
                  <span className="text-red-400">{wtRoomCode}</span>
                </div>
                <button
                  onClick={handleCopyRoomLink}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer shadow-md"
                >
                  <Copy className="w-3 h-3" />
                  <span>{wtCopied ?'تم النسخ!' :'نسخ الرابط'}</span>
</button>
</div>
</div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6">
              {/* Interactive Synced Chat Box */}
              <div className="flex flex-col bg-neutral-900 rounded-2xl border border-white/5 overflow-hidden h-[300px]">
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
                            : 'ml-auto items-end text-right'
                      }`}
                    >
                      {msg.type !== 'system' && (
                        <span className="text-[10px] text-gray-500 font-bold px-1">{msg.sender}</span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-xs font-semibold leading-relaxed ${
                        msg.type === 'system' 
                          ? '' 
                          : msg.self
                            ? 'bg-red-600 text-white rounded-tl-none' 
                            : 'bg-neutral-800 text-gray-200 rounded-tr-none'
                      }`}>
                        {msg.text}
</div>
</div>
                  ))}
</div>

                {/* Send action footer input */}
                <form onSubmit={handleSendWtMessage} className="p-3 bg-neutral-950 border-t border-white/5 flex items-center gap-2">
                  <input
                    type="text"
                    value={wtNewMsg}
                    onChange={(e) => setWtNewMsg(e.target.value)}
                    placeholder="اكتب رسالة لأفراد الغرفة المشاهدين..."
                    className="flex-grow bg-neutral-900 text-white text-xs px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:border-red-500 text-right font-medium"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
</button>
</form>
</div>

              {/* Members status bar */}
              <div className="bg-neutral-900 border border-white/5 p-4 rounded-2xl flex flex-col gap-3 text-right">
                <span className="text-xs text-gray-500 font-bold border-b border-white/5 pb-2 block">المتصلون الآن ({wtMembers.length})</span>
                <div className="flex flex-col gap-2.5">
                  {wtMembers.length === 0 && (
                    <span className="text-[11px] text-gray-600 font-medium">لا يوجد أحد بعد. انسخ الرابط وأرسله لأصدقائك.</span>
                  )}
                  {wtMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-white text-xs font-bold">{member.name}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold">
                        {member.isHost ? 'المنظم' : 'متصل'}
                      </span>
</div>
                  ))}
</div>
</div>
</div>
</div>
        )}

        {/* Specs Factors Panel - Technical Details cards matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-900/60 border border-white/5 rounded-2xl px-5 py-4 my-8">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">الإخراج</span>
            <span className="text-white text-xs md:text-sm font-semibold truncate" title={director}>
              {director}
</span>
</div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">دولة الإنتاج</span>
            <span className="text-white text-xs md:text-sm font-semibold truncate" title={country}>
              {country}
</span>
</div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">اللغة الأصلية</span>
            <span className="text-white text-xs md:text-sm font-semibold truncate">
              {mainLang}
</span>
</div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">عام الإصدار</span>
            <span className="text-white text-xs md:text-sm font-semibold">
              {year ||'غ/م'}
</span>
</div>
</div>

        {/* Bottom Synopsis and Cast grids */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-10 mt-8">
          
          <div className="space-y-8 text-right min-w-0">
            {/* Cast roster row component */}
            {cast.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white tracking-tight border-r-2 border-red-500 pr-2">أبرز كادر العمل</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {cast.map((c: CastMember) => (
                    <div
                      key={c.id}
                      className="p-2.5 bg-neutral-900/80 border border-white/5 rounded-2xl flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-800 shrink-0 select-none">
                        {c.profile_path ? (
                          <img
                            src={getPosterUrl(c.profile_path) || undefined}
                            alt={c.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600 text-[10px] font-bold">
                            {c.name.slice(0, 2)}
</div>
                        )}
</div>
                      <div className="flex flex-col justify-center min-w-0 text-right">
                        <span className="text-xs font-bold text-white truncate" title={c.name}>
                          {c.name}
</span>
                        <span className="text-[10px] text-gray-500 truncate mt-0.5" title={c.character}>
                          بدور {c.character ||'—'}
</span>
</div>
</div>
                  ))}
</div>
</div>
            )}
</div>

          {/* Quick sidebar placeholder metrics or credits */}
          <div className="hidden md:flex flex-col gap-6 text-right w-full shrink-0 border-r border-white/5 pr-6">
            <div className="space-y-1.5">
              <h4 className="text-neutral-500 text-[10px] font-bold uppercase">التقييم الجماهيري</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-[#f5c518]">
                  {data.vote_average ? data.vote_average.toFixed(1) :'غ/م'}
</span>
                <span className="text-gray-500 text-xs">/ 10</span>
</div>
              <p className="text-[10px] text-gray-400 font-medium">مستند إلى قاعدة بيانات جماهيرية واسعة.</p>
</div>

            {genres.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-neutral-500 text-[10px] font-bold uppercase">التصنيفات الشاملة</h4>
                <div className="flex flex-col gap-1.5">
                  {genres.map((g, idx) => (
                    <span key={idx} className="text-xs text-gray-300 font-semibold bg-neutral-900 border border-white/5 py-1.5 px-3 rounded-lg text-center">
                      {g}
</span>
                  ))}
</div>
</div>
            )}
</div>

</div>

        {/* Recomendations module list titles */}
        {recommendations.length > 0 && (
          <div className="border-t border-white/5 pt-12 mt-12">
            <MovieRow
              title="عناوين وتوصيات مشابهة"
              subtitle="قد تنال إعجابك بناءً على هذا العمل"
              items={recommendations}
              onItemClick={onItemClick}
            />
</div>
        )}

        {/* Video Player Mount Position - placed last so details/cast/recs stay above */}
        {isPlayerOpen && (
          <VideoPlayer
            type={type}
            id={id}
            title={title}
            season={selectedSeason}
            episode={selectedEpisode}
            episodesCount={episodesCount}
            youtubeKey={youtubeKey}
            playMode={playerMode}
            isPausedByHost={isPausedByHost}
            hostPauseByName={hostPauseByName}
            isLiveHost={isWatchTogetherOpen && wtConnected && wtIsHost}
            isLiveSession={isWatchTogetherOpen && wtConnected}
            startAt={startAtSnapshot}
            onTimeUpdate={handleTimeUpdate}
            onSeek={handleSeek}
            onHostPause={handleHostPause}
            onHostResume={handleHostResume}
            onClose={() => setIsPlayerOpen(false)}
            onSwitchMode={(mode) => setPlayerMode(mode)}
            onNextEpisode={() => {
              if (selectedEpisode < episodesCount) {
                setSelectedEpisode((prev) => prev + 1);
              }
            }}
          />
        )}

        {/* Explicit back route */}
        <div className="py-12 text-center">
          <button
            onClick={onBackClick}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 ml-1" />
            <span>العودة لشاشة التصفّح الرئيسية</span>
</button>
</div>

</div>
</div>
  );
}
