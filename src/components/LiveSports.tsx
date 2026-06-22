/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { X, Radio, Tv } from 'lucide-react';
import {
  LIVE_CHANNELS,
  CHANNEL_GROUPS,
  STREAM_FOLDERS,
  buildStreamUrl,
  LiveChannel,
} from '../lib/sports';

export default function LiveSports() {
  const [activeGroup, setActiveGroup] = useState<string>('الكل');
  const [selected, setSelected] = useState<LiveChannel | null>(null);
  const [folderIdx, setFolderIdx] = useState(0);

  const channels = useMemo(() => {
    if (activeGroup === 'الكل') return LIVE_CHANNELS;
    return LIVE_CHANNELS.filter((c) => c.group === activeGroup);
  }, [activeGroup]);

  const openChannel = (ch: LiveChannel) => {
    setSelected(ch);
    setFolderIdx(0);
  };

  const closeChannel = () => setSelected(null);

  return (
    <div className="w-full text-right min-h-[70vh] px-4 sm:px-8 lg:px-16 pt-28 md:pt-32 pb-24 md:pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center">
          <Radio className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white">البث المباشر</h1>
          <p className="text-neutral-500 text-xs md:text-sm">قنوات رياضية تبث على مدار الساعة — اختر قناة وشغّلها مباشرة</p>
        </div>
      </div>

      {/* Group chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-8" dir="rtl">
        {CHANNEL_GROUPS.map((g) => (
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
            onClick={() => openChannel(ch)}
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
          onClick={(e) => e.target === e.currentTarget && closeChannel()}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[600] flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-5xl bg-neutral-950 border border-white/10 rounded-3xl overflow-hidden my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex w-2 h-2 shrink-0">
                  <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-red-600"></span>
                </span>
                <h3 className="text-white font-bold text-sm md:text-base truncate">{selected.name}</h3>
              </div>
              <button
                onClick={closeChannel}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Player */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                key={`${selected.id}-${folderIdx}`}
                src={buildStreamUrl(selected.id, STREAM_FOLDERS[folderIdx])}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
                className="w-full h-full border-0"
              />
            </div>

            {/* Server switcher */}
            <div className="px-5 py-4">
              <span className="text-[11px] text-neutral-500 font-bold uppercase block mb-2">
                لو لم يعمل البث جرّب سيرفر آخر
              </span>
              <div className="flex flex-wrap gap-2" dir="rtl">
                {STREAM_FOLDERS.map((f, i) => (
                  <button
                    key={f}
                    onClick={() => setFolderIdx(i)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      folderIdx === i
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-neutral-900 text-neutral-300 border-white/5 hover:bg-neutral-800'
                    }`}
                  >
                    سيرفر {i + 1}
                  </button>
                ))}
              </div>
            </div>

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
