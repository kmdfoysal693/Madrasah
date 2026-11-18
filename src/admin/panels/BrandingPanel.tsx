import { useEffect, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { ImagePickerField } from '../../components/ImagePickerField';
import type { SiteCmsData, SiteSettingsCms } from '../../data/cmsTypes';
import type { AdminPanelBaseProps } from '../types';

export function BrandingPanel({
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
  const [siteForm, setSiteForm] = useState<SiteSettingsCms>(cmsData.siteSettings);

  useEffect(() => {
    setSiteForm(cmsData.siteSettings);
  }, [cmsData.siteSettings]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const res = await apiRequest<{ cms: SiteCmsData }>(
      '/api/admin/site-settings',
      'PUT',
      siteForm,
    );
    if (res?.cms) {
      onCmsUpdated(res.cms);
      showToast(
        'success',
        isEn
          ? 'Institution details & logo saved successfully.'
          : 'প্রতিষ্ঠানের নাম, লোগো ও তথ্য সফলভাবে সংরক্ষিত হয়েছে।',
      );
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? 'Institution Name, Logo & Contact Info' : 'প্রতিষ্ঠানের নাম, লোগো ও তথ্য'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'Changes here immediately update the Header, Footer, Receipts, and Student Portal.'
              : 'এখান থেকে পরিবর্তন করলে ওয়েবসাইটের হেডার, ফুটার, রশিদ ও ছাত্র পোর্টালে সাথে সাথে আপডেট হবে।'}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ backgroundColor: primaryHex }}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>{isEn ? 'Save Institution Info' : 'তথ্য সংরক্ষণ করুন'}</span>
        </button>
      </div>

      <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}>
        <ImagePickerField
          label={
            isEn
              ? 'Madrasa Logo (Leave blank to use default emblem)'
              : 'মাদ্রাসার লোগো (খালি রাখলে ডিফল্ট গম্বুজ লোগো দেখাবে)'
          }
          value={siteForm.logoUrl}
          onChange={(url) => setSiteForm((prev) => ({ ...prev, logoUrl: url }))}
          adminToken={adminToken}
          lang={lang}
          allowClear
          onError={(msg) => showToast('error', msg)}
        />
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:grid-cols-2 sm:p-6`}
      >
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Short Brand Name (Bengali)' : 'সংক্ষিপ্ত নাম (বাংলা - হেডার)'}
          </label>
          <input
            type="text"
            value={siteForm.brandShortBn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, brandShortBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Short Brand Name (English)' : 'সংক্ষিপ্ত নাম (ইংরেজি - হেডার)'}
          </label>
          <input
            type="text"
            value={siteForm.brandShortEn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, brandShortEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Full Institution Name (Bengali)' : 'প্রতিষ্ঠানের পূর্ণ নাম (বাংলা)'}
          </label>
          <input
            type="text"
            value={siteForm.brandFullBn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, brandFullBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Full Institution Name (English)' : 'প্রতিষ্ঠানের পূর্ণ নাম (ইংরেজি)'}
          </label>
          <input
            type="text"
            value={siteForm.brandFullEn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, brandFullEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Phone Number (Bengali)' : 'মোবাইল / ফোন নম্বর (বাংলা)'}
          </label>
          <input
            type="text"
            value={siteForm.phoneBn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, phoneBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Phone Number (English)' : 'মোবাইল / ফোন নম্বর (ইংরেজি)'}
          </label>
          <input
            type="text"
            value={siteForm.phoneEn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, phoneEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Official Email' : 'অফিসিয়াল ইমেইল'}
          </label>
          <input
            type="email"
            value={siteForm.email}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, email: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Campus Address (Bengali)' : 'ক্যাম্পাসের ঠিকানা (বাংলা)'}
          </label>
          <input
            type="text"
            value={siteForm.addressBn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, addressBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Campus Address (English)' : 'ক্যাম্পাসের ঠিকানা (ইংরেজি)'}
          </label>
          <input
            type="text"
            value={siteForm.addressEn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, addressEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Footer Description (Bengali)' : 'ফুটার পরিচিতি বিবরণ (বাংলা)'}
          </label>
          <textarea
            rows={3}
            value={siteForm.footerDescBn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, footerDescBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Footer Description (English)' : 'ফুটার পরিচিতি বিবরণ (ইংরেজি)'}
          </label>
          <textarea
            rows={3}
            value={siteForm.footerDescEn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, footerDescEn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Office Hours (Bengali)' : 'অফিস সময় (বাংলা)'}
          </label>
          <input
            type="text"
            value={siteForm.officeHoursBn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, officeHoursBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Registration Line (Bengali)' : 'নিবন্ধন ও স্থাপিত তথ্য (বাংলা)'}
          </label>
          <input
            type="text"
            value={siteForm.footerRegBn}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, footerRegBn: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
      </div>
    </form>
  );
}
