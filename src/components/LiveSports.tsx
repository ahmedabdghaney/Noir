/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, RefreshCw, Fullscreen, ExternalLink, ShieldCheck, Tv, Trophy, Sparkles, AlertCircle, Info, Zap } from 'lucide-react';

interface LiveSportsProps {
  API_KEY?: string;
}

export default function LiveSports({ API_KEY = 'ea2ad74f3128a87d62b665e08ae9b799' }: LiveSportsProps) {
  const [apiKey, setApiKey] = useState(API_KEY);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<'ar' | 'en' | 'es' | 'fr'>('ar');
  const [timezone, setTimezone] = useState('Asia/Baghdad');
  const [activeCategory, setActiveCategory] = useState<'all' | 'football' | 'basketball' | 'tennis' | 'other'>('all');
  const [iframeKey, setIframeKey] = useState(0);

  // Auto-synchronized SportSRC dynamic URL builder matching v2 specification
  let embedUrl = `https://my.sportsrc.org/api/?key=${apiKey}`;
  if (theme !== 'dark') embedUrl += `&theme=${theme}`;
  if (lang !== 'ar') embedUrl += `&lang=${lang}`;
  if (timezone && timezone !== 'UTC') embedUrl += `&timezone=${encodeURIComponent(timezone)}`;
  if (activeCategory !== 'all') {
    embedUrl += `&sport=${activeCategory}`;
  }

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(embedUrl, '_blank');
  };

  // Modern UI categories matching SportSRC v2 sports specification
  const categories = [
    { id: 'all', name: 'الكل 🌐' },
    { id: 'football', name: 'كرة القدم ⚽' },
    { id: 'basketball', name: 'كرة السلة 🏀' },
    { id: 'tennis', name: 'التنس 🎾' },
    { id: 'other', name: 'رياضات أخرى 🏆' }
  ];

  const tips = [
    { title: 'خوادم سريعة وملء الشاشة', text: 'البث يشتغل من سيرفرات SportSRC عالية السرعة والمخصصة للمباريات الكبرى مع دعم كامل لملء الشاشة.', icon: Zap },
    { title: 'بدون إعلانات منبثقة', text: 'المفتاح المدمج يقوم بتصفية الإعلانات المنبثقة الخبيثة ويسمح بالبث النظيف.', icon: ShieldCheck },
    { title: 'التحكم الذكي وتعديل الرابط', text: 'تغيير اللغة والسمة والمنطقة الزمنية يقوم بتحديث رابط التضمين ديناميكياً لتطابق تام مع دليل SportSRC.', icon: Info },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 animate-fade-in" id="live-sports-section">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-zinc-900 to-neutral-900 border border-white/5 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 bg-rose-500/10 text-rose-400 font-mono text-xs font-bold tracking-widest px-3 py-1.5 rounded-full border border-rose-500/20">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              تغطية حية ومباشرة
            </span>
            <h1 className="text-2xl md:text-3.5xl font-extrabold tracking-tight text-white">
              بث مباشر للمباريات والبطولات
            </h1>
            <p className="text-zinc-400 text-sm md:text-base max-w-2xl leading-relaxed">
              مرحباً بك في البث الرياضي المباشر. متصل مباشرة بخدمة بث رياضية قوية مع خوادم <span className="text-rose-400 font-semibold font-mono">SportSRC</span> وبمفتاح ترخيص منشّط وسرعات بث فائقة.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* API Status Flag */}
            <div className="bg-zinc-800/80 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 font-bold leading-none">ترخيص البث</div>
                <div className="text-xs text-zinc-300 font-semibold font-mono leading-none mt-1">SportSRC Premium Activated</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controller actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        {/* Category Toggles (Visual) */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 scale-[1.02]'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Support controls */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleReload}
            title="إعادة تحميل البث"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zinc-900 border border-white/5 hover:bg-zinc-800 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث القنوات
          </button>
          <button
            onClick={handleOpenExternal}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zinc-950 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            فتح بصفحة كاملة مستقلة
          </button>
        </div>
      </div>

      {/* Main Streaming Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Stream View Container */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-black border border-white/5 rounded-3xl overflow-hidden relative shadow-2xl aspect-video w-full transition-all duration-300">
            {/* Embedded Iframe */}
            <iframe
              key={iframeKey}
              src={embedUrl}
              className="w-full h-full border-0 absolute inset-0 bg-neutral-950"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              id="sportsrc-live-iframe"
            />
          </div>

          {/* Quick Notice */}
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3 text-right">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-amber-400 text-xs font-bold">ملاحظة بخصوص تشغيل قنوات البث:</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                في حال لم تظهر قائمة المباريات المباشرة داخل الصندوق بسبب حماية الخصوصية في بعض المتصفحات، ببساطة اضغط على <button onClick={handleOpenExternal} className="underline text-rose-400 hover:text-rose-300 font-semibold cursor-pointer">فتح بصفحة كاملة</button> لمشاهدة فورية مدمجة بمفتاح ترخيصك.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Info/Status */}
        <div className="space-y-6">
          {/* SportSRC V2 Configuration Controller */}
          <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
              <Sparkles className="w-4 h-4 text-rose-500 animate-pulse" />
              تعديل خيارات البث (V2 Docs)
            </h3>

            <div className="space-y-3">
              {/* API KEY Input */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">مفتاح الترخيص (API Key)</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 font-mono focus:border-rose-500 focus:outline-none"
                  placeholder="أدخل مفتاح الترخيص..."
                />
              </div>

              {/* Theme Selector */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">مظهر المشغل (Theme)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-rose-500/50 text-white'
                        : 'bg-black border-white/5 text-zinc-500'
                    }`}
                  >
                    داكن
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'bg-zinc-800 border-rose-500/50 text-white'
                        : 'bg-black border-white/5 text-zinc-500'
                    }`}
                  >
                    مضيء
                  </button>
                </div>
              </div>

              {/* Language Selector */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">لغة مشغل البث (Language)</label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as any)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:border-rose-500 focus:outline-none"
                >
                  <option value="ar">العربية (Arabic)</option>
                  <option value="en">English (English)</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="fr">Français (French)</option>
                </select>
              </div>

              {/* Timezone Select */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">المنطقة الزمنية (Timezone)</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:border-rose-500 focus:outline-none"
                >
                  <option value="Asia/Baghdad">توقيت بغداد (GMT+3)</option>
                  <option value="Asia/Riyadh">توقيت مكة (GMT+3)</option>
                  <option value="Africa/Cairo">توقيت القاهرة (GMT+2)</option>
                  <option value="UTC">توقيت غرينتش (UTC)</option>
                </select>
              </div>
            </div>

            {/* Generated HTML Iframe preview */}
            <div className="pt-2 border-t border-white/5">
              <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wide mb-1">كود التضمين النهائي:</span>
              <pre className="text-[9px] bg-black border border-white/5 p-2 rounded-xl text-emerald-400 overflow-x-auto font-mono max-h-20 select-all">
                {`<iframe src="${embedUrl}" allowfullscreen></iframe>`}
              </pre>
            </div>
          </div>

          {/* Quick Stats/Guide */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              ميزات مشغل SportSRC الحصري
            </h3>
            <div className="space-y-4">
              {tips.map((tip, i) => {
                const IconComp = tip.icon;
                return (
                  <div key={i} className="flex gap-3 text-right">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <IconComp className="w-4 h-4 text-zinc-300" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">{tip.title}</h4>
                      <p className="text-[11px] text-zinc-400 leading-normal mt-1">{tip.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Extra Details */}
          <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
              <Tv className="w-4 h-4" />
              أفضل البطولات المدعومة حياً
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              الدوري الإنجليزي الممتاز، دوري أبطال أوروبا، الدوري الإسباني، مباريات المنتخبات، دوري روشن السعودي، بالإضافة إلى بطولات التنس الكبرى وكرة السلة NBA والعديد غيرها.
            </p>
            <div className="pt-2 border-t border-white/5 text-[10px] text-zinc-500 font-mono">
              IPTV servers list syncing dynamic 24/7.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
