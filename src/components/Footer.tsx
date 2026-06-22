/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Youtube, Github, Mail } from 'lucide-react';
import LogoIcon from './LogoIcon';

interface FooterProps {
  goHome: () => void;
  setSearchMode: (mode: 'movie' | 'tv') => void;
}

export default function Footer({ goHome, setSearchMode }: FooterProps) {
  return (
    <footer className="border-t border-white/5 bg-neutral-950/40 text-neutral-500 py-12 md:py-16 mt-16 select-none leading-relaxed">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 text-right">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div
              onClick={goHome}
              className="inline-flex items-center gap-2 cursor-pointer text-white font-bold text-lg tracking-tight"
            >
              <LogoIcon className="w-5 h-5 text-red-500" />
              <span>نوار</span>
              <span className="text-gray-500 font-normal text-xs mr-1 bg-white/5 px-1.5 py-0.5 rounded">سينما</span>
            </div>
            <p className="text-xs text-neutral-400 font-medium max-w-sm">
              تجربة بثّ راقية صُمّمت لمحبّي السينما وعائلاتهم. مجموعات منسّقة، استعراض فائق السرعة، ومستوى راقٍ خالٍ من الفوضى والإعلانات المزعجة.
            </p>
            <div className="flex gap-2.5">
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all text-neutral-400"
                aria-label="YouTube Channel"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all text-neutral-400"
                aria-label="Github Repo"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="mailto:support@noir.cinema"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all text-neutral-400"
                aria-label="Email support"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">تصفّح العناوين</h5>
            <div className="flex flex-col gap-2 text-xs">
              <button onClick={goHome} className="text-right hover:text-white transition-colors cursor-pointer">
                الرئيسية
              </button>
              <button onClick={() => setSearchMode('movie')} className="text-right hover:text-white transition-colors cursor-pointer">
                أحدث الأفلام
              </button>
              <button onClick={() => setSearchMode('tv')} className="text-right hover:text-white transition-colors cursor-pointer">
                المسلسلات التلفزيونية
              </button>
            </div>
          </div>

          {/* Company legalities */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">حول التطبيق</h5>
            <div className="flex flex-col gap-2 text-xs text-neutral-500">
              <span className="hover:text-white cursor-help transition-colors">من نحن</span>
              <span className="hover:text-white cursor-help transition-colors">سياستنا للخصوصية</span>
              <span className="hover:text-white cursor-help transition-colors">شروط الاستخدام</span>
              <span className="text-neutral-500 mt-2 block hover:text-[#f5c518] cursor-help">
                تُجلب البيانات الفنية تزامناً مع TMDB.
              </span>
            </div>
          </div>

        </div>

        {/* Footer Bottom copyright notes */}
        <div className="border-t border-white/5 pt-6 flex flex-wrap justify-between items-center text-[11px] text-neutral-600 gap-4">
          <span>
            © 2026 نوار سينما — للاستخدام العائلي والترفيه الشخصي التجريبي. كافة الحقوق محفوظة.
          </span>
          <span className="font-medium tracking-wide">
            صُنع برزانة وبلغة جمالية رمادية هادئة للعين.
          </span>
        </div>

      </div>
    </footer>
  );
}
