import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  Search, AlertCircle, ExternalLink, Settings, Tv, Code2, AlertTriangle, Info
} from 'lucide-react';
import Hls from 'hls.js';

interface LiveSportsProps {
  API_KEY?: string;
}

interface LiveChannel {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'bein' | 'alkass' | 'others';
  logoText: string;
  badge: string;
  desc: string;
  m3u8Url: string; // Direct stream fallback for the gorgeous custom HLS player
}

const DEFAULT_CHANNELS: LiveChannel[] = [
  { id: 'bein1', nameAr: 'beIN Sports HD 1', nameEn: 'beIN Sports 1', category: 'bein', logoText: 'B1', badge: 'HD 1', desc: 'البطولات الأوروبية، دوري أبطال أوروبا، والدوري الإنجليزي الممتاز', m3u8Url: 'https://live.ysite.link/live/bein1.m3u8' },
  { id: 'bein2', nameAr: 'beIN Sports HD 2', nameEn: 'beIN Sports 2', category: 'bein', logoText: 'B2', badge: 'HD 2', desc: 'مباريات الدوري الإسباني واللقاءات العالمية الكبرى مباشرةً', m3u8Url: 'https://live.ysite.link/live/bein2.m3u8' },
  { id: 'bein3', nameAr: 'beIN Sports HD 3', nameEn: 'beIN Sports 3', category: 'bein', logoText: 'B3', badge: 'HD 3', desc: 'الدوري الإيطالي والبطولات الأوروبية الحصرية والإقليمية', m3u8Url: 'https://live.ysite.link/live/bein3.m3u8' },
  { id: 'bein4', nameAr: 'beIN Sports HD 4', nameEn: 'beIN Sports 4', category: 'bein', logoText: 'B4', badge: 'HD 4', desc: 'الدوري الفرنسي والبطولات اللاتينية وتغطيات النجوم العالمية', m3u8Url: 'https://live.ysite.link/live/bein4.m3u8' },
  { id: 'bein-news', nameAr: 'beIN Sports الإخبارية', nameEn: 'beIN Sports News', category: 'bein', logoText: 'BN', badge: 'NEWS', desc: 'لمتابعة النشرات والمستجدات الرياضية والأخبار العاجلة والبرامج الحوارية', m3u8Url: 'https://live-bein-news.yallashoot-new.com/live/bein_news/index.m3u8' },
  { id: 'alkass1', nameAr: 'الكأس الأولى HD', nameEn: 'Al Kass 1', category: 'alkass', logoText: 'K1', badge: 'ONE', desc: 'بث مباشر من القناة القطرية - بطولات الخليج ومسابقات الهجن والدوريات المحلية والآسيوية', m3u8Url: 'https://alkass.s.llnwi.net/alkass/alkass_1.m3u8' },
  { id: 'alkass2', nameAr: 'الكأس الثانية HD', nameEn: 'Al Kass 2', category: 'alkass', logoText: 'K2', badge: 'TWO', desc: 'نقل حي للمسابقات المحلية ومباريات الكؤوس الآسيوية والعربية والبطولات المتنوعة', m3u8Url: 'https://alkass.s.llnwi.net/alkass/alkass_2.m3u8' },
  { id: 'alkass3', nameAr: 'الكأس الثالثة HD', nameEn: 'Al Kass 3', category: 'alkass', logoText: 'K3', badge: 'THREE', desc: 'البرامج الرياضية التخصصية، بطولات الخيل، والمنافسات الآسيوية الكبرى وتصفيات كأس العالم', m3u8Url: 'https://alkass.s.llnwi.net/alkass/alkass_3.m3u8' },
  { id: 'alkass4', nameAr: 'الكأس الرابعة HD', nameEn: 'Al Kass 4', category: 'alkass', logoText: 'K4', badge: 'FOUR', desc: 'نقل ومواكبة الألعاب الفردية المشتركة والمباريات الدولية المستضيفة مع استوديو تحليلي متميز', m3u8Url: 'https://alkass.s.llnwi.net/alkass/alkass_4.m3u8' },
  { id: 'ssc1', nameAr: 'SSC Sports 1 HD', nameEn: 'SSC Sports 1', category: 'others', logoText: 'S1', badge: 'SSC', desc: 'الدوري السعودي للمحترفين، أبطال آسيا وكبرى الفعاليات والبطولات الرياضية بالمملكة', m3u8Url: 'https://ssc-1.yallashoot-new.com/live/ssc1/index.m3u8' },
  { id: 'adsports1', nameAr: 'أبوظبي الرياضية 1', nameEn: 'AD Sports 1', category: 'others', logoText: 'AD', badge: 'AD1', desc: 'الدوري وكأس السوبر الإيطالي، بطولات الإمارات العربية ومسابقات الخيل والزوارق', m3u8Url: 'https://live.asg.sh/live/ads1.m3u8' }
];

