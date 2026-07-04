/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Search, Plus, Trash2, Eye, EyeOff, FolderPlus, Loader, ArrowRight,
  Edit3, Star, Film, Import, PenLine, X,
} from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchMulti, importFromTmdb, TmdbImport } from '../lib/tmdb';
import { CATEGORIES } from '../lib/categories';
import {
  isAdmin, manualKey, genUid,
  ManualItem, CustomSection,
  subscribeManualItems, subscribeCustomSections,
  upsertManualItem, removeManualItem,
  addCustomSection, removeCustomSection,
} from '../lib/adminStore';

interface AdminDashboardProps {
  userEmail?: string | null;
  onBack: () => void;
}

type Tab = 'library' | 'add' | 'sections';

// عنصر فورم فارغ
const emptyForm = (): ManualItem => ({
  uid: genUid(),
  tmdbId: undefined,
  type: 'movie',
  title: '',
  overview: '',
  poster: null,
  backdrop: null,
  rating: 0,
  autoRating: false,
  year: '',
  genres: [],
  director: '',
  country: '',
  language: '',
  section: 'manual',
  inHero: false,
  addedAt: Date.now(),
});

export default function AdminDashboard({ userEmail, onBack }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('library');

  const [items, setItems] = useState<ManualItem[]>([]);
  const [sections, setSections] = useState<CustomSection[]>([]);

  // فورم التحرير الحالي (null = مغلق)
  const [form, setForm] = useState<ManualItem | null>(null);
  const [saving, setSaving] = useState(false);

  // بحث TMDB (لتبويب الإضافة)
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);

  // أقسام مخصصة
  const [newSectionName, setNewSectionName] = useState('');

  useEffect(() => {
    const u1 = subscribeManualItems(setItems);
    const u2 = subscribeCustomSections(setSections);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults((await searchMulti(query.trim())).slice(0, 18)); }
      catch { setResults([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const allSections = [
    { key: 'manual', title: 'حصري نوار' },
    ...CATEGORIES.map((c) => ({ key: c.key, title: c.title })),
    ...sections.map((s) => ({ key: s.key, title: s.title })),
  ];
  const sectionTitle = (key: string) => allSections.find((s) => s.key === key)?.title || key;

  // ── إجراءات ──

  // استيراد من TMDB → يملأ الفورم بكل الحقول ويفتحه للتعديل
  const handleImport = async (item: MovieOrShow) => {
    setImporting(item.id);
    const data: TmdbImport | null = await importFromTmdb(item.type, item.id);
    setImporting(null);
    if (!data) return;
    setForm({
      ...emptyForm(),
      uid: genUid(),
      tmdbId: data.tmdbId,
      type: data.type,
      title: data.title,
      overview: data.overview,
      poster: data.poster,
      backdrop: data.backdrop,
      rating: data.rating,
      autoRating: true,       // افتراضياً التقييم يتحدث تلقائياً للمستورد
      year: data.year,
      genres: data.genres,
      director: data.director,
      country: data.country,
      language: data.language,
    });
    setTab('add');
  };

  const handleManualNew = () => { setForm(emptyForm()); setTab('add'); };
  const handleEdit = (it: ManualItem) => { setForm({ ...it }); setTab('add'); };

  const handleSave = async () => {
    if (!form || !form.title.trim()) return;
    setSaving(true);
    await upsertManualItem({ ...form, addedAt: form.addedAt || Date.now() });
    setSaving(false);
    setForm(null);
    setTab('library');
  };

  const handleDelete = async (it: ManualItem) => {
    await removeManualItem(manualKey(it));
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;
    await addCustomSection(newSectionName);
    setNewSectionName('');
  };

  const setF = <K extends keyof ManualItem>(k: K, v: ManualItem[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

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
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 animate-fade-in" dir="rtl">
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
        {([['library', 'المكتبة'], ['add', form ? 'تحرير' : 'إضافة'], ['sections', 'الأقسام']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition-all ${tab === k ? 'bg-red-600 text-white' : 'bg-stone-900 text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ المكتبة ══ */}
      {tab === 'library' && (
        <div>
          <div className="flex gap-2 mb-6">
            <button onClick={handleManualNew} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all">
              <PenLine className="w-4 h-4" /> إضافة يدوية
            </button>
            <button onClick={() => { setForm(null); setTab('add'); }} className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 border border-white/8 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all">
              <Import className="w-4 h-4" /> استيراد من TMDB
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-20">
              <Film className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">ما في محتوى مضاف بعد. ابدأ بإضافة يدوية أو استيراد من TMDB.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((it) => (
                <div key={manualKey(it)} className="bg-[#141417] border border-white/8 rounded-2xl overflow-hidden group">
                  <div className="relative aspect-[2/3] bg-stone-900">
                    {it.poster && <img src={it.poster} alt={it.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    {it.inHero && (
                      <span className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">هيرو</span>
                    )}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(it)} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer" title="تعديل">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(it)} className="w-10 h-10 rounded-full bg-red-500/30 hover:bg-red-500/50 flex items-center justify-center text-white cursor-pointer" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 text-right">
                    <p className="text-white text-xs font-bold line-clamp-1">{it.title}</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">{it.year} · {sectionTitle(it.section)}</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <span className="text-yellow-500 text-[10px] font-bold">{it.rating ? it.rating.toFixed(1) : '—'}</span>
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ إضافة / تحرير ══ */}
      {tab === 'add' && (
        <div>
          {/* لو مافي فورم مفتوح: نعرض بحث TMDB للاستيراد */}
          {!form && (
            <div>
              <p className="text-gray-400 text-xs mb-4">دور عن فلم أو مسلسل لاستيراد كل تفاصيله من TMDB، أو <button onClick={handleManualNew} className="text-red-400 underline cursor-pointer">أضف يدوياً</button>.</p>
              <div className="relative mb-5">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="اسم الفلم أو المسلسل..."
                  className="w-full bg-[#141417] border border-white/10 focus:border-red-500/60 outline-none text-white text-sm font-semibold py-3.5 pr-12 pl-4 rounded-xl transition-all placeholder-gray-600" />
                {searching && <Loader className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 animate-spin" />}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {results.map((item) => (
                  <button key={`${item.type}_${item.id}`} onClick={() => handleImport(item)} disabled={importing === item.id}
                    className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/[0.06] hover:border-red-500/50 cursor-pointer group transition-all">
                    {item.poster && <img src={item.poster} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      {importing === item.id ? <Loader className="w-6 h-6 text-white animate-spin" /> : <Import className="w-7 h-7 text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* الفورم الكامل */}
          {form && (
            <div className="bg-[#141417] border border-white/8 rounded-2xl p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  {form.tmdbId ? <Import className="w-5 h-5 text-red-500" /> : <PenLine className="w-5 h-5 text-red-500" />}
                  {form.tmdbId ? 'مستورد من TMDB' : 'إضافة يدوية'}
                </h3>
                <button onClick={() => setForm(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                {/* عمود الصور */}
                <div className="space-y-4">
                  <div>
                    <label className="text-white text-xs font-bold mb-1.5 block">الكفر (رابط الصورة)</label>
                    <div className="flex gap-3">
                      <div className="w-20 h-28 rounded-lg overflow-hidden bg-stone-900 border border-white/8 shrink-0">
                        {form.poster && <img src={form.poster} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                      </div>
                      <input value={form.poster || ''} onChange={(e) => setF('poster', e.target.value || null)} placeholder="https://..."
                        className="flex-1 h-fit bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-xs py-2.5 px-3 rounded-lg" dir="ltr" />
                    </div>
                  </div>
                  <div>
                    <label className="text-white text-xs font-bold mb-1.5 block">صورة الهيرو (خلفية عريضة)</label>
                    <div className="w-full h-24 rounded-lg overflow-hidden bg-stone-900 border border-white/8 mb-2">
                      {form.backdrop && <img src={form.backdrop} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <input value={form.backdrop || ''} onChange={(e) => setF('backdrop', e.target.value || null)} placeholder="https://..."
                      className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-xs py-2.5 px-3 rounded-lg" dir="ltr" />
                  </div>
                </div>

                {/* عمود الحقول */}
                <div className="space-y-3">
                  <Field label="العنوان" value={form.title} onChange={(v) => setF('title', v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white text-xs font-bold mb-1.5 block">النوع</label>
                      <select value={form.type} onChange={(e) => setF('type', e.target.value as 'movie' | 'tv')}
                        className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                        <option value="movie">فلم</option>
                        <option value="tv">مسلسل</option>
                      </select>
                    </div>
                    <Field label="السنة" value={form.year} onChange={(v) => setF('year', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white text-xs font-bold mb-1.5 flex items-center justify-between">
                        <span>التقييم</span>
                        <label className="flex items-center gap-1 text-[10px] text-gray-400 font-normal cursor-pointer">
                          <input type="checkbox" checked={form.autoRating} disabled={!form.tmdbId} onChange={(e) => setF('autoRating', e.target.checked)} className="accent-red-600" />
                          تلقائي
                        </label>
                      </label>
                      <input type="number" step="0.1" min="0" max="10" value={form.rating} disabled={form.autoRating}
                        onChange={(e) => setF('rating', Number(e.target.value))}
                        className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg disabled:opacity-50" dir="ltr" />
                    </div>
                    <Field label="المخرج" value={form.director} onChange={(v) => setF('director', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="دولة الإنتاج" value={form.country} onChange={(v) => setF('country', v)} />
                    <Field label="اللغة الأصلية" value={form.language} onChange={(v) => setF('language', v)} />
                  </div>
                  <Field label="التصنيفات (افصل بفاصلة)" value={form.genres.join('، ')}
                    onChange={(v) => setF('genres', v.split(/[،,]/).map((s) => s.trim()).filter(Boolean))} />
                </div>
              </div>

              {/* الوصف */}
              <div className="mt-4">
                <label className="text-white text-xs font-bold mb-1.5 block">الوصف</label>
                <textarea value={form.overview} onChange={(e) => setF('overview', e.target.value)} rows={3}
                  className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg resize-none" />
              </div>

              {/* التوزيع */}
              <div className="grid md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                <div>
                  <label className="text-white text-xs font-bold mb-1.5 block">القسم بالصفحة الرئيسية</label>
                  <select value={form.section} onChange={(e) => setF('section', e.target.value)}
                    className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                    {allSections.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-white text-sm font-bold cursor-pointer bg-stone-900 border border-white/10 py-2.5 px-4 rounded-lg w-full">
                    <input type="checkbox" checked={form.inHero} onChange={(e) => setF('inHero', e.target.checked)} className="accent-red-600 w-4 h-4" />
                    يظهر بالكاروسيل الكبير (الهيرو)
                  </label>
                </div>
              </div>

              {/* حفظ */}
              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-8 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  حفظ
                </button>
                <button onClick={() => setForm(null)} className="bg-stone-900 hover:bg-stone-800 text-gray-300 px-6 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ الأقسام ══ */}
      {tab === 'sections' && (
        <div>
          <div className="bg-[#141417] border border-white/8 rounded-2xl p-4 mb-6">
            <label className="text-white text-xs font-bold mb-2 block">إنشاء قسم مخصص جديد</label>
            <div className="flex gap-2">
              <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSection()} placeholder="اسم القسم (مثلاً: أفلام عراقية)"
                className="flex-1 bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-sm font-semibold py-2.5 px-3 rounded-xl transition-all placeholder-gray-600" />
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
                const count = items.filter((m) => m.section === s.key).length;
                return (
                  <div key={s.key} className="flex items-center justify-between bg-[#141417] border border-white/8 rounded-xl px-4 py-3">
                    <div className="text-right">
                      <p className="text-white text-sm font-bold">{s.title}</p>
                      <p className="text-gray-500 text-[11px]">{count} عنصر</p>
                    </div>
                    <button onClick={() => removeCustomSection(s.key)} className="w-9 h-9 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 cursor-pointer transition-all" title="حذف القسم">
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

// حقل نصي بسيط قابل لإعادة الاستخدام
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-white text-xs font-bold mb-1.5 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg transition-all" />
    </div>
  );
}
