import { useId, useState, type ChangeEvent } from 'react';
import { Image as ImageIcon, RotateCcw, Upload } from 'lucide-react';
import type { Language } from '../data/madrasaTranslations';

interface ImagePickerFieldProps {
  label: string;
  value: string;
  onChange: (newUrl: string) => void;
  adminToken: string;
  lang: Language;
  placeholder?: string;
  allowClear?: boolean;
  onError?: (message: string) => void;
}

async function fileToOptimizedDataUrl(file: File): Promise<string> {
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Failed to read SVG file'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const tryEncode = (maxDim: number, quality: number, mime: 'image/png' | 'image/jpeg') => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return String(reader.result ?? '');
          ctx.drawImage(img, 0, 0, width, height);
          return canvas.toDataURL(mime, quality);
        };

        const preferPng = file.type === 'image/png' && file.size < 250_000;
        let result = tryEncode(1100, 0.8, preferPng ? 'image/png' : 'image/jpeg');
        if (result.length > 260_000) {
          result = tryEncode(900, 0.72, 'image/jpeg');
        }
        if (result.length > 260_000) {
          result = tryEncode(720, 0.62, 'image/jpeg');
        }
        resolve(result);
      };
      img.onerror = () => reject(new Error('Invalid image format'));
      img.src = String(reader.result ?? '');
    };
    reader.readAsDataURL(file);
  });
}

export function ImagePickerField({
  label,
  value,
  onChange,
  adminToken: _adminToken,
  lang,
  placeholder,
  allowClear = false,
  onError,
}: ImagePickerFieldProps) {
  const inputId = useId();
  const fileId = useId();
  const [uploading, setUploading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const isEn = lang === 'en';

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError?.(
        isEn ? 'Please select a valid image file.' : 'অনুগ্রহ করে সঠিক ছবি ফাইল নির্বাচন করুন।',
      );
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      if (dataUrl.length > 380_000) {
        onError?.(
          isEn
            ? 'Image is too large even after compression. Please choose a smaller photo.'
            : 'ছবিটি অনেক বড়। অনুগ্রহ করে অপেক্ষাকৃত ছোট ছবি নির্বাচন করুন।',
        );
        return;
      }
      setPreviewFailed(false);
      onChange(dataUrl);
    } catch {
      onError?.(
        isEn ? 'Image processing error occurred.' : 'ছবি প্রসেসিংয়ের সময় সমস্যা হয়েছে।',
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-xs font-semibold text-[#0F172A]">
        {label}
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
          {value && !previewFailed ? (
            <img
              src={value}
              alt={label}
              referrerPolicy="no-referrer"
              onError={() => setPreviewFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={fileId}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#065F46] bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#065F46] transition-colors hover:bg-[#065F46] hover:text-white ${
                uploading ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {uploading
                  ? isEn
                    ? 'Uploading...'
                    : 'আপলোড হচ্ছে...'
                  : isEn
                    ? 'Upload Photo'
                    : 'ছবি আপলোড করুন'}
              </span>
            </label>
            <input
              id={fileId}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="sr-only"
            />

            {allowClear && value && (
              <button
                type="button"
                onClick={() => {
                  setPreviewFailed(false);
                  onChange('');
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#475569] hover:text-red-600"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isEn ? 'Reset Default' : 'ডিফল্টে ফিরুন'}</span>
              </button>
            )}
          </div>

          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(e) => {
              setPreviewFailed(false);
              onChange(e.target.value);
            }}
            placeholder={
              placeholder ?? (isEn ? 'Or paste image URL (/uploads/...)' : 'অথবা ছবির লিংক দিন')
            }
            className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] focus:border-[#065F46] focus:outline-none focus:ring-2 focus:ring-[#065F46]/15"
          />
        </div>
      </div>
    </div>
  );
}