export default function LiveSports({ API_KEY = 'ea2ad74f3128a87d62b665e08ae9b799' }: LiveSportsProps) {
  type ChannelCategory = 'all' | 'bein' | 'alkass' | 'others';
  type PlayerMode = 'smart' | 'iframe';

  // State
  const [channels, setChannels] = useState<LiveChannel[]>(() => {
    const saved = localStorage.getItem('noir_custom_live_channels_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // Backward compatibility merge with old localstorage format
    const oldSaved = localStorage.getItem('noir_custom_live_channels');
    if (oldSaved) {
      try {
        const oldParsed = JSON.parse(oldSaved) as any[];
        // Merge matching IDs to keep user customization but add m3u8Url values
        return DEFAULT_CHANNELS.map(def => {
          const oldMatch = oldParsed.find(o => o.id === def.id || o.nameEn === def.nameEn);
          return oldMatch ? { ...def, id: oldMatch.id, m3u8Url: oldMatch.m3u8Url || def.m3u8Url } : def;
        });
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_CHANNELS;
  });

  const [selectedChanId, setSelectedChanId] = useState<string>('bein1');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ChannelCategory>('all');
  
  // Custom Player Modes & States
  const [playerMode, setPlayerMode] = useState<PlayerMode>('smart');
  const [embedUrlType, setEmbedUrlType] = useState<'slash' | 'param'>('slash');
  
  // Editing state for channels details
  const [isEditingChan, setIsEditingChan] = useState(false);
  const [editIdValue, setEditIdValue] = useState('');
  const [editM3u8Value, setEditM3u8Value] = useState('');

  // Video references & player control states
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [liveStreamReloadToken, setLiveStreamReloadToken] = useState(0);

  const currentChannel = channels.find(c => c.id === selectedChanId) || channels[0];

  // Sync state edit form
  useEffect(() => {
    if (currentChannel) {
      setEditIdValue(currentChannel.id);
      setEditM3u8Value(currentChannel.m3u8Url);
    }
  }, [selectedChanId, currentChannel]);

  // Handle stream loader inside Video Tag using hls.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video || playerMode !== 'smart') return;

    setPlayerError(null);
    setIsBuffering(true);
    setIsPlaying(false);

    let hls: Hls | null = null;
    const streamUrl = currentChannel.m3u8Url;

    if (!streamUrl) {
      setIsBuffering(false);
      setPlayerError('لم يتم إدخال رابط بث M3U8 لهذه القناة بعد. اضغط على زر التعديل لإضافة رابط مباشر.');
      return;
    }

    // Initialize Hls.js or Native Player
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferSize: 0,
        maxBufferLength: 10,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        // Autoplay streams on source switch
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('Network error, attempting to recover...');
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Media playback error, attempting to recover...');
              hls?.recoverMediaError();
              break;
            default:
              setIsBuffering(false);
              setPlayerError('رابط البث الحالي متوقف أو محجوب. يمكنك تعديل رابط القناة أو الانتقال لوضع تضمين الويب.');
              hls?.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Direct native support (Safari + iOS browsers)
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });

      video.addEventListener('error', () => {
        setIsBuffering(false);
        setPlayerError('رابط البث الحالي غير متاح. اضغط على زر التعديل بأسفل المشغل لتحديث الرابط فوراً.');
      });
    } else {
      setIsBuffering(false);
      setPlayerError('متصفحك الحالي لا يدعم تشغيل روابط البث الذكي M3U8 مباشرة. يرجى تجربة وضع تضمين الويب.');
    }

    // Monitor buffering / waiting events
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      if (hls) {
        hls.destroy();
      }
    };
  }, [selectedChanId, currentChannel.m3u8Url, playerMode, liveStreamReloadToken]);

  // Fullscreen styling listeners
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Controls actions
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error("Play error:", err));
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMute = !isMuted;
    video.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const requestFullscreenToggle = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error("Fullscreen fail:", err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error("Exit fullscreen fail:", err));
    }
  };

  // Update customized channel IDs & m3u8 addresses
  const handleUpdateChannel = () => {
    if (!editIdValue.trim()) return;
    const updated = channels.map(c => {
      if (c.id === selectedChanId) {
        return { 
          ...c, 
          id: editIdValue.trim(), 
          m3u8Url: editM3u8Value.trim() 
        };
      }
      return c;
    });
    setChannels(updated);
    localStorage.setItem('noir_custom_live_channels_v2', JSON.stringify(updated));
    setSelectedChanId(editIdValue.trim());
    setIsEditingChan(false);
  };

  const handleResetChannels = () => {
    if (window.confirm('هل تريد فعلاً استعادة روابط وقنوات البث الافتراضية؟ سيتم إلغاء كافة التغييرات الخاصة بك.')) {
      setChannels(DEFAULT_CHANNELS);
      localStorage.removeItem('noir_custom_live_channels_v2');
      localStorage.removeItem('noir_custom_live_channels');
      setSelectedChanId('bein1');
      setIsEditingChan(false);
      setLiveStreamReloadToken(t => t + 1);
    }
  };

  const filteredChannels = channels.filter(c => {
    const matchQuery = 
      c.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.badge.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchCat = activeCategory === 'all' || c.category === activeCategory;
    return matchQuery && matchCat;
  });

  const getStreamIframeUrl = () => {
    const baseUrl = 'https://sportsrc.me/embed';
    if (embedUrlType === 'slash') {
      return `${baseUrl}/${currentChannel.id}?key=${API_KEY}`;
    } else {
      return `${baseUrl}?id=${currentChannel.id}&key=${API_KEY}`;
    }
  };

  const openInNewTab = () => {
    window.open(getStreamIframeUrl(), '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 animate-fade-in text-right [direction:rtl]">
      
      {/* Explanation alert explaining to user why nested iframes are restricted & introducing the M3U8 Player + Fullscreen */}
      <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs md:text-sm flex flex-col md:flex-row items-start md:items-center gap-3.5">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 md:mt-0" />
        <div className="flex-1 space-y-1">
          <p className="font-bold">ملاحظة هامة لحرية المشاهدة:</p>
          <p className="text-amber-300">
            خدمات البث المباشر (مثل SportSRC) تحجب التشغيل في بعض المتصفحات عندما تكون مضمنة داخل صفحات أخرى (إطارات Iframe). 
            قمنا بحل هذه المشكلة بالكامل عن طريق توفير <strong>"المشغل الذكي الذاتي (HLS)"</strong> المزود بأزرار وبأدوات حقيقية للتشغيل، الإيقاف، وتكبير الشاشة، بالإضافة لإتاحة خيار <strong>"البث في نافذة مستقلة"</strong> لتشغيل آمن 100% بدون إعلانات مزعجة.
          </p>
        </div>
      </div>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-white/5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-none">
              البث الرياضي المباشر
            </h1>
          </div>
          <p className="text-neutral-400 text-sm md:text-base font-medium max-w-2xl">
            مرحباً بك في البث المباشر المرقّى. الآن متصل مباشرة بأقوى خدمة بث رياضي مع خوادم <span className="text-rose-400 font-semibold font-mono">SportSRC</span> وبمفتاح ترخيص مدمج وسرعات عالية خالية من التعقيد.
          </p>
        </div>
        
        {/* Reset Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetChannels}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-neutral-900 border border-white/10 text-neutral-400 rounded-xl hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            استعادة القنوات الافتراضية
          </button>
        </div>
      </div>

      {/* Interface grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 1. Player Section (Col 1-2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Mode Selector Tabs */}
          <div className="flex bg-neutral-950 p-1.5 rounded-2xl border border-white/5 gap-1 shadow-inner relative z-10">
            <button
              onClick={() => setPlayerMode('smart')}
              className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                playerMode === 'smart' 
                  ? 'bg-rose-600 text-white shadow-lg' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Tv className="w-4 h-4" />
              المشغل الذكي المتكامل (M3U8) - مع أزرار تحكم وتكبير
            </button>
            <button
              onClick={() => setPlayerMode('iframe')}
              className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                playerMode === 'iframe' 
                  ? 'bg-rose-600 text-white shadow-lg' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Code2 className="w-4 h-4" />
              تضمين موقع المصدر (مواقع البث الخارجي)
            </button>
          </div>

          {/* Player Screen Area */}
          <div 
            ref={playerContainerRef}
            className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black aspect-video shadow-[0_4px_35px_rgba(0,0,0,0.9)] transition-all duration-300 flex items-center justify-center"
          >
            {playerMode === 'smart' ? (
              // ------------------------------------
              // A: CUSTOM HTML5 HLS VIDEO PLAYER
              // ------------------------------------
              <div className="relative w-full h-full flex items-center justify-center group/player select-none">
                <video
                  ref={videoRef}
                  onClick={togglePlayPause}
                  className="w-full h-full object-contain cursor-pointer"
                  playsInline
                />

                {/* Loading / Buffering Spinner Overlay */}
                {isBuffering && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4 animate-fade-in pointer-events-none">
                    <RefreshCw className="w-12 h-12 text-rose-500 animate-spin" />
                    <span className="text-white text-xs font-bold font-mono tracking-widest bg-black/40 px-3 py-1.5 rounded-full">جاري جلب البث المباشر...</span>
                  </div>
                )}

                {/* Static Player Error Banner */}
                {playerError && (
                  <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center text-center p-6 gap-3 select-text">
                    <AlertCircle className="w-14 h-14 text-rose-500 animate-bounce" />
                    <h3 className="text-white font-extrabold text-base">عذراً، تعذر تشغيل الملقم التلقائي للبث</h3>
                    <p className="text-neutral-400 text-xs max-w-md leading-relaxed">
                      {playerError}
                    </p>
                    <div className="flex items-center gap-2.5 mt-2">
                      <button 
                        onClick={() => setLiveStreamReloadToken(t => t + 1)}
                        className="px-4 py-2 bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
                      </button>
                      <button 
                        onClick={() => setPlayerMode('iframe')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Code2 className="w-3.5 h-3.5" /> وضع التضمين البديل
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Overlay Controls (Glows on Hover or Always on Touch/Fullscreen) */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none flex flex-col justify-between p-4 transition-opacity duration-300 md:opacity-0 group-hover/player:opacity-100 ${isFullscreen ? 'opacity-100' : ''}`}>
                  
                  {/* Top Bar Overlay */}
                  <div className="flex items-center justify-between w-full pointer-events-auto">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 animate-pulse"></span>
                      </span>
                      <span className="text-[10px] text-white font-extrabold tracking-wider bg-rose-650 px-2 py-0.5 rounded-md font-mono">LIVE / بث حي</span>
                    </div>
                    
                    <span className="text-[10px] bg-neutral-950/80 text-neutral-300 font-semibold px-2.5 py-1 rounded-md border border-white/5 backdrop-blur-md">
                      M3U8 Player Mode
                    </span>
                  </div>

                  {/* Centered Bigger Play/Pause Indicator (Visual Feedback Only) */}
                  <div className="self-center pointer-events-none">
                    {!isPlaying && !isBuffering && !playerError && (
                      <div className="w-16 h-16 rounded-full bg-rose-600/90 flex items-center justify-center shadow-lg transition-transform hover:scale-110 pointer-events-auto cursor-pointer" onClick={togglePlayPause}>
                        <Play className="w-8 h-8 text-white fill-white translate-x-[-1px]" />
                      </div>
                    )}
                  </div>

                  {/* Bottom Controls Bar */}
                  <div className="w-full flex items-center justify-between pointer-events-auto select-none mt-auto">
                    
                    {/* Right side: Play/Pause Mute/Volume */}
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={togglePlayPause}
                        className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
                      >
                        {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white fill-white" />}
                      </button>

                      <div className="flex items-center gap-2 group/volume">
                        <button 
                          onClick={toggleMute}
                          className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="كتم الصوت"
                        >
                          {isMuted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5 text-white" />}
                        </button>
                        
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-16 md:w-20 accent-rose-500 h-1 bg-neutral-700 rounded-lg cursor-pointer transition-all opacity-0 group-hover/volume:opacity-100 focus:opacity-100"
                        />
                      </div>
                    </div>

                    {/* Channel title & Fullscreen */}
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-extrabold text-white bg-black/40 px-2.5 py-1 rounded-md backdrop-blur-md">
                        {currentChannel.nameAr}
                      </span>
                      
                      <button 
                        onClick={requestFullscreenToggle}
                        className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="تكبير وتصغير الشاشة"
                      >
                        {isFullscreen ? <Minimize2 className="w-5 h-5 text-white" /> : <Maximize2 className="w-5 h-5 text-white" />}
                      </button>
                    </div>

                  </div>

                </div>

              </div>
            ) : (
              // ------------------------------------
              // B: STANDARD IFRAME MODE
              // ------------------------------------
              <div className="w-full h-full relative">
                <iframe
                  src={getStreamIframeUrl()}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allow="autoplay; fullscreen *; picture-in-picture *; encrypted-media"
                  allowFullScreen
                  className="w-full h-full"
                />
                
                <div className="absolute top-4 right-4 bg-rose-600/90 text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-md select-none pointer-events-none shadow-md">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
              </div>
            )}

          </div>

          {/* Embedded warning and Direct External Stream opener button when inside frame */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-orange-400" />
              </div>
              <div className="text-right">
                <h4 className="text-xs font-bold text-white leading-tight">تجاوز الحجوزات وإعلانات المصدر</h4>
                <p className="text-[10px] text-neutral-400">إذا لم تفتح القناة أو تظهر شاشة سوداء من المصدر، اضغط على زر فتح البث في نافذة مستقلة.</p>
              </div>
            </div>

            <button
              onClick={openInNewTab}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 select-none"
            >
              <ExternalLink className="w-4 h-4 text-rose-500" />
              <span>فتح البث الأصلي في نافذة منفصلة ↗️</span>
            </button>
          </div>

          {/* Under Player Details Area */}
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/5 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 text-right flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 font-mono">
                    {currentChannel.badge}
                  </span>
                  <h2 className="text-lg md:text-xl font-bold text-white leading-none">
                    {currentChannel.nameAr}
                  </h2>
                </div>
                <p className="text-xs text-neutral-400 font-medium">
                  {currentChannel.desc}
                </p>
              </div>

              {/* Toggle configurations / iframe parameters */}
              {playerMode === 'iframe' && (
                <div className="flex flex-col items-end gap-1.5shrink-0">
                  <span className="text-[10px] text-neutral-500 font-bold self-start md:self-end">صيغة رابط المصدر المضمن:</span>
                  <div className="bg-neutral-950 p-1 rounded-xl border border-white/5 flex gap-1">
                    <button
                      onClick={() => setEmbedUrlType('slash')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        embedUrlType === 'slash' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-400'
                      }`}
                    >
                      embed/ID
                    </button>
                    <button
                      onClick={() => setEmbedUrlType('param')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        embedUrlType === 'param' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-400'
                      }`}
                    >
                      embed?id=ID
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Stream Modifiers & Persist Config Box */}
            <div className="mt-5 pt-5 border-t border-white/5">
              {isEditingChan ? (
                <div className="space-y-3 p-4 bg-neutral-950 rounded-2xl border border-white/5">
                  <span className="text-xs font-bold text-neutral-300 block">إعداد مبرمج القناة للبث المباشر:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 font-bold block">معرف القناة لتضمين الويب (ID):</label>
                      <input
                        type="text"
                        value={editIdValue}
                        onChange={(e) => setEditIdValue(e.target.value)}
                        placeholder="مثال: bein1"
                        className="w-full bg-neutral-900 text-white text-xs px-3 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-rose-500/50 font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 font-bold block">رابط البث الذكي المباشر (HLS / M3U8):</label>
                      <input
                        type="text"
                        value={editM3u8Value}
                        onChange={(e) => setEditM3u8Value(e.target.value)}
                        placeholder="رابط ملف m3u8 للبث الحي..."
                        className="w-full bg-neutral-900 text-white text-xs px-3 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-rose-500/50 font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={handleUpdateChannel}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      حفظ التعديلات للقناة
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingChan(false);
                        setEditIdValue(currentChannel.id);
                        setEditM3u8Value(currentChannel.m3u8Url);
                      }}
                      className="px-3 py-2 bg-neutral-900 text-neutral-400 text-xs font-bold rounded-xl hover:text-white transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-neutral-500">
                    <span className="bg-white/5 px-2 py-1 rounded">IFRAME ID: {currentChannel.id}</span>
                    <span className="bg-white/5 px-2 py-1 rounded select-all max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap block" title={currentChannel.m3u8Url}>
                      M3U8: {currentChannel.m3u8Url || 'غير مخصص'}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsEditingChan(true);
                      setEditIdValue(currentChannel.id);
                      setEditM3u8Value(currentChannel.m3u8Url);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors cursor-pointer select-none"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    تعديل وتخصيص البث لهذه القناة ⚙️
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Channels Select Side Column */}
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white font-sans">اختر القناة الرياضية</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 font-bold font-mono">
                {filteredChannels.length} / {channels.length}
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن بين سبورت، الكأس..."
                className="w-full bg-neutral-950 text-white text-xs pr-10 pl-3 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:border-white/10 text-right leading-none"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500"><Search className="w-3.5 h-3.5" /></span>
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-950 rounded-xl border border-white/5">
              {(['all', 'bein', 'alkass', 'others'] as ChannelCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`py-1.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer text-center capitalize ${
                    activeCategory === cat ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-400'
                  }`}
                >
                  {cat === 'all' ? 'الكل' : cat === 'bein' ? 'beIN' : cat === 'alkass' ? 'الكأس' : 'أخرى'}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[500px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
            {filteredChannels.length === 0 ? (
              <div className="p-8 text-center bg-neutral-900/20 border border-white/5 rounded-2xl text-xs text-neutral-500 font-semibold">
                لا توجد قنوات تطابق بحثك حالياً.
              </div>
            ) : (
              filteredChannels.map((c) => {
                const isSelected = c.id === selectedChanId;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedChanId(c.id);
                      setIsEditingChan(false);
                    }}
                    className={`w-full p-3.5 rounded-2xl text-right transition-all flex items-center justify-between gap-4 border cursor-pointer select-none relative group ${
                      isSelected 
                        ? 'bg-white/10 border-white/20 shadow-md' 
                        : 'bg-neutral-900/20 border-white/5 hover:bg-neutral-900/40 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-xs transition-colors shrink-0 ${
                        isSelected 
                          ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                          : 'bg-neutral-950 text-neutral-400 group-hover:text-neutral-300'
                      }`}>
                        {c.logoText}
                      </div>
                      
                      <div className="space-y-1">
                        <p className={`text-xs font-bold leading-none transition-colors ${
                          isSelected ? 'text-white' : 'text-neutral-300 group-hover:text-white'
                        }`}>
                          {c.nameAr}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-semibold font-mono" dir="ltr">
                          {c.nameEn}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        isSelected 
                          ? 'bg-rose-500/20 text-rose-300' 
                          : 'bg-white/5 text-neutral-500'
                      }`}>
                        {c.badge}
                      </span>
                      
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
