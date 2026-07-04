/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Trash2, Eye, EyeOff, FolderPlus, Loader, Check, ArrowRight } from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchMulti, fetchItemsByIds } from '../lib/tmdb';
import { CATEGORIES } from '../lib/categories';
import {
  isAdmin, itemKey,
  ManualRef, CustomSection,
  subscribeHidden, subscribeManualItems, subscribeCustomSections,
  toggleHidden, addManualItem, removeManualItem,
  addCustomSection, removeCustomSection,
} from '../lib/adminStore';

interface AdminDashboardProps {
  userEmail?: string | null;
  onBack: () => void;
}

type Tab = 'add' | 'visibility' | 'sections';

export default function AdminDashboard({ userEmail, onBack }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('add');

  // بيانات Firestore الحية
  const [hidden, setHidden] = useState<string[]>([]);
  const [manual, setManual] = useState<ManualRef[]>([]);
  const [sections, setSections] = useState<CustomSection[]>([]);

  // بحث الإضافة
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [searching, setSearching] = useState(false);

  // العناصر المضافة يدوياً (بتفاصيلها من TMDB) لعرضها بتبويب الإخفاء
  const [manualDetailed, setManualDetailed] = useState<MovieOrShow[]>([]);

  // قسم مختار عند الإضافة
  const [pickSection, setPickSection] = useState<string>('manual');
  const [newSectionName, setNewSectionName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // اشتراكات حية
  useEffect(() => {
    const u1 = subscribeHidden(setHidden);
    const u2 = subscribeManualItems(setManual);
    const u3 = subscribeCustomSections(setSections);
    return () => { u1(); u2(); u3(); };
  }, []);

  // جيب تفاصيل العناصر اليدوية للعرض
  useEffect(() => {
    if (!manual.length) { setManualDetailed([]); return; }
    fetchItemsByIds(manual.map((m) => ({ type: m.type, id: m.id }))).then(setManualDetailed);
  }, [manual]);

  // بحث TMDB مع debounce
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchMulti(query.trim());
        setResults(r.slice(0, 20));
      } catch { setResults([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const allSections = [
    { key: 'manual', title: 'حصري نوار (مضاف يدوياً)' },
    ...CATEGORIES.map((c) => ({ key: c.key, title: c.title })),
    ...sections.map((s) => ({ key: s.key, title: s.title })),
  ];

  const isManual = useCallback(
    (type: 'movie' | 'tv', id: number) => manual.some((m) => m.type === type && m.id === id),
    [manual]
  );

  const handleAdd = async (item: MovieOrShow) => {
    const key = itemKey(item.type, item.id);
    setBusyId(key);
    await addManualItem({ type: item.type, id: item.id, section: pickSection });
    setBusyId(null);
  };

  const handleRemoveManual = async (item: MovieOrShow) => {
    const key = itemKey(item.type, item.id);
    setBusyId(key);
    await removeManualItem(item.type, item.id);
    setBusyId(null);
  };

  const handleToggleHidden = async (item: MovieOrShow) => {
    const key = itemKey(item.type, item.id);
    const currentlyHidden = hidden.includes(key);
    setBusyId(key);
    await toggleHidden(item.type, item.id, !currentlyHidden);
    setBusyId(null);
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;
    await addCustomSection(newSectionName);
    setNewSectionName('');
  };

  // حارس الوصول
  if (!isAdmin(userEmail)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-6" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <EyeOff className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-black text-white">غير مصرّح</h2>
        <p className="text-gray-400 text-sm">هذي الصفحة للإدارة فقط</p>
        <button onClick={onBack} className="mt-2 flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 rounded-full text-sm font-bold cursor-pointer transition-all">
          <ArrowRight className="w-4 h-4" /> رجوع للموقع
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 animate-fade-in" dir="rtl">
      {/* رأس */}
      <div className="flex items-center justify-between mb-8">
        <div className="text-right">
          <h1 className="font-display text-2xl md:text-3xl font-black text-white">لوحة تحكم نوار</h1>
          <p className="text-gray-500 text-xs mt-1 font-semibold">{userEmail}</p>
        </div>
        <button onClick={onBack} className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 border border-white/5 text-white px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer transition-all">
          <ArrowRight className="w-4 h-4" /> الموقع
        </button>
      </div>

      {/* تبويبات */}
      <div className="flex gap-2 mb-8 border-b border-white/5 pb-3">
        {([['add', 'إضافة محتوى'], ['visibility', 'إظهار / إخفاء'], ['sections', 'الأقسام']] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition-all ${tab === k ? 'bg-red-600 text-white' : 'bg-stone-900 text-gray-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── تبويب الإضافة ── */}
      {tab === 'add' && (
        <div>
          {/* اختيار القسم قبل الإضافة */}
          <div className="bg-[#141417] border border-white/8 rounded-2xl p-4 mb-5">
            <label className="text-white text-xs font-bold mb-2 block">القسم اللي يروح له المحتوى المضاف</label>
            <select
              value={pickSection}
              onChange={(e) => setPickSection(e.target.value)}
              className="w-full bg-stone-900 border border-white/10 text-white text-sm font-semibold py-2.5 px-3 rounded-xl outline-none cursor-pointer"
            >
              {allSections.map((s) => (
                <option key={s.key} value={s.key}>{s.title}</option>
              ))}
            </select>
          </div>

          {/* بحث */}
          <div className="relative mb-5">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="دور عن فلم أو مسلسل عشان تضيفه..."
              className="w-full bg-[#141417] border border-white/10 focus:border-red-500/60 outline-none text-white text-sm font-semibold py-3.5 pr-12 pl-4 rounded-xl transition-all placeholder-gray-600"
            />
            {searching && <Loader className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 animate-spin" />}
          </div>

          {/* نتائج */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {results.map((item) => {
              const key = itemKey(item.type, item.id);
              const added = isManual(item.type, item.id);
              const busy = busyId === key;
              return (
                <div key={key} className="relative group">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/[0.06]">
                    {item.poster && (
                      <img src={item.poster} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => added ? handleRemoveManual(item) : handleAdd(item)}
                      disabled={busy}
                      className={`absolute inset-0 flex items-center justify-center transition-all cursor-pointer ${added ? 'bg-green-600/40 opacity-100' : 'bg-black/60 opacity-0 group-hover:opacity-100'}`}
                    >
                      {busy ? <Loader className="w-6 h-6 text-white animate-spin" />
                        : added ? <Check className="w-8 h-8 text-white" />
                        : <Plus className="w-8 h-8 text-white" />}
                    </button>
                  </div>
                  <p className="text-white text-[11px] font-semibold mt-1.5 line-clamp-1 text-right">{item.title}</p>
                  <p className="text-gray-500 text-[10px] text-right">{item.year} · {item.type === 'tv' ? 'مسلسل' : 'فلم'}</p>
                </div>
              );
            })}
          </div>
          {!query.trim() && (
            <p className="text-gray-600 text-sm text-center py-12">اكتب اسم فلم أو مسلسل للبحث في TMDB</p>
          )}
        </div>
      )}

      {/* ── تبويب الإظهار/الإخفاء ── */}
      {tab === 'visibility' && (
        <div>
          <p className="text-gray-400 text-xs mb-5 leading-relaxed">
            العناصر المضافة يدوياً تظهر هنا. اضغط العين لإخفاء أو إظهار أي عنصر من الموقع.
          </p>
          {manualDetailed.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-12">ما في عناصر مضافة يدوياً بعد. أضف من تبويب "إضافة محتوى".</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {manualDetailed.map((item) => {
                const key = itemKey(item.type, item.id);
                const isHidden = hidden.includes(key);
                const busy = busyId === key;
                return (
                  <div key={key} className="relative">
                    <div className={`relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/[0.06] transition-all ${isHidden ? 'opacity-40 grayscale' : ''}`}>
                      {item.poster && (
                        <img src={item.poster} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => handleToggleHidden(item)}
                        disabled={busy}
                        className="absolute top-2 right-2 w-9 h-9 rounded-full glass flex items-center justify-center text-white cursor-pointer hover:bg-white/20 transition-all"
                        title={isHidden ? 'إظهار' : 'إخفاء'}
                      >
                        {busy ? <Loader className="w-4 h-4 animate-spin" /> : isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-white text-[11px] font-semibold mt-1.5 line-clamp-1 text-right">{item.title}</p>
                    <p className="text-gray-500 text-[10px] text-right">{isHidden ? 'مخفي' : 'ظاهر'}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── تبويب الأقسام ── */}
      {tab === 'sections' && (
        <div>
          <div className="bg-[#141417] border border-white/8 rounded-2xl p-4 mb-6">
            <label className="text-white text-xs font-bold mb-2 block">إنشاء قسم مخصص جديد</label>
            <div className="flex gap-2">
              <input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                placeholder="اسم القسم (مثلاً: أفلام عراقية)"
                className="flex-1 bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-sm font-semibold py-2.5 px-3 rounded-xl transition-all placeholder-gray-600"
              />
              <button onClick={handleAddSection} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap">
                <FolderPlus className="w-4 h-4" /> إضافة
              </button>
            </div>
          </div>

          <h3 className="text-white text-sm font-bold mb-3">أقسامك المخصصة</h3>
          {sections.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">ما في أقسام مخصصة. أنشئ واحد فوق.</p>
          ) : (
            <div className="space-y-2">
              {sections.map((s) => {
                const count = manual.filter((m) => m.section === s.key).length;
                return (
                  <div key={s.key} className="flex items-center justify-between bg-[#141417] border border-white/8 rounded-xl px-4 py-3">
                    <div className="text-right">
                      <p className="text-white text-sm font-bold">{s.title}</p>
                      <p className="text-gray-500 text-[11px]">{count} عنصر</p>
                    </div>
                    <button
                      onClick={() => removeCustomSection(s.key)}
                      className="w-9 h-9 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 cursor-pointer transition-all"
                      title="حذف القسم"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
