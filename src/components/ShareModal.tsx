/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export default function ShareModal({ isOpen, url, onClose, onToast }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      
      setCopied(true);
      onToast('تم نسخ رابط الصفحة بنجاح');
      setTimeout(() => setCopied(false), 2000);
      onClose();
    } catch (err) {
      onToast('عذراً، تعذّر نسخ الرابط تلقائياً');
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[600] flex items-center justify-center p-4 selection:bg-red-500/30"
    >
      <div className="w-full max-w-sm bg-stone-900 border border-white/10 rounded-3xl shadow-2xl p-6 relative animate-pop-in text-right">
        <button
          onClick={onClose}
          className="absolute left-4 top-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-white mb-2 ml-6">مشاركة العمل</h3>
        <p className="text-gray-400 text-xs mb-4 leading-relaxed">
          انسخ رابط الصفحة الحالي المسجل بالأسفل حتى تتمكن من إرساله للأصدقاء أو تشغيله لاحقاً بضغطة زر.
        </p>

        <div className="bg-stone-950 border border-white/5 rounded-xl p-3 text-xs text-gray-400 font-mono select-all break-all overflow-hidden text-left mb-4 select-none">
          {url}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 text-gray-300 hover:text-white hover:bg-stone-700 font-medium rounded-full text-xs cursor-pointer transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-5 py-2 bg-white hover:bg-stone-150 text-black font-bold rounded-full text-xs cursor-pointer transition-colors shadow-lg"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
