/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * البث المباشر (DaddyLive) - نسخة نظيفة عبر صيغة embed الرسمية
 * embed.php أقل إعلاناً من صفحات stream القديمة، مع إمكانية تبديل المشغّل.
 */

import { useState, useMemo } from 'react';
import { X, Radio, Tv, ExternalLink, RefreshCw } from 'lucide-react';

interface DaddyChannel {
  id: string;     // DaddyLive channel id
  name: string;
  group: string;
}

// Multiple embed domains — DaddyLive rotates domains frequently due to blocks.
// Current working list as of 2026. Update if all stop working.
const EMBED_BASES = [
  'https://daddylive.top/embed/stream.php',
  'https://daddylives.sbs/embed/stream.php',
  'https://daddylives.icu/embed/stream.php',
  'https://daddylive.org/embed/stream.php',
];

// Build embed URL. player 1..13 selectable; source=tv for 24/7 channels.
function buildEmbed(baseIdx: number, id: string, player: number): string {
  const base = EMBED_BASES[baseIdx] || EMBED_BASES[0];
  return `${base}?id=${encodeURIComponent(id)}&player=${player}&source=tv`;
}

const DADDY_CHANNELS: DaddyChannel[] = [
  // العربية
  { id: '91', name: 'beIN Sports 1 Arabic', group: 'العربية' },
  { id: '92', name: 'beIN Sports 2 Arabic', group: 'العربية' },
  { id: '93', name: 'beIN Sports 3 Arabic', group: 'العربية' },
  { id: '94', name: 'beIN Sports 4 Arabic', group: 'العربية' },
  { id: '95', name: 'beIN Sports 5 Arabic', group: 'العربية' },
  { id: '96', name: 'beIN Sports 6 Arabic', group: 'العربية' },
  { id: '97', name: 'beIN Sports 7 Arabic', group: 'العربية' },
  { id: '98', name: 'beIN Sports 8 Arabic', group: 'العربية' },
  { id: '99', name: 'beIN Sports 9 Arabic', group: 'العربية' },
  { id: '100', name: 'beIN Sports XTRA 1', group: 'العربية' },
  { id: '578', name: 'beIN Sports HD Qatar', group: 'العربية' },
  { id: '597', name: 'beIN Sports MAX Arabic', group: 'العربية' },
  { id: '61', name: 'beIN Sports MENA English 1', group: 'العربية' },
  { id: '90', name: 'beIN Sports MENA English 2', group: 'العربية' },

  // فرنسا
  { id: '116', name: 'beIN Sports 1 France', group: 'فرنسا' },
  { id: '117', name: 'beIN Sports 2 France', group: 'فرنسا' },
  { id: '118', name: 'beIN Sports 3 France', group: 'فرنسا' },
  { id: '494', name: 'beIN Sports MAX 4 France', group: 'فرنسا' },
  { id: '495', name: 'beIN Sports MAX 5 France', group: 'فرنسا' },
  { id: '496', name: 'beIN Sports MAX 6 France', group: 'فرنسا' },
  { id: '497', name: 'beIN Sports MAX 7 France', group: 'فرنسا' },
  { id: '498', name: 'beIN Sports MAX 8 France', group: 'فرنسا' },
  { id: '499', name: 'beIN Sports MAX 9 France', group: 'فرنسا' },
  { id: '500', name: 'beIN Sports MAX 10 France', group: 'فرنسا' },

  // تركيا
  { id: '62', name: 'beIN Sports 1 Turkey', group: 'تركيا' },
  { id: '63', name: 'beIN Sports 2 Turkey', group: 'تركيا' },
  { id: '64', name: 'beIN Sports 3 Turkey', group: 'تركيا' },
  { id: '67', name: 'beIN Sports 4 Turkey', group: 'تركيا' },
  { id: '1010', name: 'beIN Sports 5 Turkey', group: 'تركيا' },

  // أخرى
  { id: '425', name: 'beIN Sports USA', group: 'أخرى' },
  { id: '372', name: 'beIN Sports en Español', group: 'أخرى' },
];

const GROUPS = ['الكل', 'العربية', 'فرنسا', 'تركيا', 'أخرى'];

