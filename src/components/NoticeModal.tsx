import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import type { NoticeItem } from '../data/madrasaData';

interface NoticeModalProps {
  notice: NoticeItem | null;
  onClose: () => void;
}

export function NoticeModal({ notice, onClose }: NoticeModalProps) {
  useEffect(() => {
    if (!notice) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notice, onClose]);

  if (!notice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-modal-title"
    >
      <div
        className="printable-area relative w-full max-w-2xl rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="no-print flex items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
            <span className="font-semibold text-[#065F46]">{notice.category}</span>
            <span aria-hidden="true">·</span>
            <span>{notice.date}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#B45309]">{notice.hijriDate}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            aria-label="নোটিশ বন্ধ করুন"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium text-[#475569] tabular-nums">{notice.refNumber}</p>
          <h3
            id="notice-modal-title"
            className="mt-2 font-serif text-xl font-semibold leading-snug text-[#0F172A] sm:text-2xl"
          >
            {notice.title}
          </h3>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#475569] sm:text-base">
            {notice.fullText.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-8 border-t border-[#E2E8F0] pt-5">
            <p className="text-xs text-[#475569]">আদেশক্রমে,</p>
            <p className="mt-1 text-sm font-semibold text-[#0F172A]">{notice.issuedBy}</p>
            <p className="mt-0.5 text-xs text-[#475569]">
              আল-জামিয়াতুল ইসলামিয়া আদর্শ মাদ্রাসা, মোহাম্মদপুর, ঢাকা
            </p>
          </div>
        </div>

        <div className="no-print mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-[#E2E8F0] pt-5">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
          >
            <Printer className="h-4 w-4 text-[#065F46]" />
            <span>প্রিন্ট করুন</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-[#065F46] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap shrink-0"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
