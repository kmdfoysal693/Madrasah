import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Printer,
} from 'lucide-react';
import {
  NOTICES,
  type NoticeCategory,
  type NoticeItem,
} from '../data/madrasaData';
import {
  formatDigits,
  NOTICE_CATEGORY_EN,
  NOTICES_EN,
  translatePortalValue,
  UI_COPY,
  type Language,
} from '../data/madrasaTranslations';
import type { StudentDashboardPayload, TuitionRecord } from '../data/studentPortalData';
import { LanguageToggle } from './LanguageToggle';
import { NoticeModal } from './NoticeModal';

interface StudentDashboardProps {
  token: string;
  lang: Language;
  notices?: NoticeItem[];
  brandShort?: string;
  onChangeLang: (lang: Language) => void;
  onBackToSite: () => void;
  onLogout: () => void;
}

type DashboardSection = 'overview' | 'notices' | 'tuition' | 'routine' | 'results';

export function StudentDashboard({
  token,
  lang,
  notices,
  brandShort,
  onChangeLang,
  onBackToSite,
  onLogout,
}: StudentDashboardProps) {
  const copy = UI_COPY[lang];
  const d = copy.dashboard;

  const [activeTab, setActiveTab] = useState<DashboardSection>('overview');
  const [payload, setPayload] = useState<StudentDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState('');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [noticeFilter, setNoticeFilter] = useState<'সকল' | NoticeCategory>('সকল');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const navItems: { id: DashboardSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: d.nav.overview, icon: LayoutDashboard },
    { id: 'notices', label: d.nav.notices, icon: Bell },
    { id: 'tuition', label: d.nav.tuition, icon: CreditCard },
    { id: 'routine', label: d.nav.routine, icon: CalendarDays },
    { id: 'results', label: d.nav.results, icon: Award },
  ];

  const allNotices: NoticeItem[] = useMemo(
    () => (notices && notices.length > 0 ? notices : lang === 'en' ? NOTICES_EN : NOTICES),
    [notices, lang],
  );

  const selectedNotice = useMemo(
    () => allNotices.find((n) => n.id === selectedNoticeId) ?? null,
    [allNotices, selectedNoticeId],
  );

  useEffect(() => {
    if (!selectedNotice) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedNotice]);

  useEffect(() => {
    let cancelled = false;
    async function fetchDashboard() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/student/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          onLogoutRef.current();
          return;
        }
        const data = (await res.json()) as StudentDashboardPayload & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? d.loadErrorTitle);
        }
        if (!cancelled) {
          setPayload(data);
          if (data.examResults.length > 0) {
            setSelectedTermId(data.examResults[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : d.loadErrorTitle);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, [token, d.loadErrorTitle]);

  const tuitionStats = useMemo(() => {
    const records = payload?.tuitionRecords ?? [];
    const totalPaid = records
      .filter((r) => r.status === 'পরিশোধিত')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalDue = records
      .filter((r) => r.status === 'বকেয়া')
      .reduce((sum, r) => sum + r.amount, 0);
    const paidMonths = records.filter((r) => r.status === 'পরিশোধিত').length;
    const dueMonths = records.filter((r) => r.status === 'বকেয়া').length;
    return { totalPaid, totalDue, paidMonths, dueMonths };
  }, [payload]);

  const filteredNotices = useMemo(() => {
    return noticeFilter === 'সকল'
      ? allNotices
      : allNotices.filter((n) => n.category === noticeFilter);
  }, [allNotices, noticeFilter]);

  const activeResultTerm = useMemo(() => {
    if (!payload?.examResults.length) return null;
    return (
      payload.examResults.find((t) => t.id === selectedTermId) ?? payload.examResults[0]
    );
  }, [payload, selectedTermId]);

  const termTotals = useMemo(() => {
    if (!activeResultTerm) return { totalFull: 0, totalObtained: 0, percentage: '0' };
    const totalFull = activeResultTerm.subjects.reduce((s, item) => s + item.fullMarks, 0);
    const totalObtained = activeResultTerm.subjects.reduce(
      (s, item) => s + item.obtainedMarks,
      0,
    );
    const pct = totalFull > 0 ? Math.round((totalObtained / totalFull) * 100) : 0;
    return { totalFull, totalObtained, percentage: formatDigits(pct, lang) };
  }, [activeResultTerm, lang]);

  const handlePayTuition = async (record: TuitionRecord) => {
    if (record.status === 'পরিশোধিত') return;
    setPayingId(record.id);
    setPayError('');
    try {
      const res = await fetch('/api/student/tuition/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recordId: record.id }),
      });
      if (res.status === 401) {
        onLogoutRef.current();
        return;
      }
      const data = (await res.json()) as { tuitionRecords?: TuitionRecord[]; error?: string };
      if (!res.ok || !data.tuitionRecords) {
        setPayError(data.error ?? copy.auth.errNetwork);
        return;
      }
      setPayload((prev) =>
        prev ? { ...prev, tuitionRecords: data.tuitionRecords! } : prev,
      );
    } catch {
      setPayError(copy.auth.errNetwork);
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <header className="border-b border-[#E2E8F0] bg-white px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-200" />
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-28 animate-pulse rounded-xl border border-[#E2E8F0] bg-white"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
        <div className="max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
          <h2 className="mt-4 font-serif text-xl font-bold text-[#0F172A]">
            {d.loadErrorTitle}
          </h2>
          <p className="mt-2 text-sm text-[#475569]">{error}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBackToSite}
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              {d.backHomeBtn}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg bg-[#065F46] px-4 py-2 text-sm font-medium text-white hover:bg-[#047857]"
            >
              {d.reloginBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { student } = payload;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Portal Header */}
      <header className="no-print sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <GraduationCap className="h-6 w-6 shrink-0 text-[#065F46]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate font-serif text-sm font-bold text-[#0F172A] sm:text-base">
                {brandShort
                  ? lang === 'en'
                    ? `${brandShort} · Student Dashboard`
                    : `${brandShort} · ছাত্র ড্যাশবোর্ড`
                  : d.headerTitle}
              </p>
              <p className="truncate text-xs text-[#475569] tabular-nums">
                {student.name} · {d.idPrefix} {student.studentRoll}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle lang={lang} onChange={onChangeLang} />
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] whitespace-nowrap shrink-0 sm:px-3.5 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{d.backToSite}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#065F46] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#047857] whitespace-nowrap shrink-0 sm:px-3.5 sm:text-sm"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{d.logout}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Sidebar Navigation */}
          <aside className="no-print lg:col-span-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
              <div className="border-b border-[#E2E8F0] pb-4">
                <p className="text-xs font-medium text-[#B45309]">
                  {translatePortalValue(student.session, lang)}
                </p>
                <h1 className="mt-1 font-serif text-lg font-bold text-[#0F172A]">
                  {student.name}
                </h1>
                <p className="mt-0.5 text-xs text-[#475569]">
                  {translatePortalValue(student.className, lang)}
                </p>
                <p className="mt-1 text-xs font-medium text-[#065F46] tabular-nums">
                  {d.mobilePrefix} {formatDigits(student.phone, lang)}
                </p>
              </div>

              <nav aria-label={d.headerTitle} className="mt-4 flex flex-wrap gap-1.5 lg:flex-col">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#065F46] text-white'
                          : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Dashboard Content */}
          <main className="lg:col-span-9">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 4 KPI Summary Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    <p className="text-xs text-[#475569]">{d.kpiPaid}</p>
                    <p className="mt-2 font-serif text-2xl font-bold text-[#065F46] tabular-nums">
                      ৳ {formatDigits(tuitionStats.totalPaid, lang)}
                    </p>
                    <p className="mt-1 text-xs text-[#475569] tabular-nums">
                      {d.kpiPaidSub(formatDigits(tuitionStats.paidMonths, lang))}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    <p className="text-xs text-[#475569]">{d.kpiDue}</p>
                    <p className="mt-2 font-serif text-2xl font-bold text-[#B45309] tabular-nums">
                      ৳ {formatDigits(tuitionStats.totalDue, lang)}
                    </p>
                    <p className="mt-1 text-xs text-[#475569] tabular-nums">
                      {d.kpiDueSub(formatDigits(tuitionStats.dueMonths, lang))}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    <p className="text-xs text-[#475569]">{d.kpiNextExam}</p>
                    <p className="mt-2 font-serif text-xl font-bold text-[#0F172A] tabular-nums">
                      {d.kpiNextExamDate}
                    </p>
                    <p className="mt-1 text-xs text-[#475569]">{d.kpiNextExamSub}</p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    <p className="text-xs text-[#475569]">{d.kpiLatestResult}</p>
                    <p className="mt-2 font-serif text-xl font-bold text-[#065F46]">
                      {translatePortalValue(activeResultTerm?.overallGrade ?? 'মুমতায', lang)}
                    </p>
                    <p className="mt-1 text-xs text-[#475569]">
                      {activeResultTerm
                        ? translatePortalValue(activeResultTerm.meritPosition, lang)
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Quick Preview: Recent Notices + Next Exam */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                      <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                        {d.recentNotices}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('notices')}
                        className="text-xs font-semibold text-[#065F46] hover:underline"
                      >
                        {d.viewAll}
                      </button>
                    </div>
                    <div className="mt-4 divide-y divide-[#E2E8F0]">
                      {allNotices.slice(0, 3).map((notice) => (
                        <div key={notice.id} className="py-3 first:pt-0 last:pb-0">
                          <p className="text-xs text-[#475569] tabular-nums">
                            <span className="font-semibold text-[#065F46]">
                              {lang === 'en'
                                ? NOTICE_CATEGORY_EN[notice.category]
                                : notice.category}
                            </span>{' '}
                            · {notice.date}
                          </p>
                          <button
                            type="button"
                            onClick={() => setSelectedNoticeId(notice.id)}
                            className="mt-1 text-left text-sm font-medium text-[#0F172A] hover:text-[#065F46]"
                          >
                            {notice.title}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                      <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                        {d.upcomingRoutine}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('routine')}
                        className="text-xs font-semibold text-[#065F46] hover:underline"
                      >
                        {d.fullRoutine}
                      </button>
                    </div>
                    <div className="mt-4 divide-y divide-[#E2E8F0]">
                      {payload.examRoutine.slice(0, 3).map((exam) => (
                        <div key={exam.id} className="py-3 first:pt-0 last:pb-0">
                          <p className="text-xs text-[#B45309] tabular-nums">
                            {translatePortalValue(exam.date, lang)} ·{' '}
                            {translatePortalValue(exam.time, lang)}
                          </p>
                          <p className="mt-1 text-sm font-medium text-[#0F172A]">
                            {translatePortalValue(exam.subject, lang)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notices' && (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                      {d.studentNoticeBoard}
                    </h2>
                    <p className="mt-1 text-xs text-[#475569]">{d.studentNoticeSub}</p>
                  </div>

                  <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                    {copy.noticeFilters.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setNoticeFilter(tab.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          noticeFilter === tab.id
                            ? 'bg-[#065F46] text-white'
                            : 'text-[#475569] hover:text-[#0F172A]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 divide-y divide-[#E2E8F0]">
                  {filteredNotices.map((notice) => (
                    <div
                      key={notice.id}
                      className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="text-xs text-[#475569] tabular-nums">
                          <span className="font-semibold text-[#065F46]">
                            {lang === 'en'
                              ? NOTICE_CATEGORY_EN[notice.category]
                              : notice.category}
                          </span>{' '}
                          · {notice.date} · {notice.refNumber}
                        </p>
                        <h3 className="mt-1 font-serif text-base font-semibold text-[#0F172A]">
                          {notice.title}
                        </h3>
                        <p className="mt-1 text-sm text-[#475569]">{notice.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedNoticeId(notice.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#065F46] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{copy.noticeViewDetails}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tuition' && (
              <div className="printable-area rounded-xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                      {d.tuitionHeading}
                    </h2>
                    <p className="mt-1 text-xs text-[#475569] tabular-nums">
                      {student.name} · {d.idPrefix} {student.studentRoll}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
                  >
                    <Printer className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    <span>{d.tuitionPrint}</span>
                  </button>
                </div>

                {payError && (
                  <div
                    role="alert"
                    className="no-print mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
                  >
                    {payError}
                  </div>
                )}

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                    <span className="text-xs text-[#475569]">{d.tuitionTotalPaid}</span>
                    <span className="ml-2 font-serif text-base font-bold text-[#065F46] tabular-nums">
                      ৳ {formatDigits(tuitionStats.totalPaid, lang)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                    <span className="text-xs text-[#475569]">{d.tuitionTotalDue}</span>
                    <span className="ml-2 font-serif text-base font-bold text-[#B45309] tabular-nums">
                      ৳ {formatDigits(tuitionStats.totalDue, lang)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                        <th className="py-3 pr-4">{d.colMonth}</th>
                        <th className="py-3 pr-4">{d.colFeeDesc}</th>
                        <th className="py-3 pr-4 text-right">{d.colAmount}</th>
                        <th className="py-3 pr-4">{d.colPaidDate}</th>
                        <th className="py-3 pr-4">{d.colReceiptNo}</th>
                        <th className="py-3 pr-4">{d.colStatus}</th>
                        <th className="no-print py-3 text-right">{d.colAction}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {payload.tuitionRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-[#F8FAFC]/60">
                          <td className="py-3.5 pr-4 font-medium text-[#0F172A] whitespace-nowrap">
                            {translatePortalValue(record.month, lang)}
                          </td>
                          <td className="py-3.5 pr-4 text-[#475569]">
                            {translatePortalValue(record.feeType, lang)}
                          </td>
                          <td className="py-3.5 pr-4 text-right font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
                            ৳ {formatDigits(record.amount, lang)}
                          </td>
                          <td className="py-3.5 pr-4 text-[#475569] tabular-nums whitespace-nowrap">
                            {translatePortalValue(record.paidDate, lang)}
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-xs text-[#475569] tabular-nums whitespace-nowrap">
                            {record.receiptNo}
                          </td>
                          <td className="py-3.5 pr-4 whitespace-nowrap">
                            {record.status === 'পরিশোধিত' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#065F46]">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{d.statusPaid}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
                                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{d.statusDue}</span>
                              </span>
                            )}
                          </td>
                          <td className="no-print py-3.5 text-right whitespace-nowrap">
                            {record.status === 'বকেয়া' ? (
                              <button
                                type="button"
                                disabled={payingId === record.id}
                                onClick={() => handlePayTuition(record)}
                                className="rounded-md bg-[#065F46] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#047857] disabled:opacity-60"
                              >
                                {payingId === record.id ? d.paying : d.payNow}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">{d.done}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'routine' && (
              <div className="printable-area rounded-xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                      {d.routineHeading}
                    </h2>
                    <p className="mt-1 text-xs text-[#475569]">
                      {d.jamatPrefix} {translatePortalValue(student.className, lang)} ·{' '}
                      {d.sessionPrefix} {translatePortalValue(student.session, lang)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
                  >
                    <Printer className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    <span>{d.routinePrint}</span>
                  </button>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                        <th className="py-3 pr-4">{d.colDateDay}</th>
                        <th className="py-3 pr-4">{d.colTime}</th>
                        <th className="py-3 pr-4">{d.colSubject}</th>
                        <th className="py-3 pr-4">{d.colCode}</th>
                        <th className="py-3">{d.colHallSeat}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {payload.examRoutine.map((exam) => (
                        <tr key={exam.id} className="hover:bg-[#F8FAFC]/60">
                          <td className="py-3.5 pr-4 whitespace-nowrap">
                            <p className="font-medium text-[#0F172A] tabular-nums">
                              {translatePortalValue(exam.date, lang)}
                            </p>
                            <p className="text-xs text-[#475569]">
                              {translatePortalValue(exam.day, lang)}
                            </p>
                          </td>
                          <td className="py-3.5 pr-4 text-[#475569] tabular-nums whitespace-nowrap">
                            {translatePortalValue(exam.time, lang)}
                          </td>
                          <td className="py-3.5 pr-4 font-semibold text-[#0F172A]">
                            {translatePortalValue(exam.subject, lang)}
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-xs text-[#065F46] whitespace-nowrap">
                            {exam.kitabCode}
                          </td>
                          <td className="py-3.5 text-[#475569] whitespace-nowrap">
                            {translatePortalValue(exam.hallAndSeat, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'results' && activeResultTerm && (
              <div className="printable-area rounded-xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                      {d.resultsHeading}
                    </h2>
                    <p className="mt-1 text-xs text-[#475569] tabular-nums">
                      {student.name} · {d.rollPrefix} {student.studentRoll}
                    </p>
                  </div>

                  <div className="no-print flex flex-wrap items-center gap-2">
                    <select
                      aria-label={d.selectTermAria}
                      value={activeResultTerm.id}
                      onChange={(e) => setSelectedTermId(e.target.value)}
                      className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] focus:border-[#065F46] focus:outline-none"
                    >
                      {payload.examResults.map((term) => (
                        <option key={term.id} value={term.id}>
                          {translatePortalValue(term.termName, lang)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
                    >
                      <Printer className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                      <span>{d.printShort}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs text-[#475569]">{d.totalMarks}</p>
                    <p className="mt-1 font-serif text-lg font-bold text-[#065F46] tabular-nums">
                      {formatDigits(termTotals.totalObtained, lang)} /{' '}
                      {formatDigits(termTotals.totalFull, lang)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs text-[#475569]">{d.percentageLabel}</p>
                    <p className="mt-1 font-serif text-lg font-bold text-[#0F172A] tabular-nums">
                      {termTotals.percentage}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs text-[#475569]">{d.overallGrade}</p>
                    <p className="mt-1 font-serif text-lg font-bold text-[#065F46]">
                      {translatePortalValue(activeResultTerm.overallGrade, lang)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <p className="text-xs text-[#475569]">{d.meritPos}</p>
                    <p className="mt-1 font-serif text-base font-bold text-[#B45309]">
                      {translatePortalValue(activeResultTerm.meritPosition, lang)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                        <th className="py-3 pr-4">{d.colSubject}</th>
                        <th className="py-3 pr-4 text-right">{d.colFullMarks}</th>
                        <th className="py-3 pr-4 text-right">{d.colObtainedMarks}</th>
                        <th className="py-3 pr-4">{d.colGrade}</th>
                        <th className="py-3">{d.colRemarks}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {activeResultTerm.subjects.map((subj) => (
                        <tr key={subj.subject} className="hover:bg-[#F8FAFC]/60">
                          <td className="py-3.5 pr-4 font-medium text-[#0F172A]">
                            {translatePortalValue(subj.subject, lang)}
                          </td>
                          <td className="py-3.5 pr-4 text-right text-[#475569] tabular-nums">
                            {formatDigits(subj.fullMarks, lang)}
                          </td>
                          <td className="py-3.5 pr-4 text-right font-semibold text-[#0F172A] tabular-nums">
                            {formatDigits(subj.obtainedMarks, lang)}
                          </td>
                          <td className="py-3.5 pr-4 font-semibold text-[#065F46]">
                            {translatePortalValue(subj.grade, lang)}
                          </td>
                          <td className="py-3.5 text-[#475569]">
                            {translatePortalValue(subj.remarks, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-xs text-[#475569]">
                  {d.publishedDatePrefix}{' '}
                  {translatePortalValue(activeResultTerm.publishedDate, lang)}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      <NoticeModal
        notice={selectedNotice}
        lang={lang}
        onClose={() => setSelectedNoticeId(null)}
      />
    </div>
  );
}
