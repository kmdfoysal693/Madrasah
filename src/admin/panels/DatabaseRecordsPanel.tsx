import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Download, RefreshCw, Search } from 'lucide-react';
import { formatDigits, type Language } from '../../data/madrasaTranslations';

interface UnifiedRecordRow {
  id: number;
  recordType: string;
  referenceCode: string;
  name: string;
  fatherName: string;
  mobile: string;
  email: string;
  passwordHash: string;
  dateOfBirth: string;
  department: string;
  className: string;
  residentialType: string;
  address: string;
  status: string;
  firebaseUid: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface DatabaseRecordsPanelProps {
  adminToken: string;
  lang: Language;
  cardRadiusClass: string;
  primaryHex: string;
  onLogout: () => void;
  showToast: (type: 'success' | 'error', text: string) => void;
}

export function DatabaseRecordsPanel({
  adminToken,
  lang,
  cardRadiusClass,
  primaryHex,
  onLogout,
  showToast,
}: DatabaseRecordsPanelProps) {
  const isEn = lang === 'en';
  const [records, setRecords] = useState<UnifiedRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'admission' | 'login'>('all');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/records', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      const data = (await res.json()) as { records?: UnifiedRecordRow[]; error?: string };
      if (res.ok && Array.isArray(data.records)) {
        setRecords(data.records);
      } else {
        showToast('error', data.error ?? (isEn ? 'Failed to load records.' : 'রেকর্ড লোড করা যায়নি।'));
      }
    } catch {
      showToast('error', isEn ? 'Failed to load records.' : 'ডাটাবেজ রেকর্ড লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }, [adminToken, isEn, onLogout, showToast]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (typeFilter === 'admission' && r.recordType !== 'online_admission') {
        return false;
      }
      if (
        typeFilter === 'login' &&
        r.recordType !== 'student_account' &&
        r.recordType !== 'google_signin'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.fatherName.toLowerCase().includes(q) ||
        r.mobile.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.referenceCode.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    });
  }, [records, search, typeFilter]);

  const handleDownloadCsv = async () => {
    try {
      const res = await fetch('/api/admin/records.csv', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) {
        showToast('error', isEn ? 'Failed to export CSV.' : 'CSV ফাইল ডাউনলোড করা যায়নি।');
        return;
      }
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `madrasa-all-records-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast('error', isEn ? 'Failed to export CSV.' : 'CSV ফাইল ডাউনলোড করা যায়নি।');
    }
  };

  const formatRecordTypeLabel = (type: string) => {
    if (type === 'online_admission') {
      return isEn ? 'Online Form' : 'অনলাইন ভর্তি';
    }
    if (type === 'google_signin') {
      return isEn ? 'Google Login' : 'Google লগইন';
    }
    return isEn ? 'Student Login' : 'ছাত্র রেজিস্ট্রেশন';
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat(isEn ? 'en-US' : 'bn-BD', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 16).replace('T', ' ');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0F172A]">
            {isEn ? 'All Database Records (Forms & Logins)' : 'সকল ডাটাবেজ রেকর্ড ও স্প্রেডশিট'}
          </h1>
          <p className="mt-1 text-xs text-[#475569] sm:text-sm">
            {isEn
              ? 'Every online admission form and student registration/login saved with Name, Father Name, Mobile, Email, and Password in separate columns.'
              : 'অনলাইন ফরম পূরণকারী ও লগইনকৃত সবার নাম, পিতার নাম, মোবাইল, ইমেইল ও পাসওয়ার্ড আলাদা সারিতে ও কলামে এখানে সংরক্ষিত আছে।'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchRecords}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] hover:border-[#065F46]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isEn ? 'Refresh' : 'রিফ্রেশ'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            style={{ backgroundColor: primaryHex }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isEn ? 'Download CSV File' : 'CSV ফাইল ডাউনলোড'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isEn
                ? 'Search name, father, mobile, email...'
                : 'নাম, পিতার নাম, মোবাইল বা ইমেইল খুঁজুন...'
            }
            className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#065F46] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all' as const, bn: 'সকল রেকর্ড', en: 'All' },
            { id: 'admission' as const, bn: 'অনলাইন ভর্তি', en: 'Online Forms' },
            { id: 'login' as const, bn: 'লগইন ও রেজিস্ট্রেশন', en: 'Logins & Accounts' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              style={typeFilter === tab.id ? { backgroundColor: primaryHex } : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === tab.id
                  ? 'text-white'
                  : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {isEn ? tab.en : tab.bn}
            </button>
          ))}
        </div>
      </div>

      {/* Records Spreadsheet Table */}
      <div className={`${cardRadiusClass} overflow-hidden border border-[#E2E8F0] bg-white`}>
        {loading ? (
          <div className="p-10 text-center text-sm text-[#475569]">
            {isEn ? 'Loading database records...' : 'ডাটাবেজ রেকর্ড লোড হচ্ছে...'}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <Database className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="mt-3 font-serif text-base font-semibold text-[#0F172A]">
              {isEn ? 'No Saved Records Yet' : 'এখনো কোনো রেকর্ড জমা হয়নি'}
            </p>
            <p className="mt-1 text-xs text-[#475569]">
              {isEn
                ? 'Records appear automatically whenever someone submits an admission form or logs in.'
                : 'কেউ অনলাইন ভর্তি ফরম পূরণ করলে বা লগইন করলে সাথে সাথে এখানে সারি আকারে দেখা যাবে।'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#E2E8F0] text-left text-xs">
              <thead className="bg-[#F8FAFC] font-semibold text-[#0F172A]">
                <tr>
                  <th className="whitespace-nowrap px-3.5 py-3">{isEn ? 'Type' : 'ধরন'}</th>
                  <th className="whitespace-nowrap px-3.5 py-3">{isEn ? 'Ref / Roll' : 'আইডি / রোল'}</th>
                  <th className="whitespace-nowrap px-3.5 py-3">{isEn ? 'Name' : 'নাম'}</th>
                  <th className="whitespace-nowrap px-3.5 py-3">{isEn ? 'Father Name' : 'পিতার নাম'}</th>
                  <th className="whitespace-nowrap px-3.5 py-3">{isEn ? 'Mobile' : 'মোবাইল'}</th>
                  <th className="whitespace-nowrap px-3.5 py-3">{isEn ? 'Email' : 'ইমেইল'}</th>
                  <th className="whitespace-nowrap px-3.5 py-3">
                    {isEn ? 'Password (Hash)' : 'পাসওয়ার্ড (হ্যাশ)'}
                  </th>
                  <th className="whitespace-nowrap px-3.5 py-3">
                    {isEn ? 'Department / Class' : 'বিভাগ ও ক্লাস'}
                  </th>
                  <th className="whitespace-nowrap px-3.5 py-3">
                    {isEn ? 'Created / Last Login' : 'তারিখ ও লগইন'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] bg-white text-[#334155]">
                {filteredRecords.map((row) => (
                  <tr key={`${row.referenceCode}-${row.id}`} className="hover:bg-[#F8FAFC]">
                    <td className="whitespace-nowrap px-3.5 py-3">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          row.recordType === 'online_admission'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-[#ECFDF5] text-[#065F46]'
                        }`}
                      >
                        {formatRecordTypeLabel(row.recordType)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 font-mono text-[11px] font-semibold text-[#065F46]">
                      {row.referenceCode}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 font-semibold text-[#0F172A]">
                      {row.name}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3">
                      {row.fatherName || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 tabular-nums">
                      {row.mobile ? formatDigits(row.mobile, lang) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3">
                      {row.email || '—'}
                    </td>
                    <td
                      className="max-w-[170px] truncate px-3.5 py-3 font-mono text-[11px] text-[#64748B]"
                      title={row.passwordHash || ''}
                    >
                      {row.passwordHash || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3">
                      <span className="font-medium text-[#0F172A]">{row.department || '—'}</span>
                      {row.className ? (
                        <span className="block text-[11px] text-[#64748B]">{row.className}</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 text-[11px] tabular-nums text-[#475569]">
                      <div>{formatDateTime(row.createdAt)}</div>
                      {row.lastLoginAt && (
                        <div className="text-[#065F46]">
                          {isEn ? 'Login: ' : 'লগইন: '}
                          {formatDateTime(row.lastLoginAt)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
