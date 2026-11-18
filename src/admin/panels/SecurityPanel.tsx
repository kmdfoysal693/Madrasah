import { useState, type FormEvent } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import type { SiteCmsData } from '../../data/cmsTypes';
import type { AdminPanelBaseProps } from '../types';

export function SecurityPanel({
  lang,
  saving,
  cardRadiusClass,
  primaryHex,
  apiRequest,
  onCmsUpdated,
  showToast,
}: AdminPanelBaseProps) {
  const isEn = lang === 'en';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [confirmResetCms, setConfirmResetCms] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast(
        'error',
        isEn
          ? 'New password must be at least 6 characters.'
          : 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast('error', isEn ? 'Passwords do not match.' : 'নতুন পাসওয়ার্ড দুটি মিলছে না।');
      return;
    }
    const res = await apiRequest<{ ok: boolean }>('/api/admin/change-password', 'POST', {
      currentPassword,
      newPassword,
    });
    if (res?.ok) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast(
        'success',
        isEn ? 'Admin password changed successfully.' : 'অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।',
      );
    }
  };

  const handleResetDefaults = async () => {
    const res = await apiRequest<{ cms: SiteCmsData }>('/api/admin/reset-defaults', 'POST');
    if (res?.cms) {
      onCmsUpdated(res.cms);
      setConfirmResetCms(false);
      showToast(
        'success',
        isEn
          ? 'Website content restored to default settings.'
          : 'ওয়েবসাইটের সকল কনটেন্ট ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে।',
      );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleChangePassword}
        className={`space-y-4 ${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}
      >
        <h2 className="font-serif text-lg font-bold text-[#0F172A]">
          {isEn ? 'Change Admin Password' : 'অ্যাডমিন পাসওয়ার্ড পরিবর্তন'}
        </h2>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Current Password' : 'বর্তমান পাসওয়ার্ড'}
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'New Password (min 6 chars)' : 'নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)'}
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A]">
            {isEn ? 'Confirm New Password' : 'নতুন পাসওয়ার্ড নিশ্চিত করুন'}
          </label>
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          style={{ backgroundColor: primaryHex }}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isEn ? 'Update Password' : 'পাসওয়ার্ড আপডেট করুন'}</span>
        </button>
      </form>

      <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-5 sm:p-6`}>
        <h2 className="font-serif text-lg font-bold text-[#0F172A]">
          {isEn ? 'Restore Default Website Content' : 'ডিফল্ট ওয়েবসাইট কনটেন্ট পুনরুদ্ধার'}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[#475569]">
          {isEn
            ? 'Resets institution info, hero slides, notices, departments, gallery, and teachers back to initial defaults. Saved student admissions are NOT deleted.'
            : 'ওয়েবসাইটের নাম, ছবি, নোটিশ, বিভাগ, গ্যালারি এবং শিক্ষকমণ্ডলীর তথ্য প্রাথমিক ডিফল্ট অবস্থায় ফিরিয়ে আনে। সংরক্ষিত শিক্ষার্থীদের ভর্তি আবেদন মুছবে না।'}
        </p>
        <div className="mt-5">
          {confirmResetCms ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"
              >
                {isEn ? 'Confirm Restore Defaults' : 'নিশ্চিত পুনরুদ্ধার করুন'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetCms(false)}
                className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs"
              >
                {isEn ? 'Cancel' : 'বাতিল'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmResetCms(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isEn ? 'Reset Content to Default' : 'ডিফল্ট কনটেন্ট ফিরিয়ে আনুন'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
