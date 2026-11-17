import { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GalleryItem } from '../data/madrasaData';

interface GalleryLightboxModalProps {
  items: GalleryItem[];
  activeIndex: number | null;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}

export function GalleryLightboxModal({
  items,
  activeIndex,
  onClose,
  onChangeIndex,
}: GalleryLightboxModalProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight') {
        onChangeIndex((activeIndex + 1) % items.length);
      } else if (event.key === 'ArrowLeft') {
        onChangeIndex((activeIndex - 1 + items.length) % items.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, items.length, onClose, onChangeIndex]);

  if (activeIndex === null || !items[activeIndex]) return null;
  const activeItem = items[activeIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
    >
      <div
        className="relative mx-auto my-auto w-full max-w-4xl overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
          <div className="flex items-center gap-2 text-xs text-[#475569]">
            <span className="font-semibold text-[#065F46]">{activeItem.category}</span>
            <span aria-hidden="true">·</span>
            <span>{activeItem.date}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
            aria-label="ছবি বন্ধ করুন"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-slate-100 sm:aspect-[16/10]">
          {!imgFailed ? (
            <img
              src={activeItem.imageUrl}
              alt={activeItem.title}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
              <BookOpen className="h-10 w-10 text-[#065F46]" aria-hidden="true" />
              <p className="mt-2 text-sm text-[#475569]">{activeItem.title}</p>
            </div>
          )}

          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  onChangeIndex((activeIndex - 1 + items.length) % items.length)
                }
                className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white/90 text-[#0F172A] shadow-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
                aria-label="পূর্ববর্তী ছবি"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onChangeIndex((activeIndex + 1) % items.length)}
                className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white/90 text-[#0F172A] shadow-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]"
                aria-label="পরবর্তী ছবি"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[#E2E8F0] px-5 py-4">
          <h3 id="lightbox-title" className="font-serif text-base font-semibold text-[#0F172A] sm:text-lg">
            {activeItem.title}
          </h3>
          <span className="text-xs text-[#475569] tabular-nums shrink-0">
            {activeIndex + 1} / {items.length}
          </span>
        </div>
      </div>
    </div>
  );
}
