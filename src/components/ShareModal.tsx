/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export default function ShareModal({ isOpen, url, onClose, onToast }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
    >
      <div className="noir-surface w-full max-w-sm shadow-2xl p-6 relative animate-pop-in text-right">
        <button
          onClick={onClose}
          className="noir-icon-button !w-10 !min-w-10 !min-h-10 absolute left-4 top-4"
          aria-label="إغلاق نافذة المشاركة"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 id="share-dialog-title" className="text-base font-bold text-white mb-2 ml-6">مشاركة العمل</h3>
        <p className="text-gray-400 text-xs mb-4 leading-relaxed">
          انسخ رابط الصفحة الحالي المسجل بالأسفل حتى تتمكن من إرساله للأصدقاء أو تشغيله لاحقاً بضغطة زر.
        </p>

        <div className="bg-black/30 border border-white/[0.08] rounded-[14px] p-3 text-xs text-white/50 font-mono select-all break-all overflow-hidden text-left mb-4">
          {url}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="noir-button-secondary text-xs"
          >
            إلغاء
          </button>
          <button
            onClick={handleCopy}
            className="noir-button-primary flex items-center gap-1.5 text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
