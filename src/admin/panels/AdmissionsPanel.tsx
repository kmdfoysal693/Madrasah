import { useMemo, useState } from 'react';
import { ClipboardList, Download, Printer, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import type { AdmissionStatus, StoredAdmissionRecord } from '../../data/cmsTypes';
import type { AdmissionSubmission, ResidentialType } from '../../data/madrasaData';
import { formatDigits, type Language } from '../../data/madrasaTranslations';
import type { AdminApiRequestFn } from '../types';

const ADMISSION_STATUS_META: Record<
  AdmissionStatus,
  { bn: string; en: string; badgeClass: string }
> = {
  pending: {
    bn: 'অপেক্ষমাণ',
    en: 'Pending',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  interview: {
    bn: 'সাক্ষাৎকার',
    en: 'Interview',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  approved: {
    bn: 'অনুমোদিত',
    en: 'Approved',
    badgeClass: 'border-emerald-200 bg-[#ECFDF5] text-[#065F46]',
  },
  rejected: {
    bn: 'বাতিল',
    en: 'Rejected',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
  },
};

interface AdmissionsPanelProps {
  admissions: StoredAdmissionRecord[];
  admissionsLoading: boolean;
  noteDrafts: Record<string, string>;
  lang: Language;
  saving: boolean;
  cardRadiusClass: string;
  primaryHex: string;
  onChangeNoteDraft: (id: string, value: string) => void;
  onRefresh: () => void;
  onAdmissionsUpdated: (next: StoredAdmissionRecord[]) => void;
  onViewAdmissionReceipt: (submission: AdmissionSubmission) => void;
  apiRequest: AdminApiRequestFn;
  showToast: (type: 'success' | 'error', text: string) => void;
}

export function AdmissionsPanel({
  admissions,
  admissionsLoading,
  noteDrafts,
  lang,
  saving,
  cardRadiusClass,
  primaryHex,
  onChangeNoteDraft,
  onRefresh,
  onAdmissionsUpdated,
  onViewAdmissionReceipt,
  apiRequest,
  showToast,
}: AdmissionsPanelProps) {
  const isEn = lang === 'en';
  const [admissionSearch, setAdmissionSearch] = useState('');
  const [admissionStatusFilter, setAdmissionStatusFilter] = useState<'all' | AdmissionStatus>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredAdmissions = useMemo(() => {
    const q = admissionSearch.trim().toLowerCase();
    return admissions.filter((a) => {
      if (admissionStatusFilter !== 'all' && a.status !== admissionStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        a.studentName.toLowerCase().includes(q) ||
        a.fatherName.toLowerCase().includes(q) ||
        a.trackingId.toLowerCase().includes(q) ||
        a.mobile.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q)
      );
    });
  }, [admissions, admissionSearch, admissionStatusFilter]);

  const handleUpdateStatus = async (
    id: string,
    status: AdmissionStatus,
    adminNote?: string,
  ) => {
    const res = await apiRequest<{ admissions: StoredAdmissionRecord[] }>(
      `/api/admin/admissions/${id}`,
      'PATCH',
      { status, adminNote },
    );
    if (res?.admissions) {
      onAdmissionsUpdated(res.admissions);
      showToast(
        'success',
        isEn ? 'Application status updated.' : 'আবেদনের অবস্থা সংরক্ষিত হয়েছে।',
      );
    }
  };

  const handleDeleteAdmission = async (id: string) => {
    const res = await apiRequest<{ admissions: StoredAdmissionRecord[] }>(
      `/api/admin/admissions/${id}`,
      'DELETE',
    );
    if (res?.admissions) {
      onAdmissionsUpdated(res.admissions);
      setConfirmDeleteId(null);
      showToast('success', isEn ? 'Admission record deleted.' : 'ভর্তি আবেদন মুছে ফেলা হয়েছে।');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Tracking ID',
      'Submitted At',
      'Student Name',
      'Father Name',
      'DOB',
      'Department',
      'Class',
      'Residential Type',
      'Mobile',
      'Address',
      'Status',
      'Admin Note',
    ];
    const escapeCell = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = filteredAdmissions.map((a) =>
      [
        a.trackingId,
        a.submittedAt,
        a.studentName,
        a.fatherName,
        a.dateOfBirth,
        a.department,
        a.className,
        a.residentialType,
        a.mobile,
        a.address,
        a.status,
        a.adminNote,
      ]
        .map(escapeCell)
        .join(','),
    );
    const csv = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `madrasa-admissions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? 'Online Student Admissions' : 'অনলাইন ভর্তি আবেদনসমূহ'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'All online applications submitted on the website are stored here.'
              : 'ওয়েবসাইটের অনলাইন ভর্তি ফরম থেকে জমা হওয়া সকল শিক্ষার্থীর তথ্য এখানে সংরক্ষিত আছে।'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] hover:border-[#065F46]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isEn ? 'Refresh' : 'রিফ্রেশ'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredAdmissions.length === 0}
            style={{ backgroundColor: primaryHex }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isEn ? 'Export CSV' : 'CSV ডাউনলোড'}</span>
          </button>
        </div>
      </div>

      <div
        className={`flex flex-col gap-3 ${cardRadiusClass} border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={admissionSearch}
            onChange={(e) => setAdmissionSearch(e.target.value)}
            placeholder={
              isEn
                ? 'Search by name, ID, mobile, or dept...'
                : 'নাম, ট্র্যাকিং আইডি, মোবাইল দিয়ে খুঁজুন...'
            }
            className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'pending', 'interview', 'approved', 'rejected'] as const).map((statusKey) => (
            <button
              key={statusKey}
              type="button"
              onClick={() => setAdmissionStatusFilter(statusKey)}
              style={
                admissionStatusFilter === statusKey ? { backgroundColor: primaryHex } : undefined
              }
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                admissionStatusFilter === statusKey
                  ? 'text-white'
                  : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {statusKey === 'all'
                ? isEn
                  ? 'All'
                  : 'সকল'
                : isEn
                  ? ADMISSION_STATUS_META[statusKey].en
                  : ADMISSION_STATUS_META[statusKey].bn}
            </button>
          ))}
        </div>
      </div>

      {admissionsLoading ? (
        <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-10 text-center text-sm text-[#475569]`}>
          {isEn ? 'Loading admission submissions...' : 'ভর্তি আবেদন লোড হচ্ছে...'}
        </div>
      ) : filteredAdmissions.length === 0 ? (
        <div className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-10 text-center`}>
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <p className="mt-3 font-serif text-base font-semibold text-[#0F172A]">
            {isEn ? 'No Admission Applications Found' : 'এখনো কোনো ভর্তি আবেদন পাওয়া যায়নি'}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            {isEn
              ? 'When students submit the online admission form on the website, their records will appear here automatically.'
              : 'ওয়েবসাইটের অনলাইন ভর্তি ফরম থেকে কোনো শিক্ষার্থী আবেদন করলে তার সকল তথ্য এখানে জমা হবে।'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAdmissions.map((adm) => {
            const meta = ADMISSION_STATUS_META[adm.status] ?? ADMISSION_STATUS_META.pending;
            return (
              <div
                key={adm.id}
                className={`${cardRadiusClass} border border-[#E2E8F0] bg-white p-4 sm:p-5`}
              >
                <div className="flex flex-col justify-between gap-3 border-b border-[#E2E8F0] pb-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold" style={{ color: primaryHex }}>
                        {adm.trackingId}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[#475569] tabular-nums">{adm.submittedAt}</span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                      >
                        {isEn ? meta.en : meta.bn}
                      </span>
                    </div>
                    <h3 className="mt-1 font-serif text-base font-bold text-[#0F172A]">
                      {adm.studentName}{' '}
                      <span className="text-xs font-normal text-[#475569]">
                        ({isEn ? 'Father:' : 'পিতা:'} {adm.fatherName})
                      </span>
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onViewAdmissionReceipt({
                          trackingId: adm.trackingId,
                          submittedAt: adm.submittedAt,
                          studentName: adm.studentName,
                          fatherName: adm.fatherName,
                          dateOfBirth: adm.dateOfBirth,
                          department: adm.department,
                          departmentId: adm.departmentId,
                          className: adm.className,
                          classIndex: adm.classIndex,
                          residentialType: adm.residentialType as ResidentialType,
                          residentialKey: adm.residentialKey,
                          mobile: adm.mobile,
                          address: adm.address,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:border-[#065F46] hover:text-[#065F46]"
                    >
                      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isEn ? 'Receipt' : 'রশিদ'}</span>
                    </button>

                    {confirmDeleteId === adm.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteAdmission(adm.id)}
                          className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          {isEn ? 'Confirm Delete' : 'নিশ্চিত মুছুন'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-xs text-[#475569]"
                        >
                          {isEn ? 'Cancel' : 'বাতিল'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(adm.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isEn ? 'Delete' : 'মুছুন'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[#475569] sm:grid-cols-2 lg:grid-cols-4">
                  <p>
                    <span className="font-semibold text-[#0F172A]">
                      {isEn ? 'Department:' : 'বিভাগ:'}
                    </span>{' '}
                    {adm.department}
                  </p>
                  <p>
                    <span className="font-semibold text-[#0F172A]">
                      {isEn ? 'Class:' : 'ক্লাস / জামাত:'}
                    </span>{' '}
                    {adm.className}
                  </p>
                  <p>
                    <span className="font-semibold text-[#0F172A]">
                      {isEn ? 'Residence:' : 'আবাসন:'}
                    </span>{' '}
                    {adm.residentialType}
                  </p>
                  <p className="tabular-nums">
                    <span className="font-semibold text-[#0F172A]">
                      {isEn ? 'Mobile:' : 'মোবাইল:'}
                    </span>{' '}
                    {formatDigits(adm.mobile, lang)}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold text-[#0F172A]">
                      {isEn ? 'Address:' : 'ঠিকানা:'}
                    </span>{' '}
                    {adm.address}
                  </p>
                  {adm.dateOfBirth && (
                    <p className="tabular-nums">
                      <span className="font-semibold text-[#0F172A]">
                        {isEn ? 'DOB:' : 'জন্ম তারিখ:'}
                      </span>{' '}
                      {adm.dateOfBirth}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
                  <select
                    aria-label={isEn ? 'Admission status' : 'আবেদনের অবস্থা'}
                    value={adm.status}
                    onChange={(e) =>
                      handleUpdateStatus(
                        adm.id,
                        e.target.value as AdmissionStatus,
                        noteDrafts[adm.id] ?? adm.adminNote,
                      )
                    }
                    className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                  >
                    <option value="pending">{isEn ? 'Pending' : 'অপেক্ষমাণ'}</option>
                    <option value="interview">{isEn ? 'Interview' : 'সাক্ষাৎকার'}</option>
                    <option value="approved">{isEn ? 'Approved' : 'অনুমোদিত'}</option>
                    <option value="rejected">{isEn ? 'Rejected' : 'বাতিল'}</option>
                  </select>

                  <input
                    type="text"
                    value={noteDrafts[adm.id] ?? ''}
                    onChange={(e) => onChangeNoteDraft(adm.id, e.target.value)}
                    placeholder={
                      isEn
                        ? 'Add office note (interview date, remarks)...'
                        : 'অফিস নোট লিখুন (যেমন: সাক্ষাৎকারের তারিখ)...'
                    }
                    className="flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                  />

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      handleUpdateStatus(adm.id, adm.status, noteDrafts[adm.id] ?? '')
                    }
                    style={{ backgroundColor: primaryHex }}
                    className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isEn ? 'Save Note' : 'নোট সেভ'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
