import { useMemo, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import type { CmsNotice, SiteCmsData } from '../../data/cmsTypes';
import type { NoticeCategory } from '../../data/madrasaData';
import { formatDigits } from '../../data/madrasaTranslations';
import type { AdminPanelBaseProps } from '../types';

const NOTICE_CATEGORIES: NoticeCategory[] = ['ভর্তি', 'পরীক্ষা', 'সাধারণ'];

export function NoticesPanel({
  cmsData,
  lang,
  saving,
  cardRadiusClass,
  primaryHex,
  apiRequest,
  onCmsUpdated,
  showToast,
}: AdminPanelBaseProps) {
  const isEn = lang === 'en';
  const [noticeTabFilter, setNoticeTabFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [editingNotice, setEditingNotice] = useState<Partial<CmsNotice> | null>(null);
  const [noticeFullTextBn, setNoticeFullTextBn] = useState('');
  const [noticeFullTextEn, setNoticeFullTextEn] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeNoticesCount = useMemo(
    () => cmsData.notices.filter((n) => n.status !== 'archived').length,
    [cmsData.notices],
  );
  const archivedNoticesCount = useMemo(
    () => cmsData.notices.filter((n) => n.status === 'archived').length,
    [cmsData.notices],
  );

  const filteredNotices = useMemo(() => {
    if (noticeTabFilter === 'active') {
      return cmsData.notices.filter((n) => n.status !== 'archived');
    }
    if (noticeTabFilter === 'archived') {
      return cmsData.notices.filter((n) => n.status === 'archived');
    }
    return cmsData.notices;
  }, [cmsData.notices, noticeTabFilter]);

  const openNoticeEditor = (notice?: CmsNotice) => {
    if (notice) {
      setEditingNotice({ ...notice });
      setNoticeFullTextBn(notice.fullTextBn.join('\n\n'));
      setNoticeFullTextEn(notice.fullTextEn.join('\n\n'));
    } else {
      setEditingNotice({
        status: 'active',
        category: 'সাধারণ',
        dateBn: '',
        dateEn: '',
        hijriDateBn: 'জমাদিউস সানি ১৪৪৮ হি.',
        hijriDateEn: 'Jumada al-Thani 1448 AH',
        refNumber: `স্মারক: জা.ই./২০২৬-${cmsData.notices.length + 105}`,
        titleBn: '',
        titleEn: '',
        summaryBn: '',
        summaryEn: '',
        issuedByBn: 'মুহতামিম, ' + cmsData.siteSettings.brandFullBn,
        issuedByEn: 'Muhtamim, ' + cmsData.siteSettings.brandFullEn,
      });
      setNoticeFullTextBn('');
      setNoticeFullTextEn('');
    }
  };

  const handleSaveNotice = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingNotice) return;
    const paragraphsBn = noticeFullTextBn
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const paragraphsEn = noticeFullTextEn
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Partial<CmsNotice> = {
      ...editingNotice,
      fullTextBn: paragraphsBn.length > 0 ? paragraphsBn : [editingNotice.summaryBn ?? ''],
      fullTextEn:
        paragraphsEn.length > 0
          ? paragraphsEn
          : paragraphsBn.length > 0
            ? paragraphsBn
            : [editingNotice.summaryEn || editingNotice.summaryBn || ''],
    };

    if (editingNotice.id) {
      const res = await apiRequest<{ cms: SiteCmsData }>(
        `/api/admin/notices/${editingNotice.id}`,
        'PUT',
        payload,
      );
      if (res?.cms) {
        onCmsUpdated(res.cms);
        setEditingNotice(null);
        showToast('success', isEn ? 'Notice updated.' : 'নোটিশ সফলভাবে হালনাগাদ হয়েছে।');
      }
    } else {
      const res = await apiRequest<{ cms: SiteCmsData }>('/api/admin/notices', 'POST', payload);
      if (res?.cms) {
        onCmsUpdated(res.cms);
        setEditingNotice(null);
        showToast('success', isEn ? 'New notice published.' : 'নতুন নোটিশ সফলভাবে যুক্ত হয়েছে।');
      }
    }
  };

  const handleToggleNoticeArchive = async (notice: CmsNotice) => {
    const nextStatus = notice.status === 'archived' ? 'active' : 'archived';
    const res = await apiRequest<{ cms: SiteCmsData }>(
      `/api/admin/notices/${notice.id}/status`,
      'PATCH',
      { status: nextStatus },
    );
    if (res?.cms) {
      onCmsUpdated(res.cms);
      showToast(
        'success',
        nextStatus === 'archived'
          ? isEn
            ? 'Moved to Previous Notices archive.'
            : 'নোটিশটি পূর্বের সংরক্ষণাগারে রাখা হয়েছে।'
          : isEn
            ? 'Restored to active Notice Board.'
            : 'নোটিশটি পুনরায় প্রকাশ করা হয়েছে।',
      );
    }
  };

  const handleDeleteNotice = async (id: string) => {
    const res = await apiRequest<{ cms: SiteCmsData }>(`/api/admin/notices/${id}`, 'DELETE');
    if (res?.cms) {
      onCmsUpdated(res.cms);
      setConfirmDeleteId(null);
      showToast('success', isEn ? 'Notice permanently deleted.' : 'নোটিশটি স্থায়ীভাবে মুছে ফেলা হয়েছে।');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? 'Notice Board & Saved Archive' : 'নোটিশ বোর্ড ও পূর্বের নোটিশ সংরক্ষণ'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'Add new notices, edit existing ones, or move old notices to the saved archive without deleting them.'
              : 'নতুন নোটিশ যুক্ত করুন অথবা পুরোনো নোটিশ মূল বোর্ড থেকে সরিয়ে পূর্বের সংরক্ষণাগারে সেভ রাখুন।'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNoticeEditor()}
          style={{ backgroundColor: primaryHex }}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{isEn ? 'Add New Notice' : 'নতুন নোটিশ যুক্ত করুন'}</span>
        </button>
      </div>

      {editingNotice && (
        <form
          onSubmit={handleSaveNotice}
          className={`space-y-4 ${cardRadiusClass} border border-[#CBD5E1] bg-white p-5 shadow-xs sm:p-6`}
        >
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="font-serif text-base font-bold text-[#0F172A]">
              {editingNotice.id
                ? isEn
                  ? 'Edit Notice'
                  : 'নোটিশ সম্পাদনা করুন'
                : isEn
                  ? 'Publish New Notice'
                  : 'নতুন নোটিশ তৈরি করুন'}
            </h2>
            <button
              type="button"
              onClick={() => setEditingNotice(null)}
              className="rounded p-1 text-[#475569] hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Category' : 'ক্যাটাগরি'}
              </label>
              <select
                value={editingNotice.category ?? 'সাধারণ'}
                onChange={(e) =>
                  setEditingNotice((prev) => ({
                    ...prev,
                    category: e.target.value as NoticeCategory,
                  }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
              >
                {NOTICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Visibility Status' : 'প্রকাশের অবস্থা'}
              </label>
              <select
                value={editingNotice.status ?? 'active'}
                onChange={(e) =>
                  setEditingNotice((prev) => ({
                    ...prev,
                    status: e.target.value as 'active' | 'archived',
                  }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
              >
                <option value="active">{isEn ? 'Active (Published)' : 'প্রকাশিত (সক্রিয়)'}</option>
                <option value="archived">
                  {isEn ? 'Saved in Previous Archive' : 'পূর্বের নোটিশে সংরক্ষিত'}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Reference Number' : 'স্মারক নম্বর'}
              </label>
              <input
                type="text"
                value={editingNotice.refNumber ?? ''}
                onChange={(e) =>
                  setEditingNotice((prev) => ({ ...prev, refNumber: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Title (Bengali) *' : 'নোটিশের শিরোনাম (বাংলা) *'}
              </label>
              <input
                type="text"
                required
                value={editingNotice.titleBn ?? ''}
                onChange={(e) =>
                  setEditingNotice((prev) => ({ ...prev, titleBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Title (English)' : 'নোটিশের শিরোনাম (ইংরেজি)'}
              </label>
              <input
                type="text"
                value={editingNotice.titleEn ?? ''}
                onChange={(e) =>
                  setEditingNotice((prev) => ({ ...prev, titleEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Summary (Bengali)' : 'সংক্ষিপ্ত সারমর্ম (বাংলা)'}
              </label>
              <textarea
                rows={2}
                value={editingNotice.summaryBn ?? ''}
                onChange={(e) =>
                  setEditingNotice((prev) => ({ ...prev, summaryBn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Summary (English)' : 'সংক্ষিপ্ত সারমর্ম (ইংরেজি)'}
              </label>
              <textarea
                rows={2}
                value={editingNotice.summaryEn ?? ''}
                onChange={(e) =>
                  setEditingNotice((prev) => ({ ...prev, summaryEn: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Full Notice Details (Bengali)' : 'বিস্তারিত নোটিশ (বাংলা)'}
              </label>
              <textarea
                rows={4}
                value={noticeFullTextBn}
                onChange={(e) => setNoticeFullTextBn(e.target.value)}
                placeholder="প্রতি প্যারাগ্রাফ নতুন লাইনে লিখুন..."
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A]">
                {isEn ? 'Full Notice Details (English)' : 'বিস্তারিত নোটিশ (ইংরেজি)'}
              </label>
              <textarea
                rows={4}
                value={noticeFullTextEn}
                onChange={(e) => setNoticeFullTextEn(e.target.value)}
                placeholder="Write paragraphs separated by line breaks..."
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingNotice(null)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium text-[#475569]"
            >
              {isEn ? 'Cancel' : 'বাতিল'}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: primaryHex }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isEn ? 'Save Notice' : 'নোটিশ সেভ করুন'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            {
              id: 'all',
              bn: `সকল (${formatDigits(cmsData.notices.length, 'bn')})`,
              en: `All (${cmsData.notices.length})`,
            },
            {
              id: 'active',
              bn: `প্রকাশিত (${formatDigits(activeNoticesCount, 'bn')})`,
              en: `Active (${activeNoticesCount})`,
            },
            {
              id: 'archived',
              bn: `পূর্বের সংরক্ষিত (${formatDigits(archivedNoticesCount, 'bn')})`,
              en: `Saved Previous (${archivedNoticesCount})`,
            },
          ] as const
        ).map((tab) => {
          const isActive = noticeTabFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setNoticeTabFilter(tab.id)}
              style={isActive ? { backgroundColor: primaryHex } : undefined}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? 'text-white'
                  : 'border border-[#E2E8F0] bg-white text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {isEn ? tab.en : tab.bn}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filteredNotices.map((notice) => {
          const isArchived = notice.status === 'archived';
          return (
            <div
              key={notice.id}
              className={`flex flex-col justify-between gap-4 ${cardRadiusClass} border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:p-5`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                      isArchived
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-[#ECFDF5] text-[#065F46]'
                    }`}
                  >
                    {isArchived
                      ? isEn
                        ? 'Saved Archive'
                        : 'পূর্বের সংরক্ষিত'
                      : isEn
                        ? 'Active'
                        : 'প্রকাশিত'}
                  </span>
                  <span className="font-medium text-[#B45309]">{notice.category}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[#475569]">
                    {isEn ? notice.dateEn : notice.dateBn}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[#475569]">{notice.refNumber}</span>
                </div>
                <h3 className="mt-1.5 font-serif text-base font-bold text-[#0F172A]">
                  {isEn ? notice.titleEn : notice.titleBn}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-[#475569]">
                  {isEn ? notice.summaryEn : notice.summaryBn}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openNoticeEditor(notice)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:border-[#065F46]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{isEn ? 'Edit' : 'সম্পাদনা'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleNoticeArchive(notice)}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      <span>{isEn ? 'Restore Active' : 'পুনরায় প্রকাশ'}</span>
                    </>
                  ) : (
                    <>
                      <Archive className="h-3.5 w-3.5" />
                      <span>{isEn ? 'Save to Archive' : 'পূর্বের নোটিশে রাখুন'}</span>
                    </>
                  )}
                </button>

                {confirmDeleteId === notice.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      {isEn ? 'Confirm' : 'নিশ্চিত'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-xs"
                    >
                      {isEn ? 'No' : 'না'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(notice.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isEn ? 'Delete' : 'মুছুন'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
