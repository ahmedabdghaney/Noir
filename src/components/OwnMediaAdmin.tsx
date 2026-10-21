/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * لوحة "ملفات الفيديو": تربط ملفاتك (جودة لكل ملف + ترجمات) بفلم أو حلقة.
 * العنوان اللي عنده ملفات هنا يشتغل مباشرة بمشغل Noir.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Search, Plus, Trash2, Loader, Edit3, Check, ExternalLink, X } from 'lucide-react';
import { MovieOrShow } from '../types';
import { searchAdmin } from '../lib/tmdb';
import {
  OwnMedia, OwnQuality, OwnSubtitle,
  deleteOwnMedia, saveOwnMedia, subscribeOwnMedia,
} from '../lib/ownMedia';

interface FormState {
  type: 'movie' | 'tv';
  tmdbId: number;
  title: string;
  season: number;
  episode: number;
  qualities: OwnQuality[];
  subtitles: OwnSubtitle[];
}

const QUALITY_PRESETS = ['1080p', '720p', '480p'];

const emptyForm = (item?: MovieOrShow): FormState => ({
  type: item?.type || 'movie',
  tmdbId: item?.id || 0,
  title: item?.title || '',
  season: 1,
  episode: 1,
  qualities: [{ label: '1080p', url: '' }],
  subtitles: [{ lang: 'ar', label: 'العربية', url: '' }],
});

const inputCls =
  'w-full bg-stone-900 border border-white/10 focus:border-[#A0C9CB]/60 outline-none text-white text-xs py-2.5 px-3 rounded-lg transition-all placeholder-gray-600';

const isHttpUrl = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());

