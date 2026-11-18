import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { ImagePickerField } from '../../components/ImagePickerField';
import type { HeroSectionCms, SiteCmsData } from '../../data/cmsTypes';
import { formatDigits } from '../../data/madrasaTranslations';
import type { AdminPanelBaseProps } from '../types';

export function HeroPanel({
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
  const [heroForm, setHeroForm] = useState<HeroSectionCms>(cmsData.heroSection);

  useEffect(() => {
    setHeroForm(cmsData.heroSection);
  }, [cmsData.heroSection]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (heroForm.slides.length === 0) {
      showToast('error', isEn ? 'Keep at least 1 hero image.' : 'হিরো সেকশনে কমপক্ষে ১টি ছবি রাখুন।');
      return;
    }
    const res = await apiRequest<{ cms: SiteCmsData }>('/api/admin/hero', 'PUT', heroForm);
    if (res?.cms) {
      onCmsUpdated(res.cms);
      showToast(
        'success',
        isEn
          ? 'Hero section & campus slides updated.'
          : 'হিরো সেকশন ও স্লাইডার ছবিগুলো সফলভাবে হালনাগাদ হয়েছে।',
      );
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? 'Hero Headlines, Stats & Slider Photos' : 'হিরো সেকশন, বর্ণনা ও স্লাইডার ছবি'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'Edit hero headlines, descriptions, statistics, and add/remove slider photos.'
              : 'প্রথম সেকশনের শিরোনাম, ডেসক্রিপশন, পরিসংখ্যান ও একাধিক ব্যানার ছবি যুক্ত বা পরিবর্তন করুন।'}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ backgroundColor: primaryHex }}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>{isEn ? 'Save Hero Changes' : 'হিরো সেকশন সেভ করুন'}</span>
        </button>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:grid-cols-2 sm:p-6`}
      >
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Welcome Tag (Bengali)' : 'স্বাগতম ট্যাগ (বাংলা)'}
          </label>
          <input
            type="text"
            value={heroForm.welcomeBn}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, welcomeBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Welcome Tag (English)' : 'স্বাগতম ট্যাগ (ইংরেজি)'}
          </label>
          <input
            type="text"
            value={heroForm.welcomeEn}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, welcomeEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Headline Line 1 (Bengali)' : 'মূল শিরোনাম লাইন ১ (সবুজ - বাংলা)'}
          </label>
          <input
            type="text"
            value={heroForm.headlineLine1Bn}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, headlineLine1Bn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Headline Line 2 (Bengali)' : 'মূল শিরোনাম লাইন ২ (কালো - বাংলা)'}
          </label>
          <input
            type="text"
            value={heroForm.headlineLine2Bn}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, headlineLine2Bn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Headline Line 1 (English)' : 'মূল শিরোনাম লাইন ১ (ইংরেজি)'}
          </label>
          <input
            type="text"
            value={heroForm.headlineLine1En}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, headlineLine1En: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Headline Line 2 (English)' : 'মূল শিরোনাম লাইন ২ (ইংরেজি)'}
          </label>
          <input
            type="text"
            value={heroForm.headlineLine2En}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, headlineLine2En: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Subtitle (Bengali)' : 'সাব-টাইটেল (বাংলা)'}
          </label>
          <input
            type="text"
            value={heroForm.subtitleBn}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, subtitleBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Subtitle (English)' : 'সাব-টাইটেল (ইংরেজি)'}
          </label>
          <input
            type="text"
            value={heroForm.subtitleEn}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, subtitleEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Hero Description (Bengali)' : 'মূল ডেসক্রিপশন (বাংলা)'}
          </label>
          <textarea
            rows={3}
            value={heroForm.descriptionBn}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, descriptionBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Hero Description (English)' : 'মূল ডেসক্রিপশন (ইংরেজি)'}
          </label>
          <textarea
            rows={3}
            value={heroForm.descriptionEn}
            onChange={(e) => setHeroForm((prev) => ({ ...prev, descriptionEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}>
        <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
          <div>
            <h2 className="font-serif text-base font-bold text-[#0F172A]">
              {isEn ? 'Hero Campus Slideshow Photos' : 'হিরো স্লাইডার ছবিসমূহ'}
            </h2>
            <p className="text-xs text-[#475569]">
              {isEn
                ? 'Upload or reorder photos shown in the top campus banner.'
                : 'প্রথম সেকশনের স্লাইডারে প্রদর্শিত ছবি যুক্ত, পরিবর্তন বা ক্রম সাজান।'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setHeroForm((prev) => ({
                ...prev,
                slides: [
                  ...prev.slides,
                  {
                    id: `slide-${Date.now()}`,
                    imageUrl: '/src/assets/images/hero_white_madrasa_exterior_1794946111771.jpg',
                    titleBn: 'নতুন ক্যাম্পাস ছবি',
                    titleEn: 'New Campus Photo',
                    subtitleBn: 'মাদ্রাসা প্রাঙ্গণ',
                    subtitleEn: 'Madrasa Campus',
                    altBn: 'মাদ্রাসার ক্যাম্পাস ছবি',
                    altEn: 'Madrasa Campus Photo',
                  },
                ],
              }))
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#065F46] bg-[#ECFDF5] px-3 py-2 text-xs font-semibold text-[#065F46] hover:bg-[#065F46] hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isEn ? 'Add Slide Photo' : 'নতুন স্লাইড ছবি'}</span>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {heroForm.slides.map((slide, idx) => (
            <div key={slide.id} className={`${cardRadiusClass} border border-[#E2E8F0] bg-[#F8FAFC] p-4`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-bold tabular-nums" style={{ color: primaryHex }}>
                  {isEn ? `Slide #${idx + 1}` : `স্লাইড #${formatDigits(idx + 1, 'bn')}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => {
                      const next = [...heroForm.slides];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      setHeroForm((prev) => ({ ...prev, slides: next }));
                    }}
                    aria-label="Move up"
                    className="rounded border border-[#E2E8F0] bg-white p-1.5 text-[#475569] disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === heroForm.slides.length - 1}
                    onClick={() => {
                      const next = [...heroForm.slides];
                      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                      setHeroForm((prev) => ({ ...prev, slides: next }));
                    }}
                    aria-label="Move down"
                    className="rounded border border-[#E2E8F0] bg-white p-1.5 text-[#475569] disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={heroForm.slides.length <= 1}
                    onClick={() =>
                      setHeroForm((prev) => ({
                        ...prev,
                        slides: prev.slides.filter((s) => s.id !== slide.id),
                      }))
                    }
                    aria-label="Remove slide"
                    className="rounded border border-red-200 bg-red-50 p-1.5 text-red-700 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <ImagePickerField
                label={isEn ? 'Slide Image' : 'স্লাইড ছবি'}
                value={slide.imageUrl}
                onChange={(url) =>
                  setHeroForm((prev) => ({
                    ...prev,
                    slides: prev.slides.map((s) =>
                      s.id === slide.id ? { ...s, imageUrl: url } : s,
                    ),
                  }))
                }
                adminToken={adminToken}
                lang={lang}
                onError={(msg) => showToast('error', msg)}
              />

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={slide.titleBn}
                  onChange={(e) =>
                    setHeroForm((prev) => ({
                      ...prev,
                      slides: prev.slides.map((s) =>
                        s.id === slide.id ? { ...s, titleBn: e.target.value } : s,
                      ),
                    }))
                  }
                  placeholder="ছবির শিরোনাম (বাংলা)"
                  className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={slide.titleEn}
                  onChange={(e) =>
                    setHeroForm((prev) => ({
                      ...prev,
                      slides: prev.slides.map((s) =>
                        s.id === slide.id ? { ...s, titleEn: e.target.value } : s,
                      ),
                    }))
                  }
                  placeholder="Slide Title (English)"
                  className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
