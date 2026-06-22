/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * البث المباشر (SportSRC) - مباريات كرة القدم الحية
 */

import { useState, useEffect } from 'react';
import { Loader, X, Radio, Calendar } from 'lucide-react';
import {
  fetchFootballMatches,
  fetchSportDetail,
  extractStreamSources,
  SportMatch,
} from '../lib/sports';

function formatMatchTime(ts: number): { day: string; time: string; isLive: boolean } {
  const d = new Date(ts);
  const now = Date.now();
  const isLive = now >= ts && now <= ts + 3 * 60 * 60 * 1000;
  const time = d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  const day = d.toLocaleDateString('ar', { weekday: 'short', day: 'numeric', month: 'short' });
  return { day, time, isLive };
}

export default function LiveSports() {
  const [matches, setMatches] = useState<SportMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<SportMatch | null>(null);
  const [sources, setSources] = useState<{ label: string; url: string }[]>([]);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchFootballMatches()
      .then((m) => {
        m.sort((a, b) => a.date - b.date);
        setMatches(m);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const openMatch = async (match: SportMatch) => {
    setSelected(match);
    setSources([]);
    setActiveSource(null);
    setStreamError('');
    setLoadingStream(true);
    try {
      const detail = await fetchSportDetail(match.id);
      // Debug: log full response so we can see exact field names returned by the API.
      // Open browser console (Cmd+Option+I) to inspect.
      console.log('[NOIR LiveSports] match id:', match.id);
      console.log('[NOIR LiveSports] detail response:', detail);
      // Show first source object in full so we can see its field names
      if (detail && Array.isArray(detail.sources) && detail.sources.length > 0) {
        console.log('[NOIR LiveSports] first source object:', detail.sources[0]);
        console.log('[NOIR LiveSports] first source keys:', Object.keys(detail.sources[0]));
      }
      const srcs = extractStreamSources(detail);
      console.log('[NOIR LiveSports] extracted sources:', srcs);
      if (srcs.length > 0) {
        setSources(srcs);
        setActiveSource(srcs[0].url);
      } else {
        setStreamError('لا يتوفر بث لهذه المباراة حالياً، قد يبدأ قرب موعد انطلاقها.');
      }
    } catch (err) {
      console.error('[NOIR LiveSports] error:', err);
      setStreamError('تعذّر تحميل البث، حاول لاحقاً.');
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
    <div className="w-full text-right min-h-[70vh] px-4 sm:px-8 lg:px-16 pt-28 md:pt-32 pb-24 md:pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center">
          <Radio className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white">البث المباشر</h1>
          <p className="text-neutral-500 text-xs md:text-sm">مباريات كرة القدم — اختر مباراة لمشاهدتها مباشرة</p>
        </div>
      </div>

      {/* Matches */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader className="w-8 h-8 text-red-500 animate-spin" />
          <span className="text-neutral-400 text-sm">جارٍ تحميل المباريات...</span>
        </div>
      ) : matches.length === 0 ? (
        <div className="py-24 text-center text-neutral-500 text-sm">
          لا توجد مباريات متاحة حالياً، تحقّق لاحقاً.
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
                      isLive ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {isLive ? 'مباشر الآن' : 'قريباً'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">كرة القدم</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {match.teams.home.badge ? (
                      <img src={match.teams.home.badge} alt="" referrerPolicy="no-referrer" className="w-7 h-7 object-contain shrink-0" />
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
                      <img src={match.teams.away.badge} alt="" referrerPolicy="no-referrer" className="w-7 h-7 object-contain shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-neutral-800 shrink-0" />
                    )}
                  </div>
                </div>

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
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className="w-4 h-4 text-red-500 shrink-0" />
                <h3 className="text-white font-bold text-sm md:text-base truncate">{selected.title}</h3>
              </div>
              <button onClick={closeMatch} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

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

            {sources.length > 1 && (
              <div className="px-5 py-4">
                <span className="text-[11px] text-neutral-500 font-bold uppercase block mb-2">السيرفرات المتاحة ({sources.length})</span>
                <div className="flex flex-wrap gap-2" dir="rtl">
                  {sources.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSource(s.url)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        activeSource === s.url ? 'bg-red-600 text-white border-red-600' : 'bg-neutral-900 text-neutral-300 border-white/5 hover:bg-neutral-800'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
