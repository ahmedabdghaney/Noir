import LogoIcon from './LogoIcon';

interface FooterProps {
  goHome: () => void;
  setSearchMode: (mode: 'movie' | 'tv') => void;
}

export default function Footer({ goHome, setSearchMode }: FooterProps) {
  return (
    <footer className="mt-10 border-t border-white/[0.07] text-white/40">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-9 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-[12px] bg-[#ff453a] flex items-center justify-center text-white">
            <LogoIcon className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white/85">نوار سينما</p>
            <p className="text-[11px] mt-0.5">بيانات العناوين والصور مقدّمة من TMDB.</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 text-xs" aria-label="روابط التذييل">
          <button onClick={goHome} className="min-h-10 px-3 rounded-full hover:bg-white/[0.06] hover:text-white">
            الرئيسية
          </button>
          <button onClick={() => setSearchMode('movie')} className="min-h-10 px-3 rounded-full hover:bg-white/[0.06] hover:text-white">
            الأفلام
          </button>
          <button onClick={() => setSearchMode('tv')} className="min-h-10 px-3 rounded-full hover:bg-white/[0.06] hover:text-white">
            المسلسلات
          </button>
        </nav>
      </div>
    </footer>
  );
}
