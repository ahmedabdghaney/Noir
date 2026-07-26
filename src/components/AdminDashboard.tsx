/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, Plus, Trash2, Eye, EyeOff, FolderPlus, Loader, ArrowRight,
  Edit3, Star, Film, Import, PenLine, X, Upload, GripVertical, Check,
} from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchAdmin, importFromTmdb, TmdbImport, discoverForSection } from '../lib/tmdb';
import { CATEGORIES } from '../lib/categories';
import {
  isAdmin, manualKey, genUid, itemKey,
  ManualItem, CustomSection, HeroExtra,
  subscribeManualItems, subscribeCustomSections, subscribeSectionOrder,
  subscribeHeroExtra, subscribeHeroOrder,
  upsertManualItem, removeManualItem,
  upsertCustomSection, removeCustomSection, setSectionOrder,
  addHeroExtra, removeHeroExtra, setHeroOrder,
} from '../lib/adminStore';

interface SiteSection {
  key: string;
  title: string;
  items: MovieOrShow[];
}

interface AdminDashboardProps {
  userEmail?: string | null;
  onBack: () => void;
  siteSections?: SiteSection[];
  hiddenIds?: string[];
  onToggleHidden?: (type: 'movie' | 'tv', id: number, hide: boolean) => void;
  heroItems?: MovieOrShow[];        // كل عناصر الهيرو الحالية (للعرض والترتيب)
  heroHiddenIds?: string[];
  onToggleHeroHidden?: (type: 'movie' | 'tv', id: number, hide: boolean) => void;
}

// الأقسام الأصلية الثابتة (مفاتيحها + أسماؤها) — تظهر بقائمة الترتيب لكن ما تنعدّل
const NATIVE_SECTIONS: { key: string; title: string }[] = [
  { key: 'trending', title: 'الرائج هذا الأسبوع' },
  { key: 'upcoming', title: 'قريباً' },
  { key: 'nowPlaying', title: 'جديد دور السينما' },
  { key: 'popularTV', title: 'المسلسلات الموصى بها' },
  { key: 'popularMovies', title: 'أفلام شعبية مميزة' },
];

type Tab = 'library' | 'hero' | 'site' | 'add' | 'sections';

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
  introEndSeconds: 0,
  section: 'manual',
  inHero: false,
  addedAt: Date.now(),
});