export default function OwnMediaAdmin({ showToast }: { showToast?: (m: string) => void }) {
  const notify = showToast || ((m: string) => window.alert(m));
  const [entries, setEntries] = useState<OwnMedia[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(
    () => subscribeOwnMedia((m) => setEntries([...m.values()].sort((a, b) => b.updatedAt - a.updatedAt))),
    [],
  );

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults((await searchAdmin(query.trim())).slice(0, 12));
    } catch {
      notify('Search failed. Check the TMDB connection.');
    } finally {
      setSearching(false);
    }
  };

  const edit = (m: OwnMedia) =>
    setForm({
      type: m.type,
      tmdbId: m.tmdbId,
      title: m.title,
      season: m.season || 1,
      episode: m.episode || 1,
      qualities: m.qualities.length ? m.qualities.map((q) => ({ ...q })) : [{ label: '1080p', url: '' }],
      subtitles: m.subtitles.map((s) => ({ ...s })),
    });

  const save = async () => {
    if (!form) return;
    const qualities = form.qualities.filter((q) => q.url.trim());
    const subtitles = form.subtitles.filter((s) => s.url.trim());
    if (!form.tmdbId) return notify('Pick a title first.');
    if (qualities.length === 0) return notify('Add at least one video link.');
    const bad = [...qualities.map((q) => q.url), ...subtitles.map((s) => s.url)].find((u) => !isHttpUrl(u));
    if (bad) return notify(`This is not a valid link: ${bad}`);
    setSaving(true);
    try {
      await saveOwnMedia({ ...form, qualities, subtitles });
      notify('Saved. This title now plays your files.');
      setForm(null);
    } catch (err) {
      console.error(err);
      notify('Could not save. Are you signed in with the admin account?');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: OwnMedia) => {
    if (!window.confirm(`Remove your files from "${m.title}"? It will go back to the normal sources.`)) return;
    try {
      await deleteOwnMedia(m.key);
    } catch {
      notify('Could not remove it.');
    }
  };

  const titleLink = (m: { type: 'movie' | 'tv'; tmdbId: number; season?: number; episode?: number }) =>
    m.type === 'tv' ? `/tv/${m.tmdbId}/${m.season || 1}/${m.episode || 1}` : `/movie/${m.tmdbId}`;

  return (
    <div className="space-y-8 text-left">
      <div>
        <h2 className="text-white font-black text-lg">Your video files</h2>
        <p className="text-gray-500 text-xs mt-1 max-w-2xl leading-relaxed">
          Attach direct links to your own video files (MP4 or .m3u8), one per quality, plus subtitle files (.vtt or .srt).
          A title with files here opens straight in the Noir player with a quality menu, and Arabic subtitles are on by default.
          Only add files you have the rights to share. Subtitle files must allow cross-origin requests (CORS) from your site.
        </p>
      </div>

      {!form && (
        <>
          <form onSubmit={runSearch} className="relative max-w-xl">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a movie or series to add files…"
              className={`${inputCls} !text-sm !py-3 pr-10`}
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white" aria-label="Search">
              {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </form>

          {results.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {results.map((r) => (
                <button
                  key={`${r.type}_${r.id}`}
                  onClick={() => { setForm(emptyForm(r)); setResults([]); setQuery(''); }}
                  className="text-left group"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/5 group-hover:border-[#A0C9CB]/60">
                    {r.poster && <img src={r.poster} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                  </div>
                  <span className="block text-white text-[11px] font-bold mt-1.5 line-clamp-1">{r.title}</span>
                  <span className="block text-gray-500 text-[10px]">{r.type === 'tv' ? 'Series' : 'Movie'} · {r.year}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {form && (
        <div className="bg-[#141417] border border-white/8 rounded-2xl p-5 space-y-5 max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-white font-black">{form.title || 'Untitled'}</h3>
              <p className="text-gray-500 text-[11px]" dir="ltr">{form.type === 'tv' ? 'Series' : 'Movie'} · TMDB {form.tmdbId}</p>
            </div>
            <button onClick={() => setForm(null)} className="p-2 rounded-full text-gray-400 hover:bg-white/10" aria-label="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>

          {form.type === 'tv' && (
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              <label className="text-white text-xs font-bold">Season
                <input type="number" min={1} value={form.season} onChange={(e) => setForm({ ...form, season: Math.max(1, Number(e.target.value) || 1) })} className={`${inputCls} mt-1.5`} dir="ltr" />
              </label>
              <label className="text-white text-xs font-bold">Episode
                <input type="number" min={1} value={form.episode} onChange={(e) => setForm({ ...form, episode: Math.max(1, Number(e.target.value) || 1) })} className={`${inputCls} mt-1.5`} dir="ltr" />
              </label>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-white text-xs font-bold block">Video files (one per quality)</span>
            {form.qualities.map((q, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  list="noir-quality-presets"
                  value={q.label}
                  onChange={(e) => setForm({ ...form, qualities: form.qualities.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                  className={`${inputCls} !w-24 shrink-0`}
                  placeholder="1080p"
                  dir="ltr"
                />
                <input
                  value={q.url}
                  onChange={(e) => setForm({ ...form, qualities: form.qualities.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                  className={inputCls}
                  placeholder="https://…/movie-1080p.mp4"
                  dir="ltr"
                />
                <button onClick={() => setForm({ ...form, qualities: form.qualities.filter((_, j) => j !== i) })} className="p-2 text-gray-500 hover:text-red-400 shrink-0" aria-label="Remove quality">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <datalist id="noir-quality-presets">
              {QUALITY_PRESETS.map((p) => <option key={p} value={p} />)}
            </datalist>
            <button
              onClick={() => {
                const used = new Set(form.qualities.map((q) => q.label));
                const next = QUALITY_PRESETS.find((p) => !used.has(p)) || '';
                setForm({ ...form, qualities: [...form.qualities, { label: next, url: '' }] });
              }}
              className="flex items-center gap-1.5 text-[#A0C9CB] text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Add quality
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-white text-xs font-bold block">Subtitle files (.vtt or .srt)</span>
            {form.subtitles.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={s.lang}
                  onChange={(e) => {
                    const lang = e.target.value;
                    const label = lang === 'ar' ? 'العربية' : lang === 'en' ? 'English' : s.label;
                    setForm({ ...form, subtitles: form.subtitles.map((x, j) => (j === i ? { ...x, lang, label } : x)) });
                  }}
                  className={`${inputCls} !w-28 shrink-0`}
                >
                  <option value="ar">Arabic</option>
                  <option value="en">English</option>
                  <option value="tr">Turkish</option>
                  <option value="fr">French</option>
                </select>
                <input
                  value={s.url}
                  onChange={(e) => setForm({ ...form, subtitles: form.subtitles.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                  className={inputCls}
                  placeholder="https://…/movie.ar.vtt"
                  dir="ltr"
                />
                <button onClick={() => setForm({ ...form, subtitles: form.subtitles.filter((_, j) => j !== i) })} className="p-2 text-gray-500 hover:text-red-400 shrink-0" aria-label="Remove subtitle">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setForm({ ...form, subtitles: [...form.subtitles, { lang: form.subtitles.some((s) => s.lang === 'ar') ? 'en' : 'ar', label: form.subtitles.some((s) => s.lang === 'ar') ? 'English' : 'العربية', url: '' }] })}
              className="flex items-center gap-1.5 text-[#A0C9CB] text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Add subtitle
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#A0C9CB] text-black px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
            </button>
            <button onClick={() => setForm(null)} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-stone-900 text-gray-300">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <span className="text-white text-xs font-bold block">Titles with your files ({entries.length})</span>
        {entries.length === 0 && <p className="text-gray-600 text-xs">None yet. Search a title above to add files.</p>}
        {entries.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-3 bg-stone-900 border border-white/5 rounded-xl px-4 py-3">
            <div className="min-w-0">
              <span className="block text-white text-sm font-bold truncate">
                {m.title}{m.type === 'tv' ? ` · S${m.season}E${m.episode}` : ''}
              </span>
              <span className="block text-gray-500 text-[11px]" dir="ltr">
                {m.qualities.map((q) => q.label).join(' / ')}
                {m.subtitles.length ? ` · subs: ${m.subtitles.map((s) => s.lang).join(', ')}` : ' · no subtitles'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a href={titleLink(m)} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-white" aria-label="Open title">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => edit(m)} className="p-2 text-gray-400 hover:text-white" aria-label="Edit">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => remove(m)} className="p-2 text-gray-400 hover:text-red-400" aria-label="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
