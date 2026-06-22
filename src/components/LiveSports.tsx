/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Loader, X, Radio, Calendar, ChevronLeft } from 'lucide-react';
import {
  fetchSportCategories,
  fetchSportMatches,
  fetchSportDetail,
  extractStreamSources,
  CATEGORY_LABELS_AR,
  SportCategory,
  SportMatch,
} from '../lib/sports';

function formatMatchTime(ts: number): { day: string; time: string; isLive: boolean } {
  const d = new Date(ts);
  const now = Date.now();
  // Treat as "live" within a 3-hour window around start.
  const isLive = now >= ts && now <= ts + 3 * 60 * 60 * 1000;
  const time = d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  const day = d.toLocaleDateString('ar', { weekday: 'short', day: 'numeric', month: 'short' });
  return { day, time, isLive };
}

export default function LiveSports() {
  const [categories, setCategories] = useState<SportCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string>('football');
  const [matches, setMatches] = useState<SportMatch[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Selected match + stream
  const [selected, setSelected] = useState<SportMatch | null>(null);
  const [sources, setSources] = useState<{ label: string; url: string }[]>([]);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState('');

  // Load categories once
  useEffect(() => {
    setLoadingCats(true);
    fetchSportCategories()
      .then((cats) => {
        setCategories(cats);
        setLoadingCats(false);
      })
      .catch(() => setLoadingCats(false));
  }, []);

  // Load matches whenever category changes
  useEffect(() => {
    setLoadingMatches(true);
    fetchSportMatches(activeCat)
      .then((m) => {
        // Sort by date ascending
        m.sort((a, b) => a.date - b.date);
        setMatches(m);
        setLoadingMatches(false);
      })
      .catch(() => setLoadingMatches(false));
  }, [activeCat]);

  const openMatch = async (match: SportMatch) => {
    setSelected(match);
    setSources([]);
    setActiveSource(null);
    setStreamError('');
    setLoadingStream(true);
    try {
      const detail = await fetchSportDetail(match.category, match.id);
      const srcs = extractStreamSources(detail);
      if (srcs.length > 0) {
        setSources(srcs);
        setActiveSource(srcs[0].url);
      } else {
        setStreamError('لا تتوفر قنوات بث لهذه المباراة حالياً.');
      }
    } catch {
      setStreamError('تعذّر تحميل قنوات البث، حاول لاحقاً.');
    } finally {
      setLoadingStream(false);
    }
  };

  const closeMatch = () => {
    setSelected(null);
    setSources([]);
    setActiveSource(null);
    setStreamError('');
  };

  return (
    <div className="w-full text-right min-h-[70vh] px-4 sm:px-8 lg:px-16 pt-28 md:pt-32 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center">
          <Radio className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white">البث المباشر</h1>
          <p className="text-neutral-500 text-xs md:text-sm">تابع أبرز المباريات الرياضية مباشرةً عبر القنوات المتاحة</p>
        </div>
      </div>

      {/* Category chips */}
      {loadingCats ? (
        <div className="flex gap-2 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-24 h-9 bg-neutral-900 rounded-full animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-8" dir="rtl">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all border ${
                activeCat === cat.id
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-neutral-900 text-neutral-300 border-white/5 hover:bg-neutral-800'
              }`}
            >
              {CATEGORY_LABELS_AR[cat.id] || cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Matches grid */}
      {loadingMatches ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader className="w-8 h-8 text-red-500 animate-spin" />
          <span className="text-neutral-400 text-sm">جارٍ تحميل المباريات...</span>
        </div>
      ) : matches.length === 0 ? (
        <div className="py-24 text-center text-neutral-500 text-sm">
          لا توجد مباريات متاحة في هذا القسم حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" dir="rtl">
          {matches.map((match) => {
            const { day, time, isLive } = formatMatchTime(match.date);
            return (
              <button
                key={match.id}
                onClick={() => openMatch(match)}
                className="group bg-neutral-900/70 hover:bg-neutral-800/80 border border-white/5 hover:border-red-500/30 rounded-2xl p-4 text-right transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isLive
                        ? 'bg-red-600 text-white'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {isLive ? 'مباشر الآن' : 'قريباً'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {CATEGORY_LABELS_AR[match.category] || match.category}
                  </span>
                </div>

                {/* Teams */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {match.teams.home.badge ? (
                      <img
                        src={match.teams.home.badge}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 object-contain shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-neutral-800 shrink-0" />
                    )}
                    <span className="text-white text-xs font-bold truncate">
                      {match.teams.home.name || match.title.split(/vs|-/)[0]?.trim() || 'الفريق الأول'}
                    </span>
                  </div>

                  <span className="text-neutral-600 text-[10px] font-bold shrink-0">ضد</span>

                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="text-white text-xs font-bold truncate text-left">
                      {match.teams.away.name || match.title.split(/vs|-/)[1]?.trim() || 'الفريق الثاني'}
                    </span>
                    {match.teams.away.badge ? (
                      <img
                        src={match.teams.away.badge}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 object-contain shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-neutral-800 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5 text-neutral-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">{day}</span>
                  <span className="w-1 h-1 bg-neutral-700 rounded-full" />
                  <span className="text-[11px] font-bold text-white">{time}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Stream Modal */}
      {selected && (
        <div
          onClick={(e) => e.target === e.currentTarget && closeMatch()}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[600] flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-5xl bg-neutral-950 border border-white/10 rounded-3xl overflow-hidden my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className="w-4 h-4 text-red-500 shrink-0" />
                <h3 className="text-white font-bold text-sm md:text-base truncate">{selected.title}</h3>
              </div>
              <button
                onClick={closeMatch}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Player */}
            <div className="relative aspect-video w-full bg-black">
              {loadingStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                  <Loader className="w-8 h-8 text-red-500 animate-spin" />
                  <span className="text-xs text-neutral-400">جارٍ تجهيز البث...</span>
                </div>
              )}
              {streamError && !loadingStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 px-6 text-center">
                  <span className="text-sm text-neutral-300 font-semibold">{streamError}</span>
                </div>
              )}
              {activeSource && !loadingStream && (
                <iframe
                  src={activeSource}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  className="w-full h-full border-0"
                />
              )}
            </div>

            {/* Channel list */}
            {sources.length > 0 && (
              <div className="px-5 py-4">
                <span className="text-[11px] text-neutral-500 font-bold uppercase block mb-2">
                  القنوات المتاحة ({sources.length})
                </span>
                <div className="flex flex-wrap gap-2" dir="rtl">
                  {sources.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSource(s.url)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        activeSource === s.url
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-neutral-900 text-neutral-300 border-white/5 hover:bg-neutral-800'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="px-5 py-3 border-t border-white/5">
              <p className="text-[10px] text-neutral-600 leading-relaxed">
                البث يُجمَّع من مصادر طرف ثالث عامة. نوار سينما لا يستضيف أو ينتج أي بث مباشر.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
