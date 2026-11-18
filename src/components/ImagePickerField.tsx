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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export function ImagePickerField({
  label,
  value,
  onChange,
  adminToken,
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

    if (file.size > 6 * 1024 * 1024) {
      onError?.(
        isEn
          ? 'Image size must be under 6 MB.'
          : 'ছবির সাইজ ৬ মেগাবাইটের কম হতে হবে।',
      );
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          filename: file.name,
          dataUrl,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        onError?.(
          data.error ??
            (isEn ? 'Image upload failed.' : 'ছবি আপলোড সম্পন্ন হয়নি। আবার চেষ্টা করুন।'),
        );
        return;
      }
      setPreviewFailed(false);
      onChange(data.url);
    } catch {
      onError?.(
        isEn ? 'Network error while uploading image.' : 'ছবি আপলোডের সময় সার্ভারের সাথে সংযোগ সমস্যা হয়েছে।',
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