export default function LiveSports() {
  const [activeGroup, setActiveGroup] = useState('الكل');
  const [selected, setSelected] = useState<DaddyChannel | null>(null);
  const [player, setPlayer] = useState(1);
  const [baseIdx, setBaseIdx] = useState(0);

  const channels = useMemo(() => {
    if (activeGroup === 'الكل') return DADDY_CHANNELS;
    return DADDY_CHANNELS.filter((c) => c.group === activeGroup);
  }, [activeGroup]);

  const open = (ch: DaddyChannel) => {
    setSelected(ch);
    setPlayer(1);
    setBaseIdx(0);
  };
  const close = () => setSelected(null);

  return (
    <div className="w-full text-right min-h-[70vh] px-4 sm:px-8 lg:px-16 pt-28 md:pt-32 pb-24 md:pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center">
          <Radio className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white">البث المباشر</h1>
          <p className="text-neutral-500 text-xs md:text-sm">قنوات رياضية مباشرة على مدار الساعة</p>
        </div>
      </div>

      {/* Tip about ads */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-4 py-3 mb-6 mt-4">
        <p className="text-[11px] md:text-xs text-amber-200/80 leading-relaxed">
          نصيحة: إذا ظهر إعلان أو لم يبدأ البث فوراً، أغلق الإعلان وجرّب تبديل «المشغّل» أو «المصدر» من الأزرار أسفل الشاشة. استخدام مانع إعلانات في المتصفح يحسّن التجربة كثيراً.
        </p>
      </div>

      {/* Group chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-8" dir="rtl">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all border ${
              activeGroup === g
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-neutral-900 text-neutral-300 border-white/5 hover:bg-neutral-800'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Channels grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4" dir="rtl">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => open(ch)}
            className="group bg-neutral-900/70 hover:bg-neutral-800/80 border border-white/5 hover:border-red-500/40 rounded-2xl p-4 text-right transition-all active:scale-[0.98] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/20 flex items-center justify-center shrink-0">
                <Tv className="w-4.5 h-4.5 text-red-500" />
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500"></span>
                </span>
                مباشر
              </span>
            </div>
            <div>
              <h3 className="text-white text-xs md:text-sm font-bold leading-tight">{ch.name}</h3>
              <span className="text-neutral-500 text-[10px] font-medium">{ch.group}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Player Modal */}
      {selected && (
        <div
          onClick={(e) => e.target === e.currentTarget && close()}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[600] flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-5xl bg-neutral-950 border border-white/10 rounded-3xl overflow-hidden my-8">
            {/* header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex w-2 h-2 shrink-0">
                  <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-red-600"></span>
                </span>
                <h3 className="text-white font-bold text-sm md:text-base truncate">{selected.name}</h3>
              </div>
              <button
                onClick={close}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* player */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                key={`${selected.id}-${player}-${baseIdx}`}
                src={buildEmbed(baseIdx, selected.id, player)}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="origin"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                className="w-full h-full border-0"
              />
            </div>

            {/* controls */}
            <div className="px-5 py-4 space-y-4">
              {/* player switch */}
              <div>
                <span className="text-[11px] text-neutral-500 font-bold uppercase block mb-2">
                  المشغّل (جرّب رقم آخر لو لم يعمل)
                </span>
                <div className="flex flex-wrap gap-2" dir="rtl">
                  {[1, 2, 3, 4, 5, 6].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlayer(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        player === p
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-neutral-900 text-neutral-300 border-white/5 hover:bg-neutral-800'
                      }`}
                    >
                      مشغّل {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* source/domain switch */}
              <div>
                <span className="text-[11px] text-neutral-500 font-bold uppercase block mb-2">
                  المصدر (بدّله لو القناة لا تفتح)
                </span>
                <div className="flex flex-wrap gap-2 items-center" dir="rtl">
                  {EMBED_BASES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setBaseIdx(i)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        baseIdx === i
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-neutral-900 text-neutral-300 border-white/5 hover:bg-neutral-800'
                      }`}
                    >
                      مصدر {i + 1}
                    </button>
                  ))}
                  <a
                    href={buildEmbed(baseIdx, selected.id, player)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    فتح بنافذة منفصلة
                  </a>
                </div>
              </div>
            </div>

            {/* disclaimer */}
            <div className="px-5 py-3 border-t border-white/5">
              <p className="text-[10px] text-neutral-600 leading-relaxed">
                البث يُجمَّع من مصادر طرف ثالث عامة (DaddyLive). نوار سينما لا يستضيف أو ينتج أي بث مباشر.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
