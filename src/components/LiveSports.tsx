import { useState, useEffect } from 'react';
import { RefreshCw, Play, Search, Gamepad2, AlertCircle } from 'lucide-react';

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
}

const DEFAULT_CHANNELS: LiveChannel[] = [
  { id: 'bein1', nameAr: 'beIN Sports HD 1', nameEn: 'beIN Sports 1', category: 'bein', logoText: 'B1', badge: 'HD 1', desc: 'البطولات الأوروبية، دوري أبطال أوروبا، والدوري الإنجليزي الممتاز' },
  { id: 'bein2', nameAr: 'beIN Sports HD 2', nameEn: 'beIN Sports 2', category: 'bein', logoText: 'B2', badge: 'HD 2', desc: 'مباريات الدوري الإسباني واللقاءات العالمية الكبرى مباشرةً' },
  { id: 'bein3', nameAr: 'beIN Sports HD 3', nameEn: 'beIN Sports 3', category: 'bein', logoText: 'B3', badge: 'HD 3', desc: 'الدوري الإيطالي والبطولات الأوروبية الحصرية والإقليمية' },
  { id: 'bein4', nameAr: 'beIN Sports HD 4', nameEn: 'beIN Sports 4', category: 'bein', logoText: 'B4', badge: 'HD 4', desc: 'الدوري الفرنسي والبطولات اللاتينية وتغطيات النجوم العالمية' },
  { id: 'bein-news', nameAr: 'beIN Sports الإخبارية', nameEn: 'beIN Sports News', category: 'bein', logoText: 'BN', badge: 'NEWS', desc: 'لمتابعة النشرات والمستجدات الرياضية والأخبار العاجلة والبرامج الحوارية' },
  { id: 'alkass1', nameAr: 'الكأس الأولى HD', nameEn: 'Al Kass 1', category: 'alkass', logoText: 'K1', badge: 'ONE', desc: 'بطولات الخليج ودوري نجوم قطر ومسابقات التنس العالمية' },
  { id: 'alkass2', nameAr: 'الكأس الثانية HD', nameEn: 'Al Kass 2', category: 'alkass', logoText: 'K2', badge: 'TWO', desc: 'نقل حي للمسابقات المحلية ومباريات الكؤوس الآسيوية والعربية' },
  { id: 'alkass3', nameAr: 'الكأس الثالثة HD', nameEn: 'Al Kass 3', category: 'alkass', logoText: 'K3', badge: 'THREE', desc: 'البرامج الرياضية التخصصية، بطولات الخيل، والمنافسات الآسيوية الكبرى' },
  { id: 'alkass4', nameAr: 'الكأس الرابعة HD', nameEn: 'Al Kass 4', category: 'alkass', logoText: 'K4', badge: 'FOUR', desc: 'نقل ومواكبة الألعاب الفردية المشتركة والمباريات الدولية المستضيفة' },
  { id: 'ssc1', nameAr: 'SSC Sports 1 HD', nameEn: 'SSC Sports 1', category: 'others', logoText: 'S1', badge: 'SSC', desc: 'الدوري السعودي للمحترفين، أبطال آسيا وكبرى الفعاليات في المملكة' },
  { id: 'adsports1', nameAr: 'أبوظبي الرياضية 1', nameEn: 'AD Sports 1', category: 'others', logoText: 'AD', badge: 'AD1', desc: 'الدوري وكأس السوبر الإيطالي، بطولات الإمارات، وتغطيات عالمية منوعة' }
];

export default function LiveSports({ API_KEY = 'ea2ad74f3128a87d62b665e08ae9b799' }: LiveSportsProps) {
  type ChannelCategory = 'all' | 'bein' | 'alkass' | 'others';

  // State
  const [channels, setChannels] = useState<LiveChannel[]>(() => {
    const saved = localStorage.getItem('noir_custom_live_channels');
    return saved ? JSON.parse(saved) : DEFAULT_CHANNELS;
  });
  const [selectedChanId, setSelectedChanId] = useState<string>('bein1');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ChannelCategory>('all');
  
  // Format configurations
  const [embedUrlType, setEmbedUrlType] = useState<'slash' | 'param'>('slash');
  const [customIdValue, setCustomIdValue] = useState('');
  const [isEditingId, setIsEditingId] = useState(false);

  const currentChannel = channels.find(c => c.id === selectedChanId) || channels[0];

  const handleUpdateChannelId = () => {
    if (!customIdValue.trim()) return;
    const updated = channels.map(c => {
      if (c.id === selectedChanId) {
        return { ...c, id: customIdValue.trim() };
      }
      return c;
    });
    setChannels(updated);
    localStorage.setItem('noir_custom_live_channels', JSON.stringify(updated));
    setSelectedChanId(customIdValue.trim());
    setIsEditingId(false);
    setCustomIdValue('');
  };

  const handleResetChannels = () => {
    if (window.confirm('هل تريد استعادة قائمة القنوات الافتراضية؟')) {
      setChannels(DEFAULT_CHANNELS);
      localStorage.removeItem('noir_custom_live_channels');
      setSelectedChanId('bein1');
      setIsEditingId(false);
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

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 animate-fade-in text-right [direction:rtl]">
      {/* Title & info box */}
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
          <div className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black aspect-video shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
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

          {/* Under Player Details Area */}
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/5 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 text-right">
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

              {/* Toggle configuration format */}
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[10px] text-neutral-500 font-bold self-start md:self-end">صيغة رابط المشغّل:</span>
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
            </div>

            {/* Editing Box */}
            <div className="mt-5 pt-5 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              {isEditingId ? (
                <div className="w-full flex items-center gap-2">
                  <input
                    type="text"
                    value={customIdValue}
                    onChange={(e) => setCustomIdValue(e.target.value)}
                    placeholder={`أدخل معرّف القناة الجديد لـ ${currentChannel.nameEn}`}
                    className="bg-neutral-950 text-white text-xs px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-rose-500/50 flex-1 font-mono text-left"
                    dir="ltr"
                  />
                  <button
                    onClick={handleUpdateChannelId}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    حفظ
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingId(false);
                      setCustomIdValue('');
                    }}
                    className="px-3 py-2 bg-neutral-950 text-neutral-400 text-xs font-bold rounded-xl hover:text-white transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-neutral-500">
                    <span className="bg-white/5 px-2 py-1 rounded">PLAYER ID: {currentChannel.id}</span>
                    <span className="bg-white/5 px-2 py-1 rounded">API KEY: {API_KEY.slice(0, 6)}...{API_KEY.slice(-6)}</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsEditingId(true);
                      setCustomIdValue(currentChannel.id);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors cursor-pointer text-left self-end sm:self-auto"
                  >
                    تعديل معرّف القناة لهذه الخانة ⚙️
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
              <span className="text-sm font-bold text-white">اختر القناة الرياضية</span>
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
          <div className="max-h-[460px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
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
                      setIsEditingId(false);
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
