import { useEffect, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { ImagePickerField } from '../../components/ImagePickerField';
import type { AboutSectionCms, SiteCmsData } from '../../data/cmsTypes';
import type { AdminPanelBaseProps } from '../types';

export function AboutPanel({
  cmsData,
  adminToken,
  lang,
  saving,
  cardRadiusClass,
  primaryHex,
  apiRequest,
  onCmsUpdated,
  showToast,
}: AdminPanelBaseProps) {
  const isEn = lang === 'en';
  const [aboutForm, setAboutForm] = useState<AboutSectionCms>(cmsData.aboutSection);

  useEffect(() => {
    setAboutForm(cmsData.aboutSection);
  }, [cmsData.aboutSection]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const res = await apiRequest<{ cms: SiteCmsData }>('/api/admin/about', 'PUT', aboutForm);
    if (res?.cms) {
      onCmsUpdated(res.cms);
      showToast(
        'success',
        isEn
          ? "Muhtamim's message & library details saved."
          : 'মুহতামিমের বাণী, ছবি ও পাঠাগারের তথ্য সংরক্ষিত হয়েছে।',
      );
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? "Muhtamim's Message & Library Photos" : 'মুহতামিমের বাণী ও পাঠাগারের ছবি'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? "Edit the Principal's portrait, name, quote, and library showcase photo."
              : 'মুহতামিমের বাণী, মুহতামিমের ছবি, নাম এবং কেন্দ্রীয় কুতুবখানার ছবি পরিবর্তন করুন।'}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ backgroundColor: primaryHex }}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>{isEn ? 'Save Changes' : 'বাণী ও ছবি সেভ করুন'}</span>
        </button>
      </div>

      <div
        className={`grid grid-cols-1 gap-5 ${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Section Heading (Bengali)' : 'সেকশন শিরোনাম (বাংলা)'}
            </label>
            <input
              type="text"
              value={aboutForm.headingBn}
              onChange={(e) => setAboutForm((prev) => ({ ...prev, headingBn: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Section Heading (English)' : 'সেকশন শিরোনাম (ইংরেজি)'}
            </label>
            <input
              type="text"
              value={aboutForm.headingEn}
              onChange={(e) => setAboutForm((prev) => ({ ...prev, headingEn: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? "Muhtamim's Name (Bengali)" : 'মুহতামিমের নাম (বাংলা)'}
            </label>
            <input
              type="text"
              value={aboutForm.muhtamimNameBn}
              onChange={(e) =>
                setAboutForm((prev) => ({ ...prev, muhtamimNameBn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? "Muhtamim's Name (English)" : 'মুহতামিমের নাম (ইংরেজি)'}
            </label>
            <input
              type="text"
              value={aboutForm.muhtamimNameEn}
              onChange={(e) =>
                setAboutForm((prev) => ({ ...prev, muhtamimNameEn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? "Muhtamim's Message (Bengali)" : 'মুহতামিমের বাণী (বাংলা)'}
          </label>
          <textarea
            rows={4}
            value={aboutForm.quoteBn}
            onChange={(e) => setAboutForm((prev) => ({ ...prev, quoteBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? "Muhtamim's Message (English)" : 'মুহতামিমের বাণী (ইংরেজি)'}
          </label>
          <textarea
            rows={4}
            value={aboutForm.quoteEn}
            onChange={(e) => setAboutForm((prev) => ({ ...prev, quoteEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-[#E2E8F0] pt-5 lg:grid-cols-2">
          <ImagePickerField
            label={isEn ? "Muhtamim's Portrait Photo" : 'মুহতামিমের ছবি'}
            value={aboutForm.muhtamimPhotoUrl}
            onChange={(url) => setAboutForm((prev) => ({ ...prev, muhtamimPhotoUrl: url }))}
            adminToken={adminToken}
            lang={lang}
            onError={(msg) => showToast('error', msg)}
          />
          <ImagePickerField
            label={isEn ? 'Library Showcase Photo' : 'কেন্দ্রীয় পাঠাগারের ছবি'}
            value={aboutForm.libraryPhotoUrl}
            onChange={(url) => setAboutForm((prev) => ({ ...prev, libraryPhotoUrl: url }))}
            adminToken={adminToken}
            lang={lang}
            onError={(msg) => showToast('error', msg)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Library Caption (Bengali)' : 'পাঠাগার ছবির ক্যাপশন (বাংলা)'}
            </label>
            <input
              type="text"
              value={aboutForm.libraryCaptionBn}
              onChange={(e) =>
                setAboutForm((prev) => ({ ...prev, libraryCaptionBn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A]">
              {isEn ? 'Library Caption (English)' : 'পাঠাগার ছবির ক্যাপশন (ইংরেজি)'}
            </label>
            <input
              type="text"
              value={aboutForm.libraryCaptionEn}
              onChange={(e) =>
                setAboutForm((prev) => ({ ...prev, libraryCaptionEn: e.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
