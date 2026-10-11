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
    <footer className="border-t border-white/5 bg-stone-950/40 text-stone-500 py-12 md:py-16 mt-16 select-none leading-relaxed" dir="ltr">
      <div className="max-w-6xl mx-auto px-6 md:px-12">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 text-left">

          {/* Brand Info */}
          <div className="space-y-4">
            <div
              onClick={goHome}
              className="inline-flex items-center gap-2 cursor-pointer text-white font-bold text-lg tracking-tight"
            >
              <LogoIcon className="w-5 h-5 text-[#A0C9CB]" />
              <span>Noir</span>
              <span className="text-gray-500 font-normal text-xs ml-1 bg-white/5 px-1.5 py-0.5 rounded">Cinema</span>
            </div>
            <p className="text-xs text-stone-400 font-medium max-w-xl leading-6">
              Noir Cinema does not host, upload, or store any files. Titles shown here are indexed automatically from public sources and third-party services. The media stays on those platforms — we only provide links.
            </p>
            <div className="flex gap-2.5">
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all text-stone-400"
                aria-label="YouTube Channel"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all text-stone-400"
                aria-label="Github Repo"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="mailto:support@noir.cinema"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all text-stone-400"
                aria-label="Email support"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div className="space-y-3 md:text-right">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">Browse titles</h5>
            <div className="flex flex-col gap-2 text-xs">
              <button onClick={goHome} className="text-left md:text-right hover:text-white transition-colors cursor-pointer">
                Home
              </button>
              <button onClick={() => setSearchMode('movie')} className="text-left md:text-right hover:text-white transition-colors cursor-pointer">
                Latest Movies
              </button>
              <button onClick={() => setSearchMode('tv')} className="text-left md:text-right hover:text-white transition-colors cursor-pointer">
                TV Shows
              </button>
            </div>
          </div>

        </div>

        {/* Footer Bottom copyright notes */}
        <div className="border-t border-white/5 pt-6 flex flex-wrap justify-between items-center text-[11px] text-stone-600 gap-4">
          <span>
            © {new Date().getFullYear()} Noir Cinema — for personal, family and experimental entertainment use. All rights reserved.
          </span>
          <span className="font-medium tracking-wide">
            Crafted with care in a calm, easy-on-the-eyes grey aesthetic.
          </span>
        </div>

      </div>
    </footer>
  );
}