export default function AdminDashboard({ userEmail, onBack, siteSections = [], hiddenIds = [], onToggleHidden, heroItems = [], heroHiddenIds = [], onToggleHeroHidden }: AdminDashboardProps) {
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
  const [order, setOrderState] = useState<string[]>([]);
  // محرر القسم (null = مغلق). نميّز جديد/تعديل بوجود key
  const [secForm, setSecForm] = useState<Partial<CustomSection> | null>(null);
  const [secPreview, setSecPreview] = useState<MovieOrShow[]>([]);
  const [previewing, setPreviewing] = useState(false);

  // الهيرو: عناصر مضافة + ترتيب + بحث الإضافة
  const [heroExtra, setHeroExtra] = useState<HeroExtra[]>([]);
  const [heroOrder, setHeroOrderState] = useState<string[]>([]);
  const [heroQuery, setHeroQuery] = useState('');
  const [heroResults, setHeroResults] = useState<MovieOrShow[]>([]);
  const [heroSearching, setHeroSearching] = useState(false);

  // محتوى الموقع: بحث TMDB مباشر + فرز
  const [siteQuery, setSiteQuery] = useState('');
  const [siteSort, setSiteSort] = useState<'default' | 'az' | 'year' | 'rating'>('default');
  const [siteResults, setSiteResults] = useState<MovieOrShow[]>([]);
  const [siteSearching, setSiteSearching] = useState(false);

  useEffect(() => {
    const u1 = subscribeManualItems(setItems);
    const u2 = subscribeCustomSections(setSections);
    const u3 = subscribeSectionOrder(setOrderState);
    const u4 = subscribeHeroExtra(setHeroExtra);
    const u5 = subscribeHeroOrder(setHeroOrderState);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  // بحث الهيرو
  useEffect(() => {
    if (!heroQuery.trim()) { setHeroResults([]); return; }
    const t = setTimeout(async () => {
      setHeroSearching(true);
      try { setHeroResults((await searchAdmin(heroQuery.trim())).slice(0, 12)); }
      catch { setHeroResults([]); }
      setHeroSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [heroQuery]);

  // بحث TMDB لمحتوى الموقع (مباشر — مو محصور بالأقسام)
  useEffect(() => {
    if (!siteQuery.trim()) { setSiteResults([]); return; }
    const t = setTimeout(async () => {
      setSiteSearching(true);
      try { setSiteResults((await searchAdmin(siteQuery.trim())).slice(0, 40)); }
      catch { setSiteResults([]); }
      setSiteSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [siteQuery]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults((await searchAdmin(query.trim())).slice(0, 18)); }
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

  // القائمة الموحّدة لكل الأقسام (أصلية + مخصصة) مرتّبة حسب order المحفوظ.
  // الأقسام اللي مو بالـ order تنحط بالنهاية بترتيبها الطبيعي.
  const orderedSections = (() => {
    const native = NATIVE_SECTIONS.map((s) => ({ ...s, custom: false as const }));
    const custom = sections.map((s) => ({ key: s.key, title: s.title, custom: true as const, data: s }));
    const all = [...native, ...custom];
    const idx = (k: string) => {
      const i = order.indexOf(k);
      return i === -1 ? 9999 : i;
    };
    return all.sort((a, b) => idx(a.key) - idx(b.key));
  })();

  // حرّك قسم صعود/نزول ويحفظ الترتيب الجديد
  // ── السحب والإفلات (drag & drop) — مشترك للأقسام والهيرو ──
  // نخزن المفتاح المسحوب، وعند الإفلات نعيد ترتيب المصفوفة ونحفظ
  const dragKey = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // يعيد ترتيب قائمة مفاتيح: ينقل from قبل to
  const reorder = (keys: string[], from: string, to: string): string[] => {
    if (from === to) return keys;
    const arr = [...keys];
    const fi = arr.indexOf(from);
    const ti = arr.indexOf(to);
    if (fi < 0 || ti < 0) return keys;
    arr.splice(fi, 1);
    arr.splice(ti, 0, from);
    return arr;
  };

  // فتح محرر قسم مخصص (جديد أو تعديل)
  const openSectionEditor = (sec?: CustomSection) => {
    setSecPreview([]);
    setSecForm(sec ? { ...sec } : { title: '', kind: 'manual', mediaType: 'movie' });
  };

  const setSF = <K extends keyof CustomSection>(k: K, v: CustomSection[K]) =>
    setSecForm((f) => (f ? { ...f, [k]: v } : f));

  // معاينة نتائج التصنيف+الفلاتر قبل الحفظ
  const previewSection = async () => {
    if (!secForm) return;
    setPreviewing(true);
    const items = await discoverForSection({
      genreId: secForm.genreId,
      mediaType: secForm.mediaType || 'movie',
      minYear: secForm.minYear,
      maxYear: secForm.maxYear,
      minRating: secForm.minRating,
      language: secForm.language,
    });
    setSecPreview(items);
    setPreviewing(false);
  };

  const saveSectionEditor = async () => {
    if (!secForm || !secForm.title?.trim()) return;
    await upsertCustomSection({
      key: secForm.key,
      title: secForm.title,
      kind: secForm.kind || 'manual',
      genreId: secForm.genreId,
      mediaType: secForm.mediaType || 'movie',
      minYear: secForm.minYear,
      maxYear: secForm.maxYear,
      minRating: secForm.minRating,
      language: secForm.language,
    });
    setSecForm(null);
    setSecPreview([]);
  };

  const setF = <K extends keyof ManualItem>(k: K, v: ManualItem[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  // رفع صورة من الجهاز → ضغط وتصغير لأبعاد مناسبة → base64 نخزنه مباشرة.
  // poster: عمودي 500×750، backdrop: عريض 1280×720. الضغط يحافظ على Firestore
  // تحت الحد (وثيقة واحدة لكل العناصر، حد Firestore ~1MB للوثيقة).
  const uploadImage = (file: File, kind: 'poster' | 'backdrop') => {
    const maxW = kind === 'poster' ? 500 : 1280;
    const maxH = kind === 'poster' ? 750 : 720;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // نحافظ على النسبة داخل الحد الأقصى
        let { width, height } = img;
        const ratio = Math.min(maxW / width, maxH / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        // jpeg بجودة 0.82 — توازن جيد بين الحجم والوضوح
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setF(kind, dataUrl);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ── الهيرو ──
  // قائمة الهيرو المرتّبة حسب heroOrder المحفوظ
  const orderedHero = (() => {
    const idx = (k: string) => {
      const i = heroOrder.indexOf(k);
      return i === -1 ? 9999 : i;
    };
    return [...heroItems].sort((a, b) => idx(itemKey(a.type, a.id)) - idx(itemKey(b.type, b.id)));
  })();

  // إفلات قسم على قسم آخر → إعادة ترتيب وحفظ
  const dropSection = async (toKey: string) => {
    const from = dragKey.current;
    dragKey.current = null;
    setDragOver(null);
    if (!from) return;
    const keys = orderedSections.map((s) => s.key);
    const next = reorder(keys, from, toKey);
    setOrderState(next);
    await setSectionOrder(next);
  };

  // إفلات عنصر هيرو على آخر → إعادة ترتيب وحفظ
  const dropHero = async (toKey: string) => {
    const from = dragKey.current;
    dragKey.current = null;
    setDragOver(null);
    if (!from) return;
    const keys = orderedHero.map((h) => itemKey(h.type, h.id));
    const next = reorder(keys, from, toKey);
    setHeroOrderState(next);
    await setHeroOrder(next);
  };

  const addToHero = async (item: MovieOrShow) => {
    await addHeroExtra({
      type: item.type, id: item.id, title: item.title,
      poster: item.poster, backdrop: item.backdrop,
      rating: item.rating, year: item.year, genres: item.genres,
    });
    setHeroQuery('');
    setHeroResults([]);
  };

  const isInHero = (item: MovieOrShow) => heroExtra.some((h) => h.type === item.type && h.id === item.id);

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
        {([['library', 'المكتبة'], ['hero', 'الهيرو'], ['site', 'محتوى الموقع'], ['add', form ? 'تحرير' : 'إضافة'], ['sections', 'الأقسام']] as [Tab, string][]).map(([k, label]) => (
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

      {/* ══ الهيرو (الكاروسيل الكبير) ══ */}
      {tab === 'hero' && (
        <div>
          {/* بحث وإضافة للهيرو */}
          <div className="bg-[#141417] border border-white/8 rounded-2xl p-4 mb-6">
            <label className="text-white text-xs font-bold mb-2 block">أضف فلم أو مسلسل للكاروسيل الكبير</label>
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input value={heroQuery} onChange={(e) => setHeroQuery(e.target.value)} placeholder="دور بـ TMDB..."
                className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-sm font-semibold py-3 pr-12 pl-4 rounded-xl transition-all placeholder-gray-600" />
              {heroSearching && <Loader className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 animate-spin" />}
            </div>
            {heroResults.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                {heroResults.map((item) => {
                  const added = isInHero(item);
                  return (
                    <button key={`${item.type}_${item.id}`} onClick={() => !added && addToHero(item)} disabled={added}
                      className="relative aspect-[2/3] rounded-lg overflow-hidden bg-stone-900 border border-white/[0.06] hover:border-red-500/50 cursor-pointer group transition-all disabled:opacity-50">
                      {item.poster && <img src={item.poster} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                      <div className={`absolute inset-0 flex items-center justify-center transition-all ${added ? 'bg-green-600/40' : 'bg-black/60 opacity-0 group-hover:opacity-100'}`}>
                        {added ? <Check className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-gray-400 text-xs mb-4 leading-relaxed">
            عناصر الكاروسيل الحالية بالترتيب. رتّب بالأسهم، أخفِ بالعين، وعناصرك المضافة تقدر تلغيها بالسلة.
          </p>

          {orderedHero.length === 0 ? (
            <div className="text-center py-16">
              <Loader className="w-8 h-8 text-gray-600 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500 text-sm">جاري التحميل...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orderedHero.map((item, i) => {
                const key = itemKey(item.type, item.id);
                const isHidden = heroHiddenIds.includes(key);
                const isExtra = heroExtra.some((h) => h.type === item.type && h.id === item.id);
                return (
                  <div key={key}
                    draggable
                    onDragStart={() => { dragKey.current = key; }}
                    onDragOver={(e) => { e.preventDefault(); if (dragOver !== key) setDragOver(key); }}
                    onDragEnd={() => { dragKey.current = null; setDragOver(null); }}
                    onDrop={(e) => { e.preventDefault(); dropHero(key); }}
                    className={`flex items-center gap-3 bg-[#141417] border rounded-xl p-2.5 transition-all ${dragOver === key ? 'border-red-500 bg-red-500/5' : 'border-white/8'}`}>
                    {/* مقبض السحب */}
                    <div className="shrink-0 cursor-grab active:cursor-grabbing text-gray-500 hover:text-white px-1" title="اسحب للترتيب">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    {/* صورة مصغرة */}
                    <div className={`w-24 aspect-video rounded-lg overflow-hidden bg-stone-900 shrink-0 ${isHidden ? 'opacity-30 grayscale' : ''}`}>
                      {(item.backdrop || item.poster) && <img src={item.backdrop || item.poster || ''} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    </div>
                    {/* المعلومات */}
                    <div className="flex-1 text-right min-w-0">
                      <p className="text-white text-sm font-bold line-clamp-1">{item.title}</p>
                      <div className="flex items-center gap-2 justify-start mt-0.5">
                        <span className="text-gray-500 text-[11px]">{item.year}</span>
                        {isExtra ? (
                          <span className="bg-red-600/20 text-red-400 text-[9px] font-black px-2 py-0.5 rounded-full">مضاف</span>
                        ) : (
                          <span className="bg-white/5 text-gray-400 text-[9px] font-black px-2 py-0.5 rounded-full">تلقائي</span>
                        )}
                        {isHidden && <span className="text-gray-500 text-[10px]">مخفي</span>}
                      </div>
                    </div>
                    {/* أزرار */}
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => onToggleHeroHidden?.(item.type, item.id, !isHidden)}
                        className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 cursor-pointer"
                        title={isHidden ? 'إظهار' : 'إخفاء'}>
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {isExtra && (
                        <button onClick={() => removeHeroExtra(item.type, item.id)}
                          className="w-9 h-9 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 cursor-pointer" title="إلغاء من الهيرو">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ محتوى الموقع — بحث TMDB مباشر + فرز ══ */}
      {tab === 'site' && (
        <div>
          <p className="text-gray-400 text-xs mb-4 leading-relaxed">
            دور عن أي فلم أو مسلسل بـ TMDB (مو محصور بأقسام الرئيسية) وأخفِه من الموقع. بدون بحث تشوف محتوى الرئيسية.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input value={siteQuery} onChange={(e) => setSiteQuery(e.target.value)} placeholder="دور عن أي فلم أو مسلسل..."
                className="w-full bg-[#141417] border border-white/10 focus:border-red-500/60 outline-none text-white text-sm font-semibold py-2.5 pr-12 pl-4 rounded-xl transition-all placeholder-gray-600" />
              {siteSearching && <Loader className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 animate-spin" />}
            </div>
            <select value={siteSort} onChange={(e) => setSiteSort(e.target.value as any)}
              className="bg-[#141417] border border-white/10 text-white text-sm font-semibold py-2.5 px-4 rounded-xl outline-none cursor-pointer">
              <option value="default">الترتيب الافتراضي</option>
              <option value="az">أبجدي (أ-ي)</option>
              <option value="year">الأحدث سنة</option>
              <option value="rating">الأعلى تقييم</option>
            </select>
          </div>

          {(() => {
            const searching = siteQuery.trim() !== '';

            // مع بحث: نتائج TMDB المباشرة (مع فرز)
            if (searching) {
              let list = [...siteResults];
              if (siteSort === 'az') list.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
              else if (siteSort === 'year') list.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
              else if (siteSort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));

              if (siteSearching && list.length === 0) {
                return <div className="text-center py-16"><Loader className="w-8 h-8 text-gray-600 mx-auto animate-spin" /></div>;
              }
              if (list.length === 0) {
                return <p className="text-gray-600 text-sm text-center py-12">ما في نتائج</p>;
              }
              return (
                <div>
                  <p className="text-gray-500 text-xs mb-3">{list.length} نتيجة</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {list.map((item) => {
                      const key = itemKey(item.type, item.id);
                      const isHidden = hiddenIds.includes(key);
                      return (
                        <div key={key} className="relative">
                          <div className={`relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/[0.06] transition-all ${isHidden ? 'opacity-30 grayscale' : ''}`}>
                            {item.poster && <img src={item.poster} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                            <button onClick={() => onToggleHidden?.(item.type, item.id, !isHidden)}
                              className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full glass flex items-center justify-center text-white cursor-pointer hover:bg-white/25 transition-all"
                              title={isHidden ? 'إظهار' : 'إخفاء'}>
                              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <p className="text-white text-[10px] font-semibold mt-1 line-clamp-1 text-right">{item.title}</p>
                          <p className="text-gray-500 text-[9px] text-right">{item.year} · {item.type === 'tv' ? 'مسلسل' : 'فلم'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // بدون بحث: محتوى الرئيسية بالأقسام
            if (siteSections.every((s) => s.items.length === 0)) {
              return <div className="text-center py-20"><Loader className="w-8 h-8 text-gray-600 mx-auto mb-3 animate-spin" /><p className="text-gray-500 text-sm">جاري التحميل...</p></div>;
            }
            return siteSections.map((sec) => (
              sec.items.length > 0 && (
                <div key={sec.key} className="mb-8">
                  <h3 className="text-white text-sm font-black mb-3">{sec.title}</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {sec.items.map((item) => {
                      const key = itemKey(item.type, item.id);
                      const isHidden = hiddenIds.includes(key);
                      return (
                        <div key={key} className="relative">
                          <div className={`relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/[0.06] transition-all ${isHidden ? 'opacity-30 grayscale' : ''}`}>
                            {item.poster && <img src={item.poster} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                            <button onClick={() => onToggleHidden?.(item.type, item.id, !isHidden)}
                              className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full glass flex items-center justify-center text-white cursor-pointer hover:bg-white/25 transition-all"
                              title={isHidden ? 'إظهار' : 'إخفاء'}>
                              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <p className="text-white text-[10px] font-semibold mt-1 line-clamp-1 text-right">{item.title}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ));
          })()}
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
                    <label className="text-white text-xs font-bold mb-1.5 block">الكفر (بوستر عمودي)</label>
                    <div className="flex gap-3">
                      <div className="w-20 h-28 rounded-lg overflow-hidden bg-stone-900 border border-white/8 shrink-0">
                        {form.poster && <img src={form.poster} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input value={form.poster?.startsWith('data:') ? '' : (form.poster || '')} onChange={(e) => setF('poster', e.target.value || null)} placeholder="الصق رابط الصورة https://..."
                          className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-xs py-2.5 px-3 rounded-lg" dir="ltr" />
                        <label className="flex items-center justify-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-white/10 text-white text-xs font-bold py-2 rounded-lg cursor-pointer transition-all">
                          <Upload className="w-3.5 h-3.5" /> رفع من الجهاز
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'poster'); e.target.value = ''; }} />
                        </label>
                        <p className="text-gray-500 text-[10px] leading-relaxed">المقاس المثالي 500×750 (نسبة 2:3). أي حجم يشتغل — تنضغط تلقائياً.</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-white text-xs font-bold mb-1.5 block">صورة الهيرو (خلفية عريضة)</label>
                    <div className="w-full h-24 rounded-lg overflow-hidden bg-stone-900 border border-white/8 mb-2">
                      {form.backdrop && <img src={form.backdrop} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <input value={form.backdrop?.startsWith('data:') ? '' : (form.backdrop || '')} onChange={(e) => setF('backdrop', e.target.value || null)} placeholder="الصق رابط الصورة https://..."
                      className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-xs py-2.5 px-3 rounded-lg mb-2" dir="ltr" />
                    <label className="flex items-center justify-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-white/10 text-white text-xs font-bold py-2 rounded-lg cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" /> رفع من الجهاز
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'backdrop'); e.target.value = ''; }} />
                    </label>
                    <p className="text-gray-500 text-[10px] leading-relaxed mt-1.5">المقاس المثالي 1280×720 (نسبة 16:9). أي حجم يشتغل — تنضغط تلقائياً.</p>
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
                  <div>
                    <label className="text-white text-xs font-bold mb-1.5 block">
                      نهاية المقدمة بالثواني
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.introEndSeconds || 0}
                      onChange={(e) => setF('introEndSeconds', Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg"
                      dir="ltr"
                    />
                    <p className="mt-1 text-[10px] text-white/35">
                      اكتب 0 لإخفاء زر تخطي المقدمة.
                    </p>
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
          {/* المحرر (يطفو فوق القائمة لما يكون مفتوح) */}
          {secForm ? (
            <div className="bg-[#141417] border border-white/8 rounded-2xl p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black text-lg">{secForm.key ? 'تعديل قسم' : 'قسم جديد'}</h3>
                <button onClick={() => { setSecForm(null); setSecPreview([]); }} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <Field label="اسم القسم" value={secForm.title || ''} onChange={(v) => setSF('title', v)} />

                {/* نوع القسم */}
                <div>
                  <label className="text-white text-xs font-bold mb-2 block">طريقة التعبئة</label>
                  <div className="flex gap-2">
                    <button onClick={() => setSF('kind', 'manual')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${(secForm.kind || 'manual') === 'manual' ? 'bg-red-600 text-white' : 'bg-stone-900 text-gray-400 hover:text-white'}`}>
                      <PenLine className="w-3.5 h-3.5" /> يدوي
                    </button>
                    <button onClick={() => setSF('kind', 'genre')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${secForm.kind === 'genre' ? 'bg-red-600 text-white' : 'bg-stone-900 text-gray-400 hover:text-white'}`}>
                      <Film className="w-3.5 h-3.5" /> تصنيف تلقائي
                    </button>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-1.5 leading-relaxed">
                    {secForm.kind === 'genre'
                      ? 'يتعبّى تلقائياً من TMDB حسب التصنيف والفلاتر، وتقدر تضيف عناصر يدوية فوقه من تبويب الإضافة.'
                      : 'تضيف الأفلام والمسلسلات يدوياً من تبويب الإضافة.'}
                  </p>
                </div>

                {/* حقول التصنيف — بس لو النوع genre */}
                {secForm.kind === 'genre' && (
                  <div className="bg-stone-900/50 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-white text-xs font-bold mb-1.5 block">النوع</label>
                        <select value={secForm.mediaType || 'movie'} onChange={(e) => setSF('mediaType', e.target.value as 'movie' | 'tv')}
                          className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                          <option value="movie">أفلام</option>
                          <option value="tv">مسلسلات</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-white text-xs font-bold mb-1.5 block">التصنيف</label>
                        <select value={secForm.genreId || ''} onChange={(e) => setSF('genreId', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                          <option value="">اختر تصنيف</option>
                          {CATEGORIES.map((c) => <option key={c.key} value={c.primaryGenre}>{c.title}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <NumField label="من سنة" value={secForm.minYear} onChange={(v) => setSF('minYear', v)} placeholder="1990" />
                      <NumField label="إلى سنة" value={secForm.maxYear} onChange={(v) => setSF('maxYear', v)} placeholder="2026" />
                      <NumField label="أقل تقييم" value={secForm.minRating} onChange={(v) => setSF('minRating', v)} placeholder="7" step="0.1" />
                    </div>
                    <div>
                      <label className="text-white text-xs font-bold mb-1.5 block">اللغة الأصلية (اختياري)</label>
                      <select value={secForm.language || ''} onChange={(e) => setSF('language', e.target.value || undefined)}
                        className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                        <option value="">الكل</option>
                        <option value="ar">العربية</option>
                        <option value="en">الإنجليزية</option>
                        <option value="tr">التركية</option>
                        <option value="ko">الكورية</option>
                        <option value="ja">اليابانية</option>
                        <option value="hi">الهندية</option>
                        <option value="fr">الفرنسية</option>
                        <option value="es">الإسبانية</option>
                      </select>
                    </div>

                    <button onClick={previewSection} disabled={previewing || !secForm.genreId}
                      className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all">
                      {previewing ? <Loader className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} معاينة النتائج
                    </button>

                    {secPreview.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-2">
                        {secPreview.slice(0, 12).map((it) => (
                          <div key={`${it.type}_${it.id}`} className="aspect-[2/3] rounded-md overflow-hidden bg-stone-900">
                            {it.poster && <img src={it.poster} alt={it.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={saveSectionEditor} disabled={!secForm.title?.trim() || (secForm.kind === 'genre' && !secForm.genreId)}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-8 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">
                    <Plus className="w-4 h-4" /> حفظ
                  </button>
                  <button onClick={() => { setSecForm(null); setSecPreview([]); }} className="bg-stone-900 hover:bg-stone-800 text-gray-300 px-6 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">إلغاء</button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-gray-400 text-xs leading-relaxed max-w-md">كل أقسام الصفحة الرئيسية. رتّبها بالأسهم، عدّل المخصصة، والأصلية معلّمة "أصلي" وثابتة.</p>
                <button onClick={() => openSectionEditor()} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0">
                  <FolderPlus className="w-4 h-4" /> قسم جديد
                </button>
              </div>

              <div className="space-y-2">
                {orderedSections.map((s, i) => {
                  const count = s.custom ? items.filter((m) => m.section === s.key).length : null;
                  const isGenre = s.custom && (s as any).data?.kind === 'genre';
                  return (
                    <div key={s.key}
                      draggable
                      onDragStart={() => { dragKey.current = s.key; }}
                      onDragOver={(e) => { e.preventDefault(); if (dragOver !== s.key) setDragOver(s.key); }}
                      onDragEnd={() => { dragKey.current = null; setDragOver(null); }}
                      onDrop={(e) => { e.preventDefault(); dropSection(s.key); }}
                      className={`flex items-center gap-3 bg-[#141417] border rounded-xl px-3 py-3 transition-all ${dragOver === s.key ? 'border-red-500 bg-red-500/5' : 'border-white/8'}`}>
                      {/* مقبض السحب */}
                      <div className="shrink-0 cursor-grab active:cursor-grabbing text-gray-500 hover:text-white px-1" title="اسحب للترتيب">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      {/* المعلومات */}
                      <div className="flex-1 text-right">
                        <div className="flex items-center gap-2 justify-start">
                          <p className="text-white text-sm font-bold">{s.title}</p>
                          {s.custom ? (
                            <span className="bg-red-600/20 text-red-400 text-[9px] font-black px-2 py-0.5 rounded-full">مضاف من قبلك</span>
                          ) : (
                            <span className="bg-white/5 text-gray-400 text-[9px] font-black px-2 py-0.5 rounded-full">أصلي</span>
                          )}
                          {isGenre && <span className="bg-blue-600/20 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-full">تصنيف تلقائي</span>}
                        </div>
                        {s.custom && <p className="text-gray-500 text-[11px] mt-0.5">{isGenre ? 'يتعبّى تلقائياً' : `${count} عنصر يدوي`}</p>}
                      </div>

                      {/* أزرار التعديل/الحذف — بس للمخصصة */}
                      {s.custom && (
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => openSectionEditor((s as any).data)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 cursor-pointer" title="تعديل">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeCustomSection(s.key)} className="w-9 h-9 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 cursor-pointer" title="حذف">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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

// حقل رقمي (للفلاتر: سنة، تقييم)
function NumField({ label, value, onChange, placeholder, step }: { label: string; value?: number; onChange: (v: number | undefined) => void; placeholder?: string; step?: string }) {
  return (
    <div>
      <label className="text-white text-xs font-bold mb-1.5 block">{label}</label>
      <input type="number" step={step} value={value ?? ''} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="w-full bg-stone-900 border border-white/10 focus:border-red-500/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg transition-all placeholder-gray-600" dir="ltr" />
    </div>
  );
}
