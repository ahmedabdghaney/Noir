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
import OwnMediaAdmin from './OwnMediaAdmin';

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
  heroItems?: MovieOrShow[];        // كل عناصر Hero الحالية (للعرض والترتيب)
  heroHiddenIds?: string[];
  onToggleHeroHidden?: (type: 'movie' | 'tv', id: number, hide: boolean) => void;
}

// Sections الOriginalة الثابتة (مفاتيحها + أسماؤها) — تظهر بقائمة الترتيب لكن ما تنعدّل
const NATIVE_SECTIONS: { key: string; title: string }[] = [
  { key: 'trending', title: 'Trending This Week' },
  { key: 'upcoming', title: 'Coming Soon' },
  { key: 'nowPlaying', title: 'New in Theaters' },
  { key: 'popularTV', title: 'Recommended Shows' },
  { key: 'popularMovies', title: 'Popular Movies' },
];

type Tab = 'library' | 'hero' | 'site' | 'add' | 'sections' | 'files';

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
  // محرر القسم (null = مغلق). نميّز جديد/Edit بوجود key
  const [secForm, setSecForm] = useState<Partial<CustomSection> | null>(null);
  const [secPreview, setSecPreview] = useState<MovieOrShow[]>([]);
  const [previewing, setPreviewing] = useState(false);

  // Hero: عناصر Addedة + ترتيب + بحث الإضافة
  const [heroExtra, setHeroExtra] = useState<HeroExtra[]>([]);
  const [heroOrder, setHeroOrderState] = useState<string[]>([]);
  const [heroQuery, setHeroQuery] = useState('');
  const [heroResults, setHeroResults] = useState<MovieOrShow[]>([]);
  const [heroSearching, setHeroSearching] = useState(false);

  // Site content: بحث TMDB مباشر + فرز
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

  // بحث Hero
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

  // بحث TMDB لSite content (مباشر — مو محصور بSections)
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
    { key: 'manual', title: 'Noir Exclusive' },
    ...CATEGORIES.map((c) => ({ key: c.key, title: c.title })),
    ...sections.map((s) => ({ key: s.key, title: s.title })),
  ];
  const sectionTitle = (key: string) => allSections.find((s) => s.key === key)?.title || key;

  // ── إجراءات ──

  // Import from TMDB → يملأ الفورم بكل الحقول ويفتحه للEdit
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
      autoRating: true,       // افتراضياً Rating يتحدث Autoاً للمستورد
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

  // القائمة الموحّدة لكل Sections (Originalة + مخصصة) مرتّبة حسب order المحفوظ.
  // Sections اللي مو بالـ order تنحط بالنهاية بترتيبها الطبيعي.
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

  // حرّك قسم صعود/نزول ويSave الترتيب الجديد
  // ── السحب والإفلات (drag & drop) — مشترك للأقسام وHero ──
  // نخزن المفتاح المسحوب، وعند الإفلات نعيد ترتيب المصفوفة ونSave
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

  // فتح محرر قسم مخصص (جديد أو Edit)
  const openSectionEditor = (sec?: CustomSection) => {
    setSecPreview([]);
    setSecForm(sec ? { ...sec } : { title: '', kind: 'manual', mediaType: 'movie' });
  };

  const setSF = <K extends keyof CustomSection>(k: K, v: CustomSection[K]) =>
    setSecForm((f) => (f ? { ...f, [k]: v } : f));

  // Preview نتائج Genre+الفلاتر قبل الSave
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

  // ── Hero ──
  // قائمة Hero المرتّبة حسب heroOrder المحفوظ
  const orderedHero = (() => {
    const idx = (k: string) => {
      const i = heroOrder.indexOf(k);
      return i === -1 ? 9999 : i;
    };
    return [...heroItems].sort((a, b) => idx(itemKey(a.type, a.id)) - idx(itemKey(b.type, b.id)));
  })();

  // إفلات قسم على قسم آخر → إعادة ترتيب وSave
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

  // إفلات عنصر Hero على آخر → إعادة ترتيب وSave
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
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-6" dir="ltr">
        <div className="w-16 h-16 rounded-full bg-[#A0C9CB]/10 flex items-center justify-center">
          <EyeOff className="w-8 h-8 text-[#A0C9CB]" />
        </div>
        <h2 className="text-xl font-black text-white">Not authorized</h2>
        <p className="text-gray-400 text-sm">This page is for admins only</p>
        <button onClick={onBack} className="mt-2 flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 rounded-full text-sm font-bold cursor-pointer transition-all">
          <ArrowRight className="w-4 h-4" /> Back to site
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 animate-fade-in" dir="ltr">
      {/* رأس */}
      <div className="flex items-center justify-between mb-8">
        <div className="text-left">
          <h1 className="font-display text-2xl md:text-3xl font-black text-white">Noir Control Panel</h1>
          <p className="text-gray-500 text-xs mt-1 font-semibold">{userEmail}</p>
        </div>
        <button onClick={onBack} className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 border border-white/5 text-white px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer transition-all">
          <ArrowRight className="w-4 h-4" /> Site
        </button>
      </div>

      {/* تبويبات */}
      <div className="flex gap-2 mb-8 border-b border-white/5 pb-3 overflow-x-auto no-scrollbar">
        {([['library', 'Library'], ['hero', 'Hero'], ['site', 'Site content'], ['add', form ? 'Edit' : 'Add'], ['sections', 'Sections'], ['files', 'Video files']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition-all ${tab === k ? 'bg-[#A0C9CB] text-white' : 'bg-stone-900 text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ Library ══ */}
      {tab === 'library' && (
        <div>
          <div className="flex gap-2 mb-6">
            <button onClick={handleManualNew} className="flex items-center gap-2 bg-[#A0C9CB] hover:bg-[#A0C9CB] text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all">
              <PenLine className="w-4 h-4" /> Add manually
            </button>
            <button onClick={() => { setForm(null); setTab('add'); }} className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 border border-white/8 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all">
              <Import className="w-4 h-4" /> Import from TMDB
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-20">
              <Film className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No content added yet. Start by adding manually or importing from TMDB.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((it) => (
                <div key={manualKey(it)} className="bg-[#141417] border border-white/8 rounded-2xl overflow-hidden group">
                  <div className="relative aspect-[2/3] bg-stone-900">
                    {it.poster && <img src={it.poster} alt={it.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    {it.inHero && (
                      <span className="absolute top-2 right-2 bg-[#A0C9CB] text-white text-[9px] font-black px-2 py-0.5 rounded-full">Hero</span>
                    )}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(it)} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(it)} className="w-10 h-10 rounded-full bg-[#A0C9CB]/30 hover:bg-[#A0C9CB]/50 flex items-center justify-center text-white cursor-pointer" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 text-left">
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

      {/* ══ Hero (الكاروسيل الكبير) ══ */}
      {tab === 'hero' && (
        <div>
          {/* بحث وإضافة للHero */}
          <div className="bg-[#141417] border border-white/8 rounded-2xl p-4 mb-6">
            <label className="text-white text-xs font-bold mb-2 block">Add a movie or show to the main carousel</label>
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input value={heroQuery} onChange={(e) => setHeroQuery(e.target.value)} placeholder="Search TMDB..."
                className="w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-sm font-semibold py-3 pr-12 pl-4 rounded-xl transition-all placeholder-gray-600" />
              {heroSearching && <Loader className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0C9CB] animate-spin" />}
            </div>
            {heroResults.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                {heroResults.map((item) => {
                  const added = isInHero(item);
                  return (
                    <button key={`${item.type}_${item.id}`} onClick={() => !added && addToHero(item)} disabled={added}
                      className="relative aspect-[2/3] rounded-lg overflow-hidden bg-stone-900 border border-white/[0.06] hover:border-[#A0C9CB]/50 cursor-pointer group transition-all disabled:opacity-50">
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
            Current carousel items in order. Reorder with the arrows, hide with the eye, and remove the ones you added with the trash.
          </p>

          {orderedHero.length === 0 ? (
            <div className="text-center py-16">
              <Loader className="w-8 h-8 text-gray-600 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500 text-sm">Loading...</p>
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
                    className={`flex items-center gap-3 bg-[#141417] border rounded-xl p-2.5 transition-all ${dragOver === key ? 'border-[#A0C9CB] bg-[#A0C9CB]/5' : 'border-white/8'}`}>
                    {/* مقبض السحب */}
                    <div className="shrink-0 cursor-grab active:cursor-grabbing text-gray-500 hover:text-white px-1" title="Drag to reorder">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    {/* صورة مصغرة */}
                    <div className={`w-24 aspect-video rounded-lg overflow-hidden bg-stone-900 shrink-0 ${isHidden ? 'opacity-30 grayscale' : ''}`}>
                      {(item.backdrop || item.poster) && <img src={item.backdrop || item.poster || ''} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    </div>
                    {/* المعلومات */}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white text-sm font-bold line-clamp-1">{item.title}</p>
                      <div className="flex items-center gap-2 justify-start mt-0.5">
                        <span className="text-gray-500 text-[11px]">{item.year}</span>
                        {isExtra ? (
                          <span className="bg-[#A0C9CB]/20 text-[#A0C9CB] text-[9px] font-black px-2 py-0.5 rounded-full">Added</span>
                        ) : (
                          <span className="bg-white/5 text-gray-400 text-[9px] font-black px-2 py-0.5 rounded-full">Auto</span>
                        )}
                        {isHidden && <span className="text-gray-500 text-[10px]">Hidden</span>}
                      </div>
                    </div>
                    {/* أزرار */}
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => onToggleHeroHidden?.(item.type, item.id, !isHidden)}
                        className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 cursor-pointer"
                        title={isHidden ? 'Show' : 'Hide'}>
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {isExtra && (
                        <button onClick={() => removeHeroExtra(item.type, item.id)}
                          className="w-9 h-9 rounded-full bg-[#A0C9CB]/10 hover:bg-[#A0C9CB]/20 flex items-center justify-center text-[#A0C9CB] cursor-pointer" title="Remove from hero">
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

      {/* ══ Site content — بحث TMDB مباشر + فرز ══ */}
      {tab === 'site' && (
        <div>
          <p className="text-gray-400 text-xs mb-4 leading-relaxed">
            Search any movie or show on TMDB (not limited to home sections) and hide it from the site. With no search you see the home content.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input value={siteQuery} onChange={(e) => setSiteQuery(e.target.value)} placeholder="Search any movie or show..."
                className="w-full bg-[#141417] border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-sm font-semibold py-2.5 pr-12 pl-4 rounded-xl transition-all placeholder-gray-600" />
              {siteSearching && <Loader className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0C9CB] animate-spin" />}
            </div>
            <select value={siteSort} onChange={(e) => setSiteSort(e.target.value as any)}
              className="bg-[#141417] border border-white/10 text-white text-sm font-semibold py-2.5 px-4 rounded-xl outline-none cursor-pointer">
              <option value="default">Default order</option>
              <option value="az">Alphabetical (A-Z)</option>
              <option value="year">Newest year</option>
              <option value="rating">Top rated</option>
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
                return <p className="text-gray-600 text-sm text-center py-12">No results</p>;
              }
              return (
                <div>
                  <p className="text-gray-500 text-xs mb-3">{list.length} results</p>
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
                              title={isHidden ? 'Show' : 'Hide'}>
                              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <p className="text-white text-[10px] font-semibold mt-1 line-clamp-1 text-left">{item.title}</p>
                          <p className="text-gray-500 text-[9px] text-left">{item.year} · {item.type === 'tv' ? 'TV Show' : 'Movie'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // بدون بحث: محتوى الرئيسية بSections
            if (siteSections.every((s) => s.items.length === 0)) {
              return <div className="text-center py-20"><Loader className="w-8 h-8 text-gray-600 mx-auto mb-3 animate-spin" /><p className="text-gray-500 text-sm">Loading...</p></div>;
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
                              title={isHidden ? 'Show' : 'Hide'}>
                              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <p className="text-white text-[10px] font-semibold mt-1 line-clamp-1 text-left">{item.title}</p>
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
              <p className="text-gray-400 text-xs mb-4">Search a movie or show to import all its details from TMDB, or <button onClick={handleManualNew} className="text-[#A0C9CB] underline cursor-pointer">add manually</button>.</p>
              <div className="relative mb-5">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Movie or show name..."
                  className="w-full bg-[#141417] border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-sm font-semibold py-3.5 pr-12 pl-4 rounded-xl transition-all placeholder-gray-600" />
                {searching && <Loader className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0C9CB] animate-spin" />}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {results.map((item) => (
                  <button key={`${item.type}_${item.id}`} onClick={() => handleImport(item)} disabled={importing === item.id}
                    className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/[0.06] hover:border-[#A0C9CB]/50 cursor-pointer group transition-all">
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
                  {form.tmdbId ? <Import className="w-5 h-5 text-[#A0C9CB]" /> : <PenLine className="w-5 h-5 text-[#A0C9CB]" />}
                  {form.tmdbId ? 'Imported from TMDB' : 'Manual entry'}
                </h3>
                <button onClick={() => setForm(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                {/* عمود الصور */}
                <div className="space-y-4">
                  <div>
                    <label className="text-white text-xs font-bold mb-1.5 block">Poster (vertical)</label>
                    <div className="flex gap-3">
                      <div className="w-20 h-28 rounded-lg overflow-hidden bg-stone-900 border border-white/8 shrink-0">
                        {form.poster && <img src={form.poster} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input value={form.poster?.startsWith('data:') ? '' : (form.poster || '')} onChange={(e) => setF('poster', e.target.value || null)} placeholder="Paste image URL https://..."
                          className="w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-xs py-2.5 px-3 rounded-lg" dir="ltr" />
                        <label className="flex items-center justify-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-white/10 text-white text-xs font-bold py-2 rounded-lg cursor-pointer transition-all">
                          <Upload className="w-3.5 h-3.5" /> Upload from device
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'poster'); e.target.value = ''; }} />
                        </label>
                        <p className="text-gray-500 text-[10px] leading-relaxed">Ideal size 500×750 (2:3 ratio). Any size works — auto-compressed.</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-white text-xs font-bold mb-1.5 block">Hero image (wide backdrop)</label>
                    <div className="w-full h-24 rounded-lg overflow-hidden bg-stone-900 border border-white/8 mb-2">
                      {form.backdrop && <img src={form.backdrop} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <input value={form.backdrop?.startsWith('data:') ? '' : (form.backdrop || '')} onChange={(e) => setF('backdrop', e.target.value || null)} placeholder="Paste image URL https://..."
                      className="w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-xs py-2.5 px-3 rounded-lg mb-2" dir="ltr" />
                    <label className="flex items-center justify-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-white/10 text-white text-xs font-bold py-2 rounded-lg cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" /> Upload from device
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'backdrop'); e.target.value = ''; }} />
                    </label>
                    <p className="text-gray-500 text-[10px] leading-relaxed mt-1.5">Ideal size 1280×720 (16:9 ratio). Any size works — auto-compressed.</p>
                  </div>
                </div>

                {/* عمود الحقول */}
                <div className="space-y-3">
                  <Field label="Title" value={form.title} onChange={(v) => setF('title', v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white text-xs font-bold mb-1.5 block">Type</label>
                      <select value={form.type} onChange={(e) => setF('type', e.target.value as 'movie' | 'tv')}
                        className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                        <option value="movie">Movie</option>
                        <option value="tv">TV Show</option>
                      </select>
                    </div>
                    <Field label="Year" value={form.year} onChange={(v) => setF('year', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white text-xs font-bold mb-1.5 flex items-center justify-between">
                        <span>Rating</span>
                        <label className="flex items-center gap-1 text-[10px] text-gray-400 font-normal cursor-pointer">
                          <input type="checkbox" checked={form.autoRating} disabled={!form.tmdbId} onChange={(e) => setF('autoRating', e.target.checked)} className="accent-[#A0C9CB]" />
                          Auto
                        </label>
                      </label>
                      <input type="number" step="0.1" min="0" max="10" value={form.rating} disabled={form.autoRating}
                        onChange={(e) => setF('rating', Number(e.target.value))}
                        className="w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg disabled:opacity-50" dir="ltr" />
                    </div>
                    <Field label="Director" value={form.director} onChange={(v) => setF('director', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Country" value={form.country} onChange={(v) => setF('country', v)} />
                    <Field label="Original language" value={form.language} onChange={(v) => setF('language', v)} />
                  </div>
                  <div>
                    <label className="text-white text-xs font-bold mb-1.5 block">
                      Intro end (seconds)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.introEndSeconds || 0}
                      onChange={(e) => setF('introEndSeconds', Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg"
                      dir="ltr"
                    />
                    <p className="mt-1 text-[10px] text-white/35">
                      Enter 0 to hide the skip-intro button.
                    </p>
                  </div>
                  <Field label="Genres (comma-separated)" value={form.genres.join(', ')}
                    onChange={(v) => setF('genres', v.split(/[،,]/).map((s) => s.trim()).filter(Boolean))} />
                </div>
              </div>

              {/* Description */}
              <div className="mt-4">
                <label className="text-white text-xs font-bold mb-1.5 block">Description</label>
                <textarea value={form.overview} onChange={(e) => setF('overview', e.target.value)} rows={3}
                  className="w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg resize-none" />
              </div>

              {/* التوزيع */}
              <div className="grid md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                <div>
                  <label className="text-white text-xs font-bold mb-1.5 block">Home section</label>
                  <select value={form.section} onChange={(e) => setF('section', e.target.value)}
                    className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                    {allSections.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-white text-sm font-bold cursor-pointer bg-stone-900 border border-white/10 py-2.5 px-4 rounded-lg w-full">
                    <input type="checkbox" checked={form.inHero} onChange={(e) => setF('inHero', e.target.checked)} className="accent-[#A0C9CB] w-4 h-4" />
                    Show in the main carousel (hero)
                  </label>
                </div>
              </div>

              {/* Save */}
              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  className="flex items-center gap-2 bg-[#A0C9CB] hover:bg-[#A0C9CB] disabled:opacity-40 text-white px-8 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save
                </button>
                <button onClick={() => setForm(null)} className="bg-stone-900 hover:bg-stone-800 text-gray-300 px-6 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Sections ══ */}
      {/* ══ Video files ══ */}
      {tab === 'files' && <OwnMediaAdmin />}

      {tab === 'sections' && (
        <div>
          {/* المحرر (يطفو فوق القائمة لما يكون مفتوح) */}
          {secForm ? (
            <div className="bg-[#141417] border border-white/8 rounded-2xl p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black text-lg">{secForm.key ? 'Edit section' : 'New section'}</h3>
                <button onClick={() => { setSecForm(null); setSecPreview([]); }} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <Field label="Section name" value={secForm.title || ''} onChange={(v) => setSF('title', v)} />

                {/* نوع القسم */}
                <div>
                  <label className="text-white text-xs font-bold mb-2 block">Fill method</label>
                  <div className="flex gap-2">
                    <button onClick={() => setSF('kind', 'manual')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${(secForm.kind || 'manual') === 'manual' ? 'bg-[#A0C9CB] text-white' : 'bg-stone-900 text-gray-400 hover:text-white'}`}>
                      <PenLine className="w-3.5 h-3.5" /> Manual
                    </button>
                    <button onClick={() => setSF('kind', 'genre')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${secForm.kind === 'genre' ? 'bg-[#A0C9CB] text-white' : 'bg-stone-900 text-gray-400 hover:text-white'}`}>
                      <Film className="w-3.5 h-3.5" /> Auto genre
                    </button>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-1.5 leading-relaxed">
                    {secForm.kind === 'genre'
                      ? 'Filled automatically from TMDB by genre and filters; you can add manual items on top from the Add tab.'
                      : 'Add movies and shows manually from the Add tab.'}
                  </p>
                </div>

                {/* حقول Genre — بس لو Type genre */}
                {secForm.kind === 'genre' && (
                  <div className="bg-stone-900/50 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-white text-xs font-bold mb-1.5 block">Type</label>
                        <select value={secForm.mediaType || 'movie'} onChange={(e) => setSF('mediaType', e.target.value as 'movie' | 'tv')}
                          className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                          <option value="movie">Movies</option>
                          <option value="tv">TV Shows</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-white text-xs font-bold mb-1.5 block">Genre</label>
                        <select value={secForm.genreId || ''} onChange={(e) => setSF('genreId', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                          <option value="">Choose a genre</option>
                          {CATEGORIES.map((c) => <option key={c.key} value={c.primaryGenre}>{c.title}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <NumField label="From year" value={secForm.minYear} onChange={(v) => setSF('minYear', v)} placeholder="1990" />
                      <NumField label="To year" value={secForm.maxYear} onChange={(v) => setSF('maxYear', v)} placeholder="2026" />
                      <NumField label="Min rating" value={secForm.minRating} onChange={(v) => setSF('minRating', v)} placeholder="7" step="0.1" />
                    </div>
                    <div>
                      <label className="text-white text-xs font-bold mb-1.5 block">Original language (optional)</label>
                      <select value={secForm.language || ''} onChange={(e) => setSF('language', e.target.value || undefined)}
                        className="w-full bg-stone-900 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg outline-none cursor-pointer">
                        <option value="">All</option>
                        <option value="ar">Arabic</option>
                        <option value="en">English</option>
                        <option value="tr">Turkish</option>
                        <option value="ko">Korean</option>
                        <option value="ja">Japanese</option>
                        <option value="hi">Hindi</option>
                        <option value="fr">French</option>
                        <option value="es">Spanish</option>
                      </select>
                    </div>

                    <button onClick={previewSection} disabled={previewing || !secForm.genreId}
                      className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all">
                      {previewing ? <Loader className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview results
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
                    className="flex items-center gap-2 bg-[#A0C9CB] hover:bg-[#A0C9CB] disabled:opacity-40 text-white px-8 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">
                    <Plus className="w-4 h-4" /> Save
                  </button>
                  <button onClick={() => { setSecForm(null); setSecPreview([]); }} className="bg-stone-900 hover:bg-stone-800 text-gray-300 px-6 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">Cancel</button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-gray-400 text-xs leading-relaxed max-w-md">All home sections. Reorder with the arrows, edit custom ones; originals are marked "Original" and fixed.</p>
                <button onClick={() => openSectionEditor()} className="flex items-center gap-1.5 bg-[#A0C9CB] hover:bg-[#A0C9CB] text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0">
                  <FolderPlus className="w-4 h-4" /> New section
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
                      className={`flex items-center gap-3 bg-[#141417] border rounded-xl px-3 py-3 transition-all ${dragOver === s.key ? 'border-[#A0C9CB] bg-[#A0C9CB]/5' : 'border-white/8'}`}>
                      {/* مقبض السحب */}
                      <div className="shrink-0 cursor-grab active:cursor-grabbing text-gray-500 hover:text-white px-1" title="Drag to reorder">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      {/* المعلومات */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 justify-start">
                          <p className="text-white text-sm font-bold">{s.title}</p>
                          {s.custom ? (
                            <span className="bg-[#A0C9CB]/20 text-[#A0C9CB] text-[9px] font-black px-2 py-0.5 rounded-full">Added by you</span>
                          ) : (
                            <span className="bg-white/5 text-gray-400 text-[9px] font-black px-2 py-0.5 rounded-full">Original</span>
                          )}
                          {isGenre && <span className="bg-blue-600/20 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-full">Auto genre</span>}
                        </div>
                        {s.custom && <p className="text-gray-500 text-[11px] mt-0.5">{isGenre ? 'Auto-filled' : `${count} manual items`}</p>}
                      </div>

                      {/* أزرار الEdit/الDelete — بس للمخصصة */}
                      {s.custom && (
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => openSectionEditor((s as any).data)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 cursor-pointer" title="Edit">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeCustomSection(s.key)} className="w-9 h-9 rounded-full bg-[#A0C9CB]/10 hover:bg-[#A0C9CB]/20 flex items-center justify-center text-[#A0C9CB] cursor-pointer" title="Delete">
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
        className="w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg transition-all" />
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
        className="w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-sm py-2.5 px-3 rounded-lg transition-all placeholder-gray-600" dir="ltr" />
    </div>
  );
}
